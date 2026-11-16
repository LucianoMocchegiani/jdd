package usecase

import (
	"encoding/json"
	"math"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
)

type AreaSpellPayload struct {
	BloqueID string
	EcoID int
	PlayerID string
	Seq int
	ActionID string
	Target port.AreaTarget
}

func (s *Services) HandleAreaSpell(in AreaSpellPayload) (string, bool) {
	if s.Combat == nil || s.SwingPub == nil || in.PlayerID == "" || in.Seq <= 0 || !finite(in.Target.X) || !finite(in.Target.Y) || !finite(in.Target.Z) {
		return buildError("swing_error", "invalid_area_spell"), true
	}
	profile := s.Combat.Get(in.ActionID)
	if profile == nil || profile.Area == nil || profile.Area.Range <= 0 || profile.Area.Radius <= 0 || profile.Area.Damage <= 0 {
		return buildError("swing_error", "unknown_action"), true
	}
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists { return buildError("swing_error", "not_in_block"), true }
	cellX, cellY, cellZ := int(math.Floor(in.Target.X+0.5)), int(math.Floor(in.Target.Y+0.5)), int(math.Floor(in.Target.Z))
	if sess.SolidGrid == nil || !sess.SolidGrid.IsCellSolid(cellX, cellY, cellZ) {
		return buildError("swing_error", "invalid_area_target"), true
	}
	player, exists := sess.GetPlayer(in.PlayerID)
	if !exists || math.Sqrt(math.Pow(in.Target.X-player.X, 2)+math.Pow(in.Target.Y-player.Y, 2)+math.Pow(in.Target.Z-player.Z, 2)) > profile.Area.Range {
		return buildError("swing_error", "area_target_out_of_range"), true
	}
	if s.Conditions != nil && (s.Conditions.BlocksIntent(player.Conditions, profile.InputIntent) || s.Conditions.BlocksAction(player.Conditions, in.ActionID)) {
		return buildError("swing_error", "swing_rejected"), true
	}
	now := time.Now()
	reservation, ok := sess.BeginSwing(in.PlayerID, in.Seq, now, profile.Cooldown, profile.BlockedMediums)
	if !ok { return buildError("swing_error", "swing_rejected"), true }
	if !sess.SpendSwingMana(in.PlayerID, in.Seq, profile.ManaCost) {
		sess.CancelSwing(in.PlayerID, reservation)
		return buildError("swing_error", "swing_rejected"), true
	}
	cmd := port.SwingCommand{BloqueID:in.BloqueID, EcoID:in.EcoID, PlayerID:in.PlayerID, ActionID:in.ActionID, EntityID:int(reservation.EntityID), Seq:in.Seq, AreaTarget:&in.Target}
	if err := s.SwingPub.PublishSwing(cmd); err != nil {
		sess.CancelSwingAndRefundMana(in.PlayerID, reservation, profile.ManaCost)
		return buildError("swing_error", "enqueue_failed"), true
	}
	// The server resolves player damage from current authoritative positions; terrain damage uses the shared persistence resolver.
	var playerIDs []string
	sess.ForEachPlayer(func(p *entity.Player) {
		if p.ID != in.PlayerID && p.Health > 0 && math.Pow(p.X-in.Target.X, 2)+math.Pow(p.Y-in.Target.Y, 2) <= profile.Area.Radius*profile.Area.Radius && p.Z <= in.Target.Z+profile.Area.Radius+1.8 && p.Z >= in.Target.Z-profile.Area.Radius {
			playerIDs = append(playerIDs, p.ID)
		}
	})
	for _, id := range playerIDs {
		sess.UpdatePlayer(id, func(p *entity.Player) {
			if p.Health > 0 && math.Pow(p.X-in.Target.X, 2)+math.Pow(p.Y-in.Target.Y, 2) <= profile.Area.Radius*profile.Area.Radius && p.Z <= in.Target.Z+profile.Area.Radius+1.8 && p.Z >= in.Target.Z-profile.Area.Radius {
				p.Health = math.Max(0, p.Health-profile.Area.Damage)
			}
		})
	}
	sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) { p.InCombatUntil = now.Add(6*time.Second); p.ActionID = in.ActionID; p.ActionSeq++ })
	if s.Hub != nil {
		wire, _ := json.Marshal(map[string]interface{}{"type":"area_spell", "action_id":in.ActionID, "player_id":in.PlayerID, "effect":profile.Area.Effect, "x":in.Target.X, "y":in.Target.Y, "z":in.Target.Z, "radius":profile.Area.Radius})
		s.Hub.ForSession(in.BloqueID, in.EcoID, func(c *wshub.Conn) { wshub.SafeWrite(c, string(wire)) })
	}
	ack, _ := json.Marshal(map[string]interface{}{"type":"swing_queued", "seq":in.Seq, "entity_id":reservation.EntityID, "action_id":in.ActionID})
	return string(ack), false
}

func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
