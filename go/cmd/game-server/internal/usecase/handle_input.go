// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

type SwingPayload struct {
	BloqueID string
	EcoID    int
	PlayerID string
	ActionID string
	Seq      int
}

// HandleSwing validates and queues a server-positioned melee strike or projectile.
func (s *Services) HandleSwing(in SwingPayload) (responseJSON string, isError bool) {
	if in.PlayerID == "" {
		return buildError("swing_error", "missing_player_id"), true
	}
	sess, ok := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !ok {
		return buildError("swing_error", "session_not_found"), true
	}
	if s.Combat == nil {
		return buildError("swing_error", "not_configured"), true
	}
	profile := s.Combat.Get(in.ActionID)
	if profile == nil || (profile.Impact == nil && profile.Projectile == nil) {
		return buildError("swing_error", "unknown_action"), true
	}
	if s.SwingPub == nil {
		return buildError("swing_error", "not_configured"), true
	}
	reservation, ok := sess.BeginSwing(in.PlayerID, in.Seq, time.Now(), profile.Cooldown, profile.BlockedMediums)
	if !ok {
		return buildError("swing_error", "swing_rejected"), true
	}
	if profile.Projectile != nil {
		p := profile.Projectile
		if !sess.SpawnProjectile(in.PlayerID, in.ActionID, reservation, p.Speed, p.Range, p.Damage, p.Radius, p.Delay) {
			sess.CancelSwing(in.PlayerID, reservation)
			return buildError("swing_error", "projectile_rejected"), true
		}
	} else {
		origin := jdcombat.Point{X: reservation.X, Y: reservation.Y, Z: reservation.Z}
		targets := make([]port.SwingTarget, 0)
		sess.ForEachPlayer(func(p *entity.Player) {
			if p.ID != in.PlayerID && p.Health > 0 && jdcombat.HitsPlayer(origin, reservation.Yaw, jdcombat.Point{X: p.X, Y: p.Y, Z: p.Z}, profile.Impact.Reach) {
				targets = append(targets, port.SwingTarget{PlayerID: p.ID, EntityID: int(p.EntityID), X: p.X, Y: p.Y, Z: p.Z})
			}
		})
		if err := s.SwingPub.PublishSwing(port.SwingCommand{
			BloqueID: in.BloqueID, EcoID: in.EcoID, PlayerID: in.PlayerID, ActionID: in.ActionID,
			EntityID: int(reservation.EntityID), Seq: in.Seq,
			PosX: reservation.X, PosY: reservation.Y, PosZ: reservation.Z, Yaw: reservation.Yaw,
			Targets: targets,
		}); err != nil {
			sess.CancelSwing(in.PlayerID, reservation)
			return buildError("swing_error", "enqueue_failed"), true
		}
	}
	ack, _ := json.Marshal(map[string]interface{}{
		"type": "swing_queued", "seq": in.Seq, "entity_id": reservation.EntityID, "action_id": in.ActionID,
	})
	return string(ack), false
}
