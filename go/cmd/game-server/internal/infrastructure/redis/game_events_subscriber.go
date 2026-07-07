// Package redis — Redis: streams terrain, swing y eventos.
package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
	"github.com/juego-de-dioses/jd/pkg/jd/rediskeys"
)

const streamSwingResults = rediskeys.StreamSwingResults

// GameEventsSubscriber representa game events subscriber.
type GameEventsSubscriber struct {
	client       *goredis.Client
	instanceID   string
	consumerName string
	svc          *usecase.Services
}

// NewGameEventsSubscriber construye game events subscriber.
func NewGameEventsSubscriber(client *goredis.Client, instanceID string, svc *usecase.Services) *GameEventsSubscriber {
	return &GameEventsSubscriber{
		client:       client,
		instanceID:   instanceID,
		consumerName: fmt.Sprintf("game-events-%s", instanceID),
		svc:          svc,
	}
}

func (s *GameEventsSubscriber) ensureGroup(ctx context.Context, stream, group string) error {
	err := s.client.XGroupCreateMkStream(ctx, stream, group, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return err
	}
	return nil
}

// Run implementa run.
func (s *GameEventsSubscriber) Run(ctx context.Context) error {
	group := "game-" + s.instanceID
	if err := s.ensureGroup(ctx, rediskeys.StreamGameDestroyed, group); err != nil {
		return err
	}
	if err := s.ensureGroup(ctx, streamSwingResults, group); err != nil {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		streams, err := s.client.XReadGroup(ctx, &goredis.XReadGroupArgs{
			Group:    group,
			Consumer: s.consumerName,
			Streams:  []string{rediskeys.StreamGameDestroyed, streamSwingResults, ">", ">"},
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
				raw, _ := msg.Values["payload"].(string)
				switch stream.Stream {
				case rediskeys.StreamGameDestroyed:
					s.handleDestroyed(raw)
				case streamSwingResults:
					s.handleSwingResult(raw)
				}
				_ = s.client.XAck(ctx, stream.Stream, group, msg.ID).Err()
			}
		}
	}
}

func (s *GameEventsSubscriber) handleDestroyed(raw string) {
	var p struct {
		BloqueID   string `json:"bloque_id"`
		ParticleID string `json:"particle_id"`
		X          int    `json:"x"`
		Y          int    `json:"y"`
		Z          int    `json:"z"`
	}
	if json.Unmarshal([]byte(raw), &p) != nil {
		return
	}
	s.svc.HandleParticleDestroyed(usecase.DestroyedEvent{
		BloqueID:   p.BloqueID,
		ParticleID: p.ParticleID,
		X:          p.X,
		Y:          p.Y,
		Z:          p.Z,
	})
}

func (s *GameEventsSubscriber) handleSwingResult(raw string) {
	var p struct {
		BloqueID string `json:"bloque_id"`
		EntityID int    `json:"entity_id"`
		Seq      int    `json:"seq"`
		ActionID string `json:"action_id"`
	}
	if json.Unmarshal([]byte(raw), &p) != nil {
		return
	}
	s.svc.HandleSwingResult(usecase.SwingResultEvent{
		BloqueID: p.BloqueID,
		EntityID: p.EntityID,
		Seq:      p.Seq,
		ActionID: p.ActionID,
		RawJSON:  raw,
	})
}
