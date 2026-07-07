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

// SwingPublisher representa swing publisher.
type SwingPublisher struct {
	client *goredis.Client
}

// NewSwingPublisher construye swing publisher.
func NewSwingPublisher(client *goredis.Client) *SwingPublisher {
	return &SwingPublisher{client: client}
}

type swingPayload struct {
	BloqueID string  `json:"bloque_id"`
	PlayerID string  `json:"player_id"`
	ActionID string  `json:"action_id"`
	EntityID int     `json:"entity_id"`
	Seq      int     `json:"seq"`
	PosX     float64 `json:"pos_x"`
	PosY     float64 `json:"pos_y"`
	PosZ     float64 `json:"pos_z"`
	IsNPC    bool    `json:"is_npc"`
}

// PublishSwing implementa publish swing.
func (p *SwingPublisher) PublishSwing(cmd port.SwingCommand) error {
	payload, err := json.Marshal(swingPayload{
		BloqueID: cmd.BloqueID,
		PlayerID: cmd.PlayerID,
		ActionID: cmd.ActionID,
		EntityID: cmd.EntityID,
		Seq:      cmd.Seq,
		PosX:     cmd.PosX,
		PosY:     cmd.PosY,
		PosZ:     cmd.PosZ,
		IsNPC:    cmd.IsNPC,
	})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return p.client.XAdd(ctx, &goredis.XAddArgs{
		Stream: rediskeys.StreamSwingCommands,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"payload": string(payload)},
	}).Err()
}

var _ port.SwingPublisher = (*SwingPublisher)(nil)
