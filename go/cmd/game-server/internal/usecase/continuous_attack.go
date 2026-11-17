package usecase

import (
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

// advanceContinuousAttack cobra maná mientras el intent siga activo y entrega un comando al vencer cada intervalo.
// El llamador publica el comando y revierte el coste del intervalo si el enqueue falla.
func (s *Services) advanceContinuousAttack(sess *entity.BlockSession, p *entity.Player, deltaSec float64, now time.Time) (port.SwingCommand, bool) {
	if p.ContinuousAttackID == "" {
		return port.SwingCommand{}, false
	}
	profile := s.Combat.Get(p.ContinuousAttackID)
	if profile == nil || profile.ControlType != "sustained" || profile.Impact == nil || profile.DamageInterval <= 0 || profile.ManaCostPerSecond <= 0 || s.SwingPub == nil || p.Health <= 0 || !p.Intents[profile.InputIntent] || mediumBlocked(p.Medium, profile.BlockedMediums) || (s.Conditions != nil && (s.Conditions.BlocksIntent(p.Conditions, profile.InputIntent) || s.Conditions.BlocksAction(p.Conditions, p.ContinuousAttackID))) {
		p.ContinuousAttackID, p.ContinuousAttackElapsed = "", 0
		return port.SwingCommand{}, false
	}
	cost := profile.ManaCostPerSecond * deltaSec
	if p.Mana+1e-9 < cost {
		p.ContinuousAttackID, p.ContinuousAttackElapsed = "", 0
		return port.SwingCommand{}, false
	}
	p.Mana -= cost
	p.InCombatUntil = now.Add(6 * time.Second)
	p.ContinuousAttackElapsed += deltaSec
	interval := profile.DamageInterval.Seconds()
	if p.ContinuousAttackElapsed < interval {
		return port.SwingCommand{}, false
	}
	p.ContinuousAttackElapsed -= interval
	seq := sess.ServerTick + 1
	if seq <= p.ContinuousAttackSeq {
		seq = p.ContinuousAttackSeq + 1
	}
	p.ContinuousAttackSeq = seq
	return port.SwingCommand{BloqueID: sess.BloqueID, EcoID: sess.EcoID, PlayerID: p.ID, ActionID: p.ContinuousAttackID, EntityID: int(p.EntityID), Seq: seq, PosX: p.X, PosY: p.Y, PosZ: p.Z, Yaw: p.Yaw}, true
}
