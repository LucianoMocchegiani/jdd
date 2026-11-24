package usecase

import (
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/sim/systems"
)

func (s *Services) HandleDodge(in SwingPayload) (string, bool) {
	if in.PlayerID == "" || s.Combat == nil { return buildError("swing_error", "unknown_action"), true }
	profile := s.Combat.Get(in.ActionID)
	if profile == nil || profile.Movement == nil || profile.ControlType == "sustained" {
		return buildError("swing_error", "unknown_action"), true
	}
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists { return buildError("swing_error", "not_in_block"), true }
	if s.Conditions != nil {
		blocked := false
		sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) { blocked = s.Conditions.BlocksIntent(p.Conditions, profile.InputIntent) || s.Conditions.BlocksAction(p.Conditions, in.ActionID) })
		if blocked { return buildError("swing_error", "swing_rejected"), true }
	}
	return s.executeOneShotAction(sess, in.PlayerID, in.ActionID, in.Seq, profile,
		func(_ entity.ActionSwingReservation) string {
			started := false
			sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) {
				started = systems.StartPlanarDash(p, profile.Movement.DashDistance, profile.Movement.DashDuration.Seconds())
			})
			if !started { return "dash_rejected" }
			return ""
		}, nil)
}
