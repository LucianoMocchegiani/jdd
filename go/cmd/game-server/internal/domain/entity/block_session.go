// Package entity — Entidades de dominio (sesión, jugador, terreno).
package entity

import (
	"sync"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
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
	s.mu.RLock()
	defer s.mu.RUnlock()
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
