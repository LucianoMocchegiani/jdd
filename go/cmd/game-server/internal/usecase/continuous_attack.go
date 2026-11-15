package usecase

import (
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

func (s *Services) advanceContinuousAttack(sess *entity.BlockSession, p *entity.Player, deltaSec float64, now time.Time) (port.SwingCommand, bool) {
	if p.ContinuousAttackID == "" { return port.SwingCommand{}, false }
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
	if p.ContinuousAttackElapsed < interval { return port.SwingCommand{}, false }
	p.ContinuousAttackElapsed -= interval
	seq := sess.ServerTick + 1
	if seq <= p.ContinuousAttackSeq { seq = p.ContinuousAttackSeq + 1 }
	p.ContinuousAttackSeq = seq
	origin := jdcombat.Point{X: p.X, Y: p.Y, Z: p.Z}
	targets := make([]port.SwingTarget, 0)
	for id, target := range sess.Players {
		if id != p.ID && target.Health > 0 && jdcombat.HitsPlayerWithWidth(origin, p.Yaw, jdcombat.Point{X: target.X, Y: target.Y, Z: target.Z}, profile.Impact.Reach, profile.Impact.Width) {
			targets = append(targets, port.SwingTarget{PlayerID: target.ID, EntityID: int(target.EntityID), X: target.X, Y: target.Y, Z: target.Z})
		}
	}
	return port.SwingCommand{BloqueID: sess.BloqueID, EcoID: sess.EcoID, PlayerID: p.ID, ActionID: p.ContinuousAttackID, EntityID: int(p.EntityID), Seq: seq, PosX: p.X, PosY: p.Y, PosZ: p.Z, Yaw: p.Yaw, Targets: targets}, true
}
