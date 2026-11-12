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

type SwingPublisher struct { client *goredis.Client }

func NewSwingPublisher(client *goredis.Client) *SwingPublisher { return &SwingPublisher{client: client} }

type swingPayload struct {
	BloqueID string `json:"bloque_id"`
	EcoID int `json:"eco_id"`
	PlayerID string `json:"player_id"`
	ActionID string `json:"action_id"`
	EntityID int `json:"entity_id"`
	Seq int `json:"seq"`
	PosX float64 `json:"pos_x"`
	PosY float64 `json:"pos_y"`
	PosZ float64 `json:"pos_z"`
	Yaw float64 `json:"yaw"`
	IsNPC bool `json:"is_npc"`
	Targets []port.SwingTarget `json:"targets"`
	ParticleID string `json:"particle_id,omitempty"`
	ParticleX int `json:"particle_x,omitempty"`
	ParticleY int `json:"particle_y,omitempty"`
	ParticleZ int `json:"particle_z,omitempty"`
}

func (p *SwingPublisher) PublishSwing(cmd port.SwingCommand) error {
	payload, err := json.Marshal(swingPayload{
		BloqueID: cmd.BloqueID, EcoID: cmd.EcoID, PlayerID: cmd.PlayerID, ActionID: cmd.ActionID,
		EntityID: cmd.EntityID, Seq: cmd.Seq, PosX: cmd.PosX, PosY: cmd.PosY,
		PosZ: cmd.PosZ, Yaw: cmd.Yaw, IsNPC: cmd.IsNPC, Targets: cmd.Targets,
		ParticleID: cmd.ParticleID, ParticleX: cmd.ParticleX, ParticleY: cmd.ParticleY, ParticleZ: cmd.ParticleZ,
	})
	if err != nil { return err }
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return p.client.XAdd(ctx, &goredis.XAddArgs{
		Stream: rediskeys.StreamSwingCommands, MaxLen: 10000, Approx: true,
		Values: map[string]interface{}{"payload": string(payload)},
	}).Err()
}

var _ port.SwingPublisher = (*SwingPublisher)(nil)
