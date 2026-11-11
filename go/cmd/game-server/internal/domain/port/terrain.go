// Package port — Puertos hexagonales del game-server.
package port

import "github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"

// SessionStore representa session store.
type SessionStore interface {
	GetOrCreate(bloqueID string, ecoID int) *entity.BlockSession
	Get(bloqueID string, ecoID int) (*entity.BlockSession, bool)
	GetByBloque(bloqueID string) []*entity.BlockSession
	RemoveIfEmpty(bloqueID string, ecoID int)
	AllSessions() []*entity.BlockSession
}

// ChunkRequest representa chunk request.
type ChunkRequest struct {
	BloqueID    string
	ChunkCX     int
	ChunkCY     int
	Priority    int
	RequesterID string
	PlayerID    string
}

// ChunkReady representa chunk ready.
type ChunkReady struct {
	BloqueID    string
	ChunkCX     int
	ChunkCY     int
	WireJSON    string
	SolidCells  []string
	Version     uint64
	RequesterID string
}

// TerrainPublisher representa terrain publisher.
type TerrainPublisher interface {
	PublishChunkRequest(req ChunkRequest) error
}

// TerrainSubscriber representa terrain subscriber.
type TerrainSubscriber interface {
	Run(readyCh chan<- ChunkReady) error
}

// SwingTarget is a server-snapshotted player candidate for a melee strike.
type SwingTarget struct {
	PlayerID string  `json:"player_id"`
	EntityID int     `json:"entity_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
}

// SwingCommand represents a server-validated strike for world damage.
type SwingCommand struct {
	BloqueID string
	EcoID    int
	PlayerID string
	ActionID string
	EntityID int
	Seq      int
	PosX     float64
	PosY     float64
	PosZ     float64
	Yaw      float64
	IsNPC    bool
	Targets  []SwingTarget
}

// SwingPublisher represents swing publisher.
type SwingPublisher interface {
	PublishSwing(cmd SwingCommand) error
}

// ConnRegistry representa conn registry.
type ConnRegistry interface {
	Bind(connID uint64, bloqueID, playerID string)
	Unbind(connID uint64) (bloqueID, playerID string, ok bool)
	ConnIDsForSession(bloqueID string) []uint64
}
