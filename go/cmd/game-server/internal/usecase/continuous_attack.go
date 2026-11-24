package usecase

import (
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

// advanceContinuousAttack drains mana while the configured intent remains active and emits damage pulses when due.
// The caller publishes the command and refunds one interval's cost if enqueueing fails.
func (s *Services) advanceContinuousAttack(sess *entity.BlockSession, p *entity.Player, deltaSec float64, now time.Time, shieldActive bool) (port.SwingCommand, bool, bool) {
	if p.ContinuousAttackID == "" { return port.SwingCommand{}, false, false }
	profile := s.Combat.Get(p.ContinuousAttackID)
	valid := profile != nil && profile.ControlType == "sustained" && profile.ManaCostPerSecond > 0 && p.Health > 0 && p.Intents[profile.InputIntent] &&
		!mediumBlocked(p.Medium, profile.BlockedMediums) && (s.Conditions == nil || (!s.Conditions.BlocksIntent(p.Conditions, profile.InputIntent) && !s.Conditions.BlocksAction(p.Conditions, p.ContinuousAttackID)))
	if valid && profile.Defense != nil {
		valid = profile.Defense.Shape == "radial" && profile.Impact == nil
	} else if valid {
		valid = profile.Impact != nil && profile.DamageInterval > 0 && s.SwingPub != nil
	}
	stop := func() bool {
		p.ContinuousAttackID, p.ContinuousAttackElapsed = "", 0
		return profile != nil && profile.Defense != nil
	}
	if !valid { return port.SwingCommand{}, false, stop() }
	if profile.Defense != nil && !shieldActive { stop(); return port.SwingCommand{}, false, true }
	cost := profile.ManaCostPerSecond * deltaSec
	if p.Mana+1e-9 < cost { return port.SwingCommand{}, false, stop() }
	p.Mana -= cost
	p.InCombatUntil = now.Add(6 * time.Second)
	p.ContinuousAttackElapsed += deltaSec
	if profile.Defense != nil { return port.SwingCommand{}, false, false }
	interval := profile.DamageInterval.Seconds()
	if p.ContinuousAttackElapsed < interval { return port.SwingCommand{}, false, false }
	p.ContinuousAttackElapsed -= interval
	seq := sess.ServerTick + 1
	if seq <= p.ContinuousAttackSeq { seq = p.ContinuousAttackSeq + 1 }
	p.ContinuousAttackSeq = seq
	return port.SwingCommand{BloqueID: sess.BloqueID, EcoID: sess.EcoID, PlayerID: p.ID, ActionID: p.ContinuousAttackID, EntityID: int(p.EntityID), Seq: seq, PosX: p.X, PosY: p.Y, PosZ: p.Z, Yaw: p.Yaw}, true, false
}
