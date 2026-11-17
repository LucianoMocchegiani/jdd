package usecase

import (
	"encoding/json"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

// executeAction reserva una acción de un solo uso, cobra su maná y revierte reserva/coste si falla el enqueue.
// Solo después de encolar correctamente ejecuta onAccepted y genera el acuse con la secuencia autoritativa.
func (s *Services) executeAction(
	sess *entity.BlockSession,
	playerID, actionID string,
	seq int,
	profile *port.CombatProfile,
	enqueue func(entity.ActionSwingReservation) string,
	onAccepted func(),
) (string, bool) {
	now := time.Now()
	reservation, ok := sess.BeginActionSwing(playerID, actionID, seq, now, profile.Cooldown, profile.BlockedMediums)
	if !ok {
		return buildError("swing_error", "swing_rejected"), true
	}
	if !sess.SpendSwingMana(playerID, seq, profile.ManaCost) {
		sess.CancelActionSwing(playerID, reservation)
		return buildError("swing_error", "swing_rejected"), true
	}
	if code := enqueue(reservation); code != "" {
		sess.CancelActionSwingAndRefundMana(playerID, reservation, profile.ManaCost)
		return buildError("swing_error", code), true
	}
	if onAccepted != nil {
		onAccepted()
	}
	var actionSeq int
	sess.UpdatePlayer(playerID, func(p *entity.Player) {
		p.InCombatUntil = now.Add(6 * time.Second)
		p.ActionID = actionID
		p.ActionSeq++
		actionSeq = p.ActionSeq
	})
	ack, _ := json.Marshal(map[string]interface{}{
		"type": "swing_queued", "seq": seq, "entity_id": reservation.EntityID,
		"action_id": actionID, "action_seq": actionSeq,
	})
	return string(ack), false
}
