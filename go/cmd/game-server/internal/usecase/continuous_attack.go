package usecase

import (
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

func (s *Services) advanceContinuousAttack(sess *entity.BlockSession, p *entity.Player, deltaSec float64, now time.Time) (port.SwingCommand, bool) {
	if p.ContinuousAttackID == "" { return port.SwingCommand{}, false }
	profile := s.Combat.Get(p.ContinuousAttackID)
	valid := profile != nil && profile.ControlType == "sustained" && profile.ManaCostPerSecond > 0 && p.Health > 0 && p.Intents[profile.InputIntent] &&
		!mediumBlocked(p.Medium, profile.BlockedMediums) && (s.Conditions == nil || (!s.Conditions.BlocksIntent(p.Conditions, profile.InputIntent) && !s.Conditions.BlocksAction(p.Conditions, p.ContinuousAttackID)))
	if valid && profile.Defense != nil { valid = profile.Defense.Shape == "radial" && profile.Impact == nil
	} else if valid { valid = profile.Impact != nil && profile.DamageInterval > 0 && s.SwingPub != nil }
	stop := func() {
		if profile != nil && profile.Defense != nil { sess.RemoveKiShield(p.ID) }
		p.ContinuousAttackID, p.ContinuousAttackElapsed = "", 0
	}
	if !valid { stop(); return port.SwingCommand{}, false }
	if profile.Defense != nil {
		if _, active := sess.KiShieldStates(now)[p.ID]; !active { stop(); return port.SwingCommand{}, false }
	}
	cost := profile.ManaCostPerSecond * deltaSec
	if p.Mana+1e-9 < cost { stop(); return port.SwingCommand{}, false }
	p.Mana -= cost
	p.InCombatUntil = now.Add(6 * time.Second)
	p.ContinuousAttackElapsed += deltaSec
	if profile.Defense != nil { return port.SwingCommand{}, false }
	interval := profile.DamageInterval.Seconds()
	if p.ContinuousAttackElapsed < interval { return port.SwingCommand{}, false }
	p.ContinuousAttackElapsed -= interval
	seq := sess.ServerTick + 1
	if seq <= p.ContinuousAttackSeq { seq = p.ContinuousAttackSeq + 1 }
	p.ContinuousAttackSeq = seq
	return port.SwingCommand{BloqueID: sess.BloqueID, EcoID: sess.EcoID, PlayerID: p.ID, ActionID: p.ContinuousAttackID, EntityID: int(p.EntityID), Seq: seq, PosX: p.X, PosY: p.Y, PosZ: p.Z, Yaw: p.Yaw}, true
}
