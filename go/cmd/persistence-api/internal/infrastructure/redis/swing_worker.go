// Package redis — Workers Redis (swing, eventos).
package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/pkg/jd/rediskeys"
)

const streamSwingResults = rediskeys.StreamSwingResults

// DestroyRateLimiter representa destroy rate limiter.
type DestroyRateLimiter struct {
	client *goredis.Client
	limit  int
}

// NewDestroyRateLimiter construye destroy rate limiter.
func NewDestroyRateLimiter(client *goredis.Client, limit int) *DestroyRateLimiter {
	if limit < 1 {
		limit = 50
	}
	return &DestroyRateLimiter{client: client, limit: limit}
}

// AllowDestroy implementa allow destroy.
func (r *DestroyRateLimiter) AllowDestroy(ctx context.Context, bloqueID string) (bool, error) {
	key := rediskeys.RateLimitDestroyKey(bloqueID)
	n, err := r.client.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}
	if n == 1 {
		_ = r.client.Expire(ctx, key, time.Second).Err()
	}
	return n <= int64(r.limit), nil
}

// EventPublisher representa event publisher.
type EventPublisher struct {
	client *goredis.Client
}

// NewEventPublisher construye event publisher.
func NewEventPublisher(client *goredis.Client) *EventPublisher {
	return &EventPublisher{client: client}
}

// PublishCellDestroyed implementa publish cell destroyed.
func (p *EventPublisher) PublishCellDestroyed(ctx context.Context, bloqueID, particleID string, x, y, z int) error {
	payload, _ := json.Marshal(map[string]interface{}{
		"bloque_id":    bloqueID,
		"x":            x,
		"y":            y,
		"z":            z,
		"particle_id":  particleID,
	})
	return p.client.XAdd(ctx, &goredis.XAddArgs{
		Stream: rediskeys.StreamTerrainInvalidate,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"payload": string(payload)},
	}).Err()
}

// PublishParticleDestroyed implementa publish particle destroyed.
func (p *EventPublisher) PublishParticleDestroyed(ctx context.Context, bloqueID, particleID string, x, y, z int) error {
	payload, _ := json.Marshal(map[string]interface{}{
		"bloque_id":   bloqueID,
		"particle_id": particleID,
		"x":           x,
		"y":           y,
		"z":           z,
	})
	return p.client.XAdd(ctx, &goredis.XAddArgs{
		Stream: rediskeys.StreamGameDestroyed,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"payload": string(payload)},
	}).Err()
}

// PublishSwingResult implementa publish swing result.
func (p *EventPublisher) PublishSwingResult(ctx context.Context, payloadJSON string) error {
	return p.client.XAdd(ctx, &goredis.XAddArgs{
		Stream: streamSwingResults,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"payload": payloadJSON},
	}).Err()
}

// SwingConsumer representa swing consumer.
type SwingConsumer struct {
	client       *goredis.Client
	group        string
	consumerName string
	onSwing      func(ctx context.Context, payload string) error
}

// NewSwingConsumer construye swing consumer.
func NewSwingConsumer(client *goredis.Client, onSwing func(ctx context.Context, payload string) error) *SwingConsumer {
	return &SwingConsumer{
		client:       client,
		group:        "persistence-swing",
		consumerName: fmt.Sprintf("swing-%d", time.Now().UnixNano()),
		onSwing:      onSwing,
	}
}

// Run implementa run.
func (c *SwingConsumer) Run(ctx context.Context) error {
	if err := c.client.XGroupCreateMkStream(ctx, rediskeys.StreamSwingCommands, c.group, "0").Err(); err != nil {
		if err.Error() != "BUSYGROUP Consumer Group name already exists" {
			return err
		}
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		streams, err := c.client.XReadGroup(ctx, &goredis.XReadGroupArgs{
			Group:    c.group,
			Consumer: c.consumerName,
			Streams:  []string{rediskeys.StreamSwingCommands, ">"},
			Count:    5,
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
				if raw != "" {
					_ = c.onSwing(ctx, raw)
				}
				_ = c.client.XAck(ctx, rediskeys.StreamSwingCommands, c.group, msg.ID).Err()
			}
		}
	}
}
