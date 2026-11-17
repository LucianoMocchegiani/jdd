package port

import "github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"

// SessionStore provides access to block sessions by block and instance ID.
type SessionStore interface {
	GetOrCreate(bloqueID string, ecoID int) *entity.BlockSession
	Get(bloqueID string, ecoID int) (*entity.BlockSession, bool)
	GetByBloque(bloqueID string) []*entity.BlockSession
	RemoveIfEmpty(bloqueID string, ecoID int)
	AllSessions() []*entity.BlockSession
}

// ChunkRequest asks the terrain service for one world chunk.
type ChunkRequest struct {
	BloqueID    string
	ChunkCX     int
	ChunkCY     int
	Priority    int
	RequesterID string
	PlayerID    string
}

// ChunkReady carries a fetched chunk and its solid-cell snapshot back to the game server.
type ChunkReady struct {
	BloqueID    string
	ChunkCX     int
	ChunkCY     int
	WireJSON    string
	SolidCells  []string
	Version     uint64
	RequesterID string
}

// TerrainPublisher publishes asynchronous chunk requests.
type TerrainPublisher interface { PublishChunkRequest(req ChunkRequest) error }

// TerrainSubscriber consumes completed chunk requests.
type TerrainSubscriber interface { Run(readyCh chan<- ChunkReady) error }

// SwingTarget is a server-snapshotted player candidate for a line attack.
type SwingTarget struct {
	PlayerID string  `json:"player_id"`
	EntityID int     `json:"entity_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
}

// AreaTarget is the selected center point for an area cast, in world coordinates.
type AreaTarget struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// SwingCommand is a validated combat impact sent to persistence-api for particle damage.
type SwingCommand struct {
	BloqueID   string
	EcoID      int
	PlayerID   string
	ActionID   string
	EntityID   int
	Seq        int
	PosX       float64
	PosY       float64
	PosZ       float64
	Yaw        float64
	IsNPC      bool
	Targets    []SwingTarget
	AreaTarget *AreaTarget `json:"area_target,omitempty"`
	ParticleID string
	ParticleX  int
	ParticleY  int
	ParticleZ  int
}

// SwingPublisher queues validated combat impacts for persistence-api.
type SwingPublisher interface { PublishSwing(cmd SwingCommand) error }

// ConnRegistry maps active connections to their player sessions.
type ConnRegistry interface {
	Bind(connID uint64, bloqueID, playerID string)
	Unbind(connID uint64) (bloqueID, playerID string, ok bool)
	ConnIDsForSession(bloqueID string) []uint64
}
