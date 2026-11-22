package usecase

import (
	"encoding/json"
	"math"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
)

// AreaSpellPayload identifies the selected target for a server-validated point cast.
type AreaSpellPayload struct {
	BloqueID string
	EcoID    int
	PlayerID string
	Seq      int
	ActionID string
	Target   port.AreaTarget
}

// HandleAreaSpell validates target selection independently from the radial impact profile.
func (s *Services) HandleAreaSpell(in AreaSpellPayload) (string, bool) {
	if s.Combat == nil || s.SwingPub == nil || in.PlayerID == "" || in.Seq <= 0 ||
		!finiteAreaCoordinate(in.Target.X) || !finiteAreaCoordinate(in.Target.Y) || !finiteAreaCoordinate(in.Target.Z) {
		return buildError("swing_error", "invalid_area_spell"), true
	}
	profile := s.Combat.Get(in.ActionID)
	if profile == nil || profile.Targeting == nil || profile.Targeting.Type != "ground_point" ||
		profile.Impact == nil || profile.Impact.Shape != "radial" || profile.Impact.Origin != "target" ||
		profile.Targeting.Range <= 0 || profile.Impact.Radius <= 0 || profile.Impact.Damage <= 0 {
		return buildError("swing_error", "unknown_action"), true
	}
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists {
		return buildError("swing_error", "not_in_block"), true
	}
	player, exists := sess.GetPlayer(in.PlayerID)
	if !exists {
		return buildError("swing_error", "player_not_in_session"), true
	}
	dx, dy, dz := in.Target.X-player.X, in.Target.Y-player.Y, in.Target.Z-player.Z
	if math.Sqrt(dx*dx+dy*dy+dz*dz) > profile.Targeting.Range {
		return buildError("swing_error", "area_target_out_of_range"), true
	}
	cellX := int(math.Floor(in.Target.X + 0.5))
	cellY := int(math.Floor(in.Target.Y + 0.5))
	cellZ := int(math.Floor(in.Target.Z))
	if sess.SolidGrid == nil || !sess.SolidGrid.IsCellSolid(cellX, cellY, cellZ) ||
		in.Target.Z-float64(cellZ) < 0.35 || in.Target.Z-float64(cellZ) > 0.55 {
		return buildError("swing_error", "invalid_area_target"), true
	}
	if s.Conditions != nil && (s.Conditions.BlocksIntent(player.Conditions, profile.InputIntent) || s.Conditions.BlocksAction(player.Conditions, in.ActionID)) {
		return buildError("swing_error", "swing_rejected"), true
	}

	return s.executeOneShotAction(sess, in.PlayerID, in.ActionID, in.Seq, profile,
		func(reservation entity.ActionSwingReservation) string {
			cmd := port.SwingCommand{
				BloqueID: in.BloqueID, EcoID: in.EcoID, PlayerID: in.PlayerID,
				ActionID: in.ActionID, EntityID: int(reservation.EntityID), Seq: in.Seq,
				AreaTarget: &in.Target,
			}
			if err := s.SwingPub.PublishSwing(cmd); err != nil {
				return "enqueue_failed"
			}
			return ""
		}, func() {
			var playerIDs []string
			sess.ForEachPlayer(func(p *entity.Player) {
				if p.ID != in.PlayerID && p.Health > 0 && insideArea(p, in.Target, profile.Impact.Radius) {
					playerIDs = append(playerIDs, p.ID)
				}
			})
			for _, id := range playerIDs {
				sess.UpdatePlayer(id, func(p *entity.Player) {
					if p.Health > 0 && insideArea(p, in.Target, profile.Impact.Radius) {
						p.Health = math.Max(0, p.Health-profile.Impact.Damage)
					}
				})
			}
			if s.Hub != nil {
				wire, _ := json.Marshal(map[string]interface{}{
					"type": "area_spell", "action_id": in.ActionID, "player_id": in.PlayerID,
					"effect": profile.Targeting.Effect, "x": in.Target.X, "y": in.Target.Y,
					"z": in.Target.Z, "radius": profile.Impact.Radius,
				})
				s.Hub.ForSession(in.BloqueID, in.EcoID, func(c *wshub.Conn) { wshub.SafeWrite(c, string(wire)) })
			}
		})
}

// insideArea tests player-body centers against the same radial impact used for particles.
func insideArea(p *entity.Player, target port.AreaTarget, radius float64) bool {
	dx, dy, dz := p.X-target.X, p.Y-target.Y, p.Z+0.9-target.Z
	radius += 0.45
	return dx*dx+dy*dy+dz*dz <= radius*radius
}

func finiteAreaCoordinate(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
