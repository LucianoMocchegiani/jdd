// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

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
	p, ok := sess.GetPlayer(in.PlayerID)
	if !ok {
		return buildError("input_error", "player_not_in_session"), false
	}
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
	return "", true
}

// SwingPayload representa swing payload.
type SwingPayload struct {
	BloqueID string
	EcoID    int
	ActionID string
	EntityID int
	Seq      int
	PosX     float64
	PosY     float64
	PosZ     float64
}

// HandleSwing implementa handle swing.
func (s *Services) HandleSwing(in SwingPayload) (responseJSON string, isError bool) {
	if s.SwingPub == nil {
		return buildError("swing_error", "not_configured"), true
	}
	err := s.SwingPub.PublishSwing(port.SwingCommand{
		BloqueID: in.BloqueID,
		ActionID: in.ActionID,
		EntityID: in.EntityID,
		Seq:      in.Seq,
		PosX:     in.PosX,
		PosY:     in.PosY,
		PosZ:     in.PosZ,
	})
	if err != nil {
		return buildError("swing_error", "enqueue_failed"), true
	}
	ack, _ := json.Marshal(map[string]interface{}{
		"type":      "swing_queued",
		"seq":       in.Seq,
		"entity_id": in.EntityID,
		"action_id": in.ActionID,
	})
	return string(ack), false
}

func buildError(msgType, code string) string {
	b, _ := json.Marshal(map[string]string{"type": msgType, "error": code})
	return string(b)
}
