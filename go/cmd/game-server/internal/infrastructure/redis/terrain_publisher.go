// Package redis — Redis: streams terrain, swing y eventos.
package redis

import (
	"context"
	"encoding/json"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/pkg/jd/rediskeys"
)

// TerrainPublisher representa terrain publisher.
type TerrainPublisher struct {
	client *goredis.Client
}

// NewTerrainPublisher construye terrain publisher.
func NewTerrainPublisher(client *goredis.Client) *TerrainPublisher {
	return &TerrainPublisher{client: client}
}

type chunkRequestPayload struct {
	BloqueID    string `json:"bloque_id"`
	ChunkCX     int    `json:"chunk_cx"`
	ChunkCY     int    `json:"chunk_cy"`
	Priority    int    `json:"priority"`
	RequesterID string `json:"requester_id"`
	PlayerID    string `json:"player_id,omitempty"`
}

// PublishChunkRequest implementa publish chunk request.
func (p *TerrainPublisher) PublishChunkRequest(req port.ChunkRequest) error {
	payload, err := json.Marshal(chunkRequestPayload{
		BloqueID:    req.BloqueID,
		ChunkCX:     req.ChunkCX,
		ChunkCY:     req.ChunkCY,
		Priority:    req.Priority,
		RequesterID: req.RequesterID,
		PlayerID:    req.PlayerID,
	})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return p.client.XAdd(ctx, &goredis.XAddArgs{
		Stream: rediskeys.StreamTerrainRequests,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"payload": string(payload)},
	}).Err()
}

var _ port.TerrainPublisher = (*TerrainPublisher)(nil)
