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

// TypeInfo representa type info.
type TypeInfo struct {
	TipoFisico string
	Viscosidad *float64
}

// NewBlockSession construye block session.
func NewBlockSession(bloqueID string, ecoID int) *BlockSession {
	return &BlockSession{
		BloqueID:    bloqueID,
		EcoID:       ecoID,
		Players:     make(map[string]*Player),
		SolidGrid:   collision.NewSolidGrid(),
		TypesByName: make(map[string]TypeInfo),
		nextEntity:  1,
	}
}

// PlayerCount implementa player count.
func (s *BlockSession) PlayerCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.Players)
}

// AddPlayer implementa add player.
func (s *BlockSession) AddPlayer(playerID string, x, y, z, yaw, pitch float64) (isNew bool, p *Player) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.Players[playerID]; ok {
		existing.X, existing.Y, existing.Z = x, y, z
		existing.Yaw, existing.Pitch = yaw, pitch
		return false, existing
	}
	eid := s.nextEntity
	s.nextEntity++
	p = NewPlayer(playerID, eid, x, y, z, yaw, pitch)
	s.Players[playerID] = p
	return true, p
}

// RemovePlayer implementa remove player.
func (s *BlockSession) RemovePlayer(playerID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.Players[playerID]; !ok {
		return false
	}
	delete(s.Players, playerID)
	return true
}

// GetPlayer implementa get player.
func (s *BlockSession) GetPlayer(playerID string) (*Player, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.Players[playerID]
	return p, ok
}

// UpdatePlayer mutates a player's authoritative state while holding the session lock.
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

// SwingReservation stores the authoritative origin and cooldown state for one attack.
type SwingReservation struct {
	X, Y, Z, Yaw float64
	EntityID     uint32
	Seq          int
	previousSeq  int
	previousAt   time.Time
}

// BeginSwing validates the per-player sequence/cooldown and snapshots server state.
func (s *BlockSession) BeginSwing(playerID string, seq int, now time.Time, cooldown time.Duration) (SwingReservation, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.Players[playerID]
	if !ok || p.Health <= 0 || p.Medium == "air" || p.Medium == "submerged_full" || seq <= p.lastSwingSeq || (!p.lastSwingAt.IsZero() && now.Sub(p.lastSwingAt) < cooldown) {
		return SwingReservation{}, false
	}
	reservation := SwingReservation{
		X: p.X, Y: p.Y, Z: p.Z, Yaw: p.Yaw, EntityID: p.EntityID,
		Seq: seq, previousSeq: p.lastSwingSeq, previousAt: p.lastSwingAt,
	}
	p.lastSwingSeq, p.lastSwingAt = seq, now
	return reservation, true
}

// CancelSwing restores a reservation when the world-damage command could not be queued.
func (s *BlockSession) CancelSwing(playerID string, reservation SwingReservation) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.Players[playerID]; p != nil && p.lastSwingSeq == reservation.Seq {
		p.lastSwingSeq, p.lastSwingAt = reservation.previousSeq, reservation.previousAt
	}
}

// ApplyMeleeDamage applies one hit to each other player whose body hitbox is in the strike.
func (s *BlockSession) ApplyMeleeDamage(attackerID string, origin jdcombat.Point, yaw, reach, damage float64) []PlayerHealthChange {
	s.mu.Lock()
	defer s.mu.Unlock()
	attacker := s.Players[attackerID]
	if attacker == nil || attacker.Health <= 0 {
		return nil
	}
	var hits []PlayerHealthChange
	for id, target := range s.Players {
		if id == attackerID || target.Health <= 0 || !jdcombat.HitsPlayer(origin, yaw, jdcombat.Point{X: target.X, Y: target.Y, Z: target.Z}, reach) {
			continue
		}
		target.Health -= damage
		if target.Health < 0 {
			target.Health = 0
		}
		hits = append(hits, PlayerHealthChange{PlayerID: id, Health: target.Health, MaxHealth: target.MaxHealth})
	}
	return hits
}

// PlayerHealthChange is the replicated result for one hit player.
type PlayerHealthChange struct {
	PlayerID  string
	Health    float64
	MaxHealth float64
}

// PlayerIDs implementa player ids.
func (s *BlockSession) PlayerIDs() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.Players))
	for id := range s.Players {
		out = append(out, id)
	}
	return out
}

// ForEachPlayer implementa for each player.
func (s *BlockSession) ForEachPlayer(fn func(*Player)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.Players {
		fn(p)
	}
}

// PositionsXY implementa positions xy.
func (s *BlockSession) PositionsXY() [][2]float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([][2]float64, 0, len(s.Players))
	for _, p := range s.Players {
		out = append(out, [2]float64{p.X, p.Y})
	}
	return out
}

// ApplyType implementa apply type.
func (s *BlockSession) ApplyType(nombre string, info TypeInfo) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TypesByName[nombre] = info
}

// IncrementTick implementa increment tick.
func (s *BlockSession) IncrementTick() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ServerTick++
	return s.ServerTick
}
