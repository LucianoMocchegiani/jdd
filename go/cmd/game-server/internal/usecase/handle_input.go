// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

const swingCooldown = 500 * time.Millisecond

// InputPayload representa input payload.
type InputPayload struct {
	BloqueID string
	EcoID    int
	PlayerID string
	Seq      int
	Intents  map[string]bool
	Yaw      *float64
	Pitch    *float64
}

// HandleInput implementa handle input.
func (s *Services) HandleInput(in InputPayload) (errJSON string, ok bool) {
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists {
		return buildError("input_error", "not_in_block"), false
	}
	updated := sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) {
		if in.Seq != 0 {
			p.InputSeq = in.Seq
		}
		if in.Intents != nil {
			p.Intents = in.Intents
		}
		if in.Yaw != nil {
			p.Yaw = *in.Yaw
		}
		if in.Pitch != nil {
			p.Pitch = *in.Pitch
		}
	})
	if !updated {
		return buildError("input_error", "player_not_in_session"), false
	}
	return "", true
}

// SwingPayload carries only client intent; position, orientation, and damage are server-resolved.
type SwingPayload struct {
	BloqueID string
	EcoID    int
	PlayerID string
	ActionID string
	Seq      int
}

// HandleSwing validates and queues a server-positioned melee strike.
func (s *Services) HandleSwing(in SwingPayload) (responseJSON string, isError bool) {
	if in.PlayerID == "" {
		return buildError("swing_error", "missing_player_id"), true
	}
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists {
		return buildError("swing_error", "not_in_block"), true
	}
	if s.Combat == nil {
		return buildError("swing_error", "not_configured"), true
	}
	profile := s.Combat.Get(in.ActionID)
	if profile == nil {
		return buildError("swing_error", "unknown_action"), true
	}
	if s.SwingPub == nil {
		return buildError("swing_error", "not_configured"), true
	}
	reservation, ok := sess.BeginSwing(in.PlayerID, in.Seq, time.Now(), swingCooldown)
	if !ok {
		return buildError("swing_error", "swing_rejected"), true
	}
	err := s.SwingPub.PublishSwing(port.SwingCommand{
		BloqueID: in.BloqueID,
		PlayerID: in.PlayerID,
		ActionID: in.ActionID,
		EntityID: int(reservation.EntityID),
		Seq:      in.Seq,
		PosX:     reservation.X,
		PosY:     reservation.Y,
		PosZ:     reservation.Z,
		Yaw:      reservation.Yaw,
	})
	if err != nil {
		sess.CancelSwing(in.PlayerID, reservation)
		return buildError("swing_error", "enqueue_failed"), true
	}
	sess.ApplyMeleeDamage(in.PlayerID, jdcombat.Point{X: reservation.X, Y: reservation.Y, Z: reservation.Z}, reservation.Yaw, profile.Reach, profile.Damage)
	ack, _ := json.Marshal(map[string]interface{}{
		"type":      "swing_queued",
		"seq":       in.Seq,
		"entity_id": reservation.EntityID,
		"action_id": in.ActionID,
	})
	return string(ack), false
}

func buildError(msgType, code string) string {
	b, _ := json.Marshal(map[string]string{"type": msgType, "error": code})
	return string(b)
}
