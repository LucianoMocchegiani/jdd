package usecase

import (
	"encoding/json"
	"math"
	"time"

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

// HandleAreaSpell validates a selected point, then casts an area spell or teleports there.
func (s *Services) HandleAreaSpell(in AreaSpellPayload) (string, bool) {
	if s.Combat == nil || in.PlayerID == "" || in.Seq <= 0 ||
		!finiteAreaCoordinate(in.Target.X) || !finiteAreaCoordinate(in.Target.Y) || !finiteAreaCoordinate(in.Target.Z) {
		return buildError("swing_error", "invalid_area_spell"), true
	}
	profile := s.Combat.Get(in.ActionID)
	if profile == nil || profile.Targeting == nil || profile.Targeting.Type != "ground_point" || profile.Targeting.Range <= 0 {
		return buildError("swing_error", "unknown_action"), true
	}
	teleport := profile.Targeting.Effect == "teleport"
	if teleport {
		if profile.Impact != nil || profile.ManaCost <= 0 {
			return buildError("swing_error", "unknown_action"), true
		}
	} else if profile.Impact == nil || profile.Impact.Shape != "radial" || profile.Impact.Origin != "target" || profile.Impact.Radius <= 0 || profile.Impact.Damage <= 0 {
		return buildError("swing_error", "unknown_action"), true
	}
	if !teleport && s.SwingPub == nil {
		return buildError("swing_error", "not_configured"), true
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
	if teleport {
		if !teleportDestinationFree(sess, in.PlayerID, in.Target, cellX, cellY, cellZ) {
			return buildError("swing_error", "invalid_teleport_destination"), true
		}
		return s.executeOneShotAction(sess, in.PlayerID, in.ActionID, in.Seq, profile,
			func(entity.ActionSwingReservation) string { return "" }, func() {
				destinationZ := float64(cellZ + 1)
				sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) {
					p.X, p.Y, p.Z = in.Target.X, in.Target.Y, destinationZ
					p.VX, p.VY, p.VZ = 0, 0, 0
					p.DashRemaining, p.DashVX, p.DashVY = 0, 0, 0
				})
			})
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
			var targets []struct {
				playerID string
				entityID uint32
			}
			sess.ForEachPlayer(func(p *entity.Player) {
				if p.ID != in.PlayerID && p.Health > 0 && insideArea(p, in.Target, profile.Impact.Radius) {
					targets = append(targets, struct {
						playerID string
						entityID uint32
					}{p.ID, p.EntityID})
				}
			})
			for _, target := range targets {
				sess.ApplyPlayerDamageFrom(in.PlayerID, target.playerID, int(target.entityID), profile.Impact.Damage, time.Now())
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

func teleportDestinationFree(sess *entity.BlockSession, playerID string, target port.AreaTarget, cellX, cellY, floorZ int) bool {
	destinationZ := float64(floorZ + 1)
	if sess.SolidGrid.IsBodyBlocked(cellX, cellY, floorZ+1) {
		return false
	}
	occupied := false
	sess.ForEachPlayer(func(other *entity.Player) {
		if other.ID == playerID || other.Health <= 0 {
			return
		}
		dx, dy := other.X-target.X, other.Y-target.Y
		if dx*dx+dy*dy < 0.9*0.9 && math.Abs(other.Z-destinationZ) < 2 {
			occupied = true
		}
	})
	return !occupied
}

// insideArea tests player-body centers against the same radial impact used for particles.
func insideArea(p *entity.Player, target port.AreaTarget, radius float64) bool {
	dx, dy, dz := p.X-target.X, p.Y-target.Y, p.Z+0.9-target.Z
	radius += 0.45
	return dx*dx+dy*dy+dz*dz <= radius*radius
}

func finiteAreaCoordinate(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
