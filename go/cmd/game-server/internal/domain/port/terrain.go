// Package port — Puertos hexagonales del game-server.
package port

import "github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"

type SessionStore interface {
	GetOrCreate(bloqueID string, ecoID int) *entity.BlockSession
	Get(bloqueID string, ecoID int) (*entity.BlockSession, bool)
	GetByBloque(bloqueID string) []*entity.BlockSession
	RemoveIfEmpty(bloqueID string, ecoID int)
	AllSessions() []*entity.BlockSession
}

type ChunkRequest struct { BloqueID string; ChunkCX, ChunkCY int; Priority int; RequesterID, PlayerID string }
type ChunkReady struct { BloqueID string; ChunkCX, ChunkCY int; WireJSON string; SolidCells []string; Version uint64; RequesterID string }

type SwingTarget struct {
	PlayerID string `json:"player_id"`
	EntityID int `json:"entity_id"`
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}
type AreaTarget struct { X float64 `json:"x"`; Y float64 `json:"y"`; Z float64 `json:"z"` }
type SwingCommand struct {
	BloqueID string
	EcoID int
	PlayerID string
	ActionID string
	EntityID int
	Seq int
	PosX float64
	PosY float64
	PosZ float64
	Yaw float64
	IsNPC bool
	Targets []SwingTarget
	AreaTarget *AreaTarget `json:"area_target,omitempty"`
	ParticleID string
	ParticleX int
	ParticleY int
	ParticleZ int
}
type SwingPublisher interface { PublishSwing(cmd SwingCommand) error }
type TerrainPublisher interface { PublishChunkRequest(req ChunkRequest) error }
type TerrainSubscriber interface { Run(readyCh chan<- ChunkReady) error }
type ConnRegistry interface {
	Bind(connID uint64, bloqueID, playerID string)
	Unbind(connID uint64) (bloqueID, playerID string, ok bool)
	ConnIDsForSession(bloqueID string) []uint64
}
