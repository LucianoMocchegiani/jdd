// Package entity — Entidades de dominio (sesión, jugador, terreno).
package entity

import (
	"sync"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

// BlockSession — sala multijugador por bloque_id + eco_id.
type BlockSession struct {
	mu          sync.RWMutex
	BloqueID    string
	EcoID       int
	ServerTick  int
	Players     map[string]*Player
	SolidGrid   *collision.SolidGridCache
	TypesByName map[string]TypeInfo
	nextEntity  uint32
}

type TypeInfo struct {
	TipoFisico string
	Viscosidad *float64
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
	X, Y, Z, Yaw float64
	EntityID     uint32
	Seq          int
	previousSeq  int
	previousAt   time.Time
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
	reservation := SwingReservation{X: p.X, Y: p.Y, Z: p.Z, Yaw: p.Yaw, EntityID: p.EntityID, Seq: seq, previousSeq: p.lastSwingSeq, previousAt: p.lastSwingAt}
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
