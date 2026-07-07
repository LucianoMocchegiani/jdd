// Package redis — Redis: streams terrain, swing y eventos.
package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/pkg/jd/rediskeys"
)

// TerrainSubscriber representa terrain subscriber.
type TerrainSubscriber struct {
	client       *goredis.Client
	instanceID   string
	consumerName string
}

// NewTerrainSubscriber construye terrain subscriber.
func NewTerrainSubscriber(client *goredis.Client, instanceID string) *TerrainSubscriber {
	return &TerrainSubscriber{
		client:       client,
		instanceID:   instanceID,
		consumerName: fmt.Sprintf("game-%s", instanceID),
	}
}

type chunkReadyPayload struct {
	BloqueID    string   `json:"bloque_id"`
	ChunkCX     int      `json:"chunk_cx"`
	ChunkCY     int      `json:"chunk_cy"`
	WireJSON    string   `json:"wire_json"`
	SolidCells  []string `json:"solid_cells"`
	Version     uint64   `json:"version"`
	RequesterID string   `json:"requester_id"`
}

func (s *TerrainSubscriber) ensureGroup(ctx context.Context) error {
	err := s.client.XGroupCreateMkStream(ctx, rediskeys.StreamTerrainReady, s.consumerName, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return err
	}
	return nil
}

// Run implementa run.
func (s *TerrainSubscriber) Run(readyCh chan<- port.ChunkReady) error {
	ctx := context.Background()
	if err := s.ensureGroup(ctx); err != nil {
		return err
	}
	for {
		streams, err := s.client.XReadGroup(ctx, &goredis.XReadGroupArgs{
			Group:    s.consumerName,
			Consumer: s.consumerName + "-1",
			Streams:  []string{rediskeys.StreamTerrainReady, ">"},
			Count:    10,
			Block:    2 * time.Second,
		}).Result()
		if err == goredis.Nil {
			continue
		}
		if err != nil {
			time.Sleep(time.Second)
			continue
		}
		for _, stream := range streams {
			for _, msg := range stream.Messages {
				raw, ok := msg.Values["payload"].(string)
				if !ok {
					_ = s.client.XAck(ctx, rediskeys.StreamTerrainReady, s.consumerName, msg.ID).Err()
					continue
				}
				var p chunkReadyPayload
				if json.Unmarshal([]byte(raw), &p) != nil {
					_ = s.client.XAck(ctx, rediskeys.StreamTerrainReady, s.consumerName, msg.ID).Err()
					continue
				}
				if p.RequesterID != "" && p.RequesterID != s.instanceID {
					_ = s.client.XAck(ctx, rediskeys.StreamTerrainReady, s.consumerName, msg.ID).Err()
					continue
				}
				select {
				case readyCh <- port.ChunkReady{
					BloqueID:    p.BloqueID,
					ChunkCX:     p.ChunkCX,
					ChunkCY:     p.ChunkCY,
					WireJSON:    p.WireJSON,
					SolidCells:  p.SolidCells,
					Version:     p.Version,
					RequesterID: p.RequesterID,
				}:
				default:
				}
				_ = s.client.XAck(ctx, rediskeys.StreamTerrainReady, s.consumerName, msg.ID).Err()
			}
		}
	}
}

var _ port.TerrainSubscriber = (*TerrainSubscriber)(nil)
