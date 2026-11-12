// Package entity — Entidades de dominio (sesión, jugador, terreno).
package entity

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

// BlockSession — sala multijugador por bloque_id + eco_id.
type BlockSession struct {
	mu             sync.RWMutex
	BloqueID        string
	EcoID           int
	ServerTick      int
	Players         map[string]*Player
	SolidGrid       *collision.SolidGridCache
	TypesByName     map[string]TypeInfo
	nextEntity      uint32
	nextProjectile  uint64
	projectiles     []Projectile
}

type TypeInfo struct {
	TipoFisico string
	Viscosidad *float64
}

type Projectile struct {
	ID, OwnerID, ActionID string
	X, Y, Z               float64
	DX, DY, DZ            float64
	Speed, Range           float64
	Damage, Radius         float64
	Traveled, DelaySec     float64
}

type ProjectileState struct {
	Type     string  `json:"type"`
	ID       string  `json:"id"`
	OwnerID  string  `json:"owner_id"`
	ActionID string  `json:"action_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Active   bool    `json:"active"`
}

func NewBlockSession(bloqueID string, ecoID int) *BlockSession {
	return &BlockSession{BloqueID: bloqueID, EcoID: ecoID, Players: make(map[string]*Player), SolidGrid: collision.NewSolidGrid(), TypesByName: make(map[string]TypeInfo), nextEntity: 1}
}

func (s *BlockSession) PlayerCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.Players)
}

func (s *BlockSession) AddPlayer(playerID string, x, y, z, yaw, pitch float64) (bool, *Player) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.Players[playerID]; ok {
		existing.X, existing.Y, existing.Z = x, y, z
		existing.Yaw, existing.Pitch = yaw, pitch
		return false, existing
	}
	id := s.nextEntity
	s.nextEntity++
	p := NewPlayer(playerID, id, x, y, z, yaw, pitch)
	s.Players[playerID] = p
	return true, p
}

func (s *BlockSession) RemovePlayer(playerID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.Players[playerID]; !ok {
		return false
	}
	delete(s.Players, playerID)
	return true
}

func (s *BlockSession) GetPlayer(playerID string) (*Player, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.Players[playerID]
	return p, ok
}

func (s *BlockSession) UpdatePlayer(playerID string, fn func(*Player)) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.Players[playerID]
	if !ok {
		return false
	}
	fn(p)
	return true
}

type SwingReservation struct {
	X, Y, Z, Yaw, Pitch float64
	EntityID            uint32
	Seq                 int
	previousSeq         int
	previousAt          time.Time
}

func (s *BlockSession) BeginSwing(playerID string, seq int, now time.Time, cooldown time.Duration, blockedMediums []string) (SwingReservation, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.Players[playerID]
	if !ok || p.Health <= 0 || seq <= p.lastSwingSeq || (!p.lastSwingAt.IsZero() && now.Sub(p.lastSwingAt) < cooldown) {
		return SwingReservation{}, false
	}
	for _, medium := range blockedMediums {
		if p.Medium == medium {
			return SwingReservation{}, false
		}
	}
	reservation := SwingReservation{X: p.X, Y: p.Y, Z: p.Z, Yaw: p.Yaw, Pitch: p.Pitch, EntityID: p.EntityID, Seq: seq, previousSeq: p.lastSwingSeq, previousAt: p.lastSwingAt}
	p.lastSwingSeq, p.lastSwingAt = seq, now
	return reservation, true
}

func (s *BlockSession) CancelSwing(playerID string, reservation SwingReservation) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.Players[playerID]; p != nil && p.lastSwingSeq == reservation.Seq {
		p.lastSwingSeq, p.lastSwingAt = reservation.previousSeq, reservation.previousAt
	}
}

func (s *BlockSession) SpawnProjectile(ownerID, actionID string, pose SwingReservation, speed, reach, damage, radius float64, delay time.Duration) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	owner := s.Players[ownerID]
	if owner == nil || owner.Health <= 0 || len(s.projectiles) >= 256 {
		return false
	}
	cp, sp := math.Cos(pose.Pitch), math.Sin(pose.Pitch)
	dx, dy, dz := -math.Sin(pose.Yaw)*cp, -math.Cos(pose.Yaw)*cp, sp
	s.nextProjectile++
	s.projectiles = append(s.projectiles, Projectile{
		ID: fmt.Sprintf("%s:%d:%d", s.BloqueID, s.EcoID, s.nextProjectile), OwnerID: ownerID, ActionID: actionID,
		X: pose.X + dx*0.8, Y: pose.Y + dy*0.8, Z: pose.Z + 1,
		DX: dx, DY: dy, DZ: dz, Speed: speed, Range: reach, Damage: damage, Radius: radius,
		DelaySec: delay.Seconds(),
	})
	return true
}

func (s *BlockSession) AdvanceProjectiles(deltaSec float64) []ProjectileState {
	if deltaSec <= 0 {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	const stepSize = 0.2
	states := make([]ProjectileState, 0, len(s.projectiles))
	remaining := s.projectiles[:0]
	for _, p := range s.projectiles {
		if p.DelaySec >= deltaSec {
			p.DelaySec -= deltaSec
			remaining = append(remaining, p)
			continue
		}
		moveSec := deltaSec - p.DelaySec
		p.DelaySec = 0
		distance := math.Min(p.Speed*moveSec, p.Range-p.Traveled)
		steps := int(math.Ceil(distance / stepSize))
		if steps < 1 {
			steps = 1
		}
		step := distance / float64(steps)
		active := true
		for i := 0; i < steps; i++ {
			p.X += p.DX * step
			p.Y += p.DY * step
			p.Z += p.DZ * step
			p.Traveled += step
			if s.projectileBlocked(p.X, p.Y, p.Z, p.Radius) {
				active = false
				break
			}
			if s.projectileHitPlayer(&p) {
				active = false
				break
			}
			if p.Traveled >= p.Range {
				active = false
				break
			}
		}
		states = append(states, ProjectileState{Type: "projectile_state", ID: p.ID, OwnerID: p.OwnerID, ActionID: p.ActionID, X: p.X, Y: p.Y, Z: p.Z, Active: active})
		if active {
			remaining = append(remaining, p)
		}
	}
	s.projectiles = remaining
	return states
}

func (s *BlockSession) projectileBlocked(x, y, z, radius float64) bool {
	if s.SolidGrid == nil {
		return false
	}
	for ix := int(math.Floor(x - radius)); ix <= int(math.Floor(x+radius)); ix++ {
		for iy := int(math.Floor(y - radius)); iy <= int(math.Floor(y+radius)); iy++ {
			for iz := int(math.Floor(z - radius)); iz <= int(math.Floor(z+radius)); iz++ {
				if s.SolidGrid.IsCellSolid(ix, iy, iz) {
					return true
				}
			}
		}
	}
	return false
}

func (s *BlockSession) projectileHitPlayer(projectile *Projectile) bool {
	for id, target := range s.Players {
		if id == projectile.OwnerID || target.Health <= 0 || projectile.Z < target.Z-0.3 || projectile.Z > target.Z+2.1 {
			continue
		}
		dx, dy := projectile.X-target.X, projectile.Y-target.Y
		r := projectile.Radius + 0.45
		if dx*dx+dy*dy > r*r {
			continue
		}
		target.Health = math.Max(0, target.Health-projectile.Damage)
		return true
	}
	return false
}

func (s *BlockSession) ApplyMeleeDamage(attackerID string, origin jdcombat.Point, yaw, reach, damage float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	attacker := s.Players[attackerID]
	if attacker == nil || attacker.Health <= 0 {
		return
	}
	for id, target := range s.Players {
		if id == attackerID || target.Health <= 0 || !jdcombat.HitsPlayer(origin, yaw, jdcombat.Point{X: target.X, Y: target.Y, Z: target.Z}, reach) {
			continue
		}
		target.Health -= damage
		if target.Health < 0 {
			target.Health = 0
		}
	}
}

func (s *BlockSession) PlayerIDs() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.Players))
	for id := range s.Players {
		out = append(out, id)
	}
	return out
}

func (s *BlockSession) ForEachPlayer(fn func(*Player)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.Players {
		fn(p)
	}
}

func (s *BlockSession) PositionsXY() [][2]float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([][2]float64, 0, len(s.Players))
	for _, p := range s.Players {
		out = append(out, [2]float64{p.X, p.Y})
	}
	return out
}

func (s *BlockSession) ApplyType(nombre string, info TypeInfo) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TypesByName[nombre] = info
}

func (s *BlockSession) IncrementTick() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ServerTick++
	return s.ServerTick
}
