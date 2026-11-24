package usecase

import (
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
)

// HandleKiShield creates the server-owned shield object after reserving its mana and cooldown.
func (s *Services) HandleKiShield(in SwingPayload) (string, bool) {
	if in.PlayerID == "" || s.Combat == nil { return buildError("swing_error", "unknown_action"), true }
	profile := s.Combat.Get(in.ActionID)
	if profile == nil || profile.Defense == nil || profile.Defense.Shape != "cone" || profile.Impact != nil || profile.Defense.Absorption <= 0 || profile.Defense.Duration <= 0 {
		return buildError("swing_error", "unknown_action"), true
	}
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists { return buildError("swing_error", "not_in_block"), true }
	if s.Conditions != nil {
		blocked := false
		sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) { blocked = s.Conditions.BlocksIntent(p.Conditions, profile.InputIntent) || s.Conditions.BlocksAction(p.Conditions, in.ActionID) })
		if blocked { return buildError("swing_error", "swing_rejected"), true }
	}
	return s.executeOneShotAction(sess, in.PlayerID, in.ActionID, in.Seq, profile, func(_ entity.ActionSwingReservation) string {
		if !sess.CreateKiShield(in.PlayerID, profile.Defense.Absorption, profile.Defense.AngleDegrees, profile.Defense.Duration, time.Now()) { return "shield_rejected" }
		return ""
	}, nil)
}
