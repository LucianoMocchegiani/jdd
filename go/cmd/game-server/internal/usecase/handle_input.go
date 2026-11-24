// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

type InputPayload struct {
	BloqueID string
	EcoID    int
	PlayerID string
	Seq      int
	Intents  map[string]bool
	Yaw      *float64
	Pitch    *float64
}

type inputActionCatalog interface { GetByInputIntent(intent string) (string, *port.CombatProfile) }

var oneShotActionIntents = [...]string{"attack_light", "attack_projectile", "attack_heavy", "attack_quick_projectile", "attack_shockwave", "attack_ki_shield"}
var sustainedActionIntents = [...]string{"continuous_attack", "continuous_aura", "continuous_ki_shield"}

func (s *Services) HandleInput(in InputPayload) (errJSON string, ok bool) {
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists { return buildError("input_error", "not_in_block"), false }

	var actionID, startedSustainedID, stoppedSustainedID string
	stale := false
	updated := sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) {
		if in.Seq != 0 && in.Seq <= p.InputSeq { stale = true; return }
		if in.Seq != 0 { p.InputSeq = in.Seq }
		if in.Intents != nil {
			if in.Seq > 0 {
				if catalog, ok := s.Combat.(inputActionCatalog); ok {
					for _, intent := range oneShotActionIntents {
						if in.Intents[intent] && !p.Intents[intent] && (s.Conditions == nil || !s.Conditions.BlocksIntent(p.Conditions, intent)) {
							if id, profile := catalog.GetByInputIntent(intent); profile != nil && profile.ControlType != "sustained" && (profile.Impact != nil || profile.Defense != nil) {
								actionID = id
								break
							}
						}
					}
					previousID := p.ContinuousAttackID
					if id, profile := s.selectSustainedAction(catalog, p, in.Intents); profile != nil {
						if previousID != id {
							p.ContinuousAttackID, p.ContinuousAttackElapsed = id, 0
							p.ActionID, p.ActionSeq = id, p.ActionSeq+1
							startedSustainedID = id
							stoppedSustainedID = previousID
						}
						p.InCombatUntil = time.Now().Add(6 * time.Second)
					} else {
						p.ContinuousAttackID, p.ContinuousAttackElapsed = "", 0
						stoppedSustainedID = previousID
					}
				}
			}
			p.Intents = in.Intents
		}
		if in.Yaw != nil { p.Yaw = *in.Yaw }
		if in.Pitch != nil { p.Pitch = *in.Pitch }
	})
	if !updated { return buildError("input_error", "player_not_in_session"), false }
	if stale { return "", true }
	if stoppedSustainedID != "" {
		if profile := s.Combat.Get(stoppedSustainedID); profile != nil && profile.Defense != nil { sess.RemoveKiShield(in.PlayerID) }
	}
	if startedSustainedID != "" {
		if profile := s.Combat.Get(startedSustainedID); profile != nil && profile.Defense != nil &&
			!sess.CreateKiShield(in.PlayerID, profile.Defense.Shape, profile.Defense.Absorption, profile.Defense.AngleDegrees, profile.Defense.Duration, time.Now()) {
			sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) { if p.ContinuousAttackID == startedSustainedID { p.ContinuousAttackID, p.ContinuousAttackElapsed = "", 0 } })
			return buildError("input_error", "shield_rejected"), true
		}
	}
	if actionID != "" {
		if profile := s.Combat.Get(actionID); profile != nil && profile.Defense != nil {
			response, _ := s.HandleKiShield(SwingPayload{BloqueID: in.BloqueID, EcoID: in.EcoID, PlayerID: in.PlayerID, ActionID: actionID, Seq: in.Seq})
			return response, true
		}
		response, _ := s.HandleSwing(SwingPayload{BloqueID: in.BloqueID, EcoID: in.EcoID, PlayerID: in.PlayerID, ActionID: actionID, Seq: in.Seq})
		return response, true
	}
	return "", true
}

func (s *Services) selectSustainedAction(catalog inputActionCatalog, p *entity.Player, intents map[string]bool) (string, *port.CombatProfile) {
	valid := func(id string, profile *port.CombatProfile) bool {
		if profile == nil || profile.ControlType != "sustained" || profile.ManaCostPerSecond <= 0 || p.Health <= 0 || p.Mana <= 0 || mediumBlocked(p.Medium, profile.BlockedMediums) ||
			(s.Conditions != nil && (s.Conditions.BlocksIntent(p.Conditions, profile.InputIntent) || s.Conditions.BlocksAction(p.Conditions, id))) { return false }
		if profile.Defense != nil { return profile.Defense.Shape == "radial" && profile.Impact == nil }
		return profile.Impact != nil && profile.DamageInterval > 0 && s.SwingPub != nil
	}
	for _, intent := range sustainedActionIntents {
		if intents[intent] && !p.Intents[intent] {
			if id, profile := catalog.GetByInputIntent(intent); valid(id, profile) { return id, profile }
		}
	}
	if profile := s.Combat.Get(p.ContinuousAttackID); profile != nil && intents[profile.InputIntent] && valid(p.ContinuousAttackID, profile) {
		return p.ContinuousAttackID, profile
	}
	for _, intent := range sustainedActionIntents {
		if intents[intent] {
			if id, profile := catalog.GetByInputIntent(intent); valid(id, profile) { return id, profile }
		}
	}
	return "", nil
}

type SwingPayload struct { BloqueID string; EcoID int; PlayerID string; ActionID string; Seq int }

func (s *Services) HandleSwing(in SwingPayload) (responseJSON string, isError bool) {
	if in.PlayerID == "" { return buildError("swing_error", "missing_player_id"), true }
	sess, exists := s.Sessions.Get(in.BloqueID, in.EcoID)
	if !exists { return buildError("swing_error", "not_in_block"), true }
	if s.Combat == nil { return buildError("swing_error", "not_configured"), true }
	profile := s.Combat.Get(in.ActionID)
	if profile == nil || profile.Impact == nil || profile.ControlType == "sustained" { return buildError("swing_error", "unknown_action"), true }
	blocked := false
	if s.Conditions != nil { sess.UpdatePlayer(in.PlayerID, func(p *entity.Player) { blocked = s.Conditions.BlocksAction(p.Conditions, in.ActionID) }) }
	if blocked { return buildError("swing_error", "swing_rejected"), true }
	if s.SwingPub == nil { return buildError("swing_error", "not_configured"), true }
	return s.executeOneShotAction(sess, in.PlayerID, in.ActionID, in.Seq, profile,
		func(reservation entity.ActionSwingReservation) string {
			pose := reservation.SwingReservation
			if profile.Impact.Shape == "projectile" {
				p := profile.Impact
				if !sess.SpawnProjectile(in.PlayerID, in.ActionID, pose, p.Speed, p.Reach, p.Damage, p.Radius, time.Duration(p.DelayMs)*time.Millisecond) { return "projectile_rejected" }
				return ""
			}
			cmd := port.SwingCommand{BloqueID: in.BloqueID, EcoID: in.EcoID, PlayerID: in.PlayerID, ActionID: in.ActionID, EntityID: int(pose.EntityID), Seq: in.Seq, PosX: pose.X, PosY: pose.Y, PosZ: pose.Z, Yaw: pose.Yaw}
			cmd.Targets = snapshotSwingTargets(sess, cmd, profile)
			if err := s.SwingPub.PublishSwing(cmd); err != nil { return "enqueue_failed" }
			return ""
		}, nil)
}

func mediumBlocked(medium string, blocked []string) bool {
	for _, blockedMedium := range blocked { if medium == blockedMedium { return true } }
	return false
}

func buildError(msgType, code string) string { b, _ := json.Marshal(map[string]string{"type": msgType, "error": code}); return string(b) }
