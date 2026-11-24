package entity

import (
	"math"
	"time"
)

// KiShield is a separate defensive object owned by a player, with its own cone and absorption budget.
type KiShield struct {
	Remaining   float64
	AngleDegrees float64
	ExpiresAt   time.Time
}

func (s *BlockSession) CreateKiShield(playerID string, absorption, angleDegrees float64, duration time.Duration, now time.Time) bool {
	if absorption <= 0 || math.IsNaN(absorption) || math.IsInf(absorption, 0) ||
		angleDegrees <= 0 || angleDegrees > 180 || duration <= 0 {
		return false
	}
	return s.UpdatePlayer(playerID, func(p *Player) {
		if p.Health > 0 {
			p.KiShield = &KiShield{Remaining: absorption, AngleDegrees: angleDegrees, ExpiresAt: now.Add(duration)}
		}
	}) && func() bool { p, ok := s.GetPlayer(playerID); return ok && p.Health > 0 }()
}

// ApplyPlayerDamageFrom routes authoritative player damage through the shield object before health.
func (s *BlockSession) ApplyPlayerDamageFrom(sourceID, targetID string, entityID int, damage float64, now time.Time) bool {
	if damage <= 0 || math.IsNaN(damage) || math.IsInf(damage, 0) {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	target := s.Players[targetID]
	if target == nil || target.EntityID != uint32(entityID) || target.Health <= 0 {
		return false
	}
	s.applyShieldDamageLocked(s.Players[sourceID], target, damage, now)
	return true
}

func (s *BlockSession) applyShieldDamageLocked(source, target *Player, damage float64, now time.Time) {
	shield := target.KiShield
	if shield != nil {
		if !now.Before(shield.ExpiresAt) || shield.Remaining <= 0 {
			target.KiShield = nil
		} else if source != nil && source.ID != target.ID {
			dx, dy := source.X-target.X, source.Y-target.Y
			length := math.Hypot(dx, dy)
			facingDot := (dx*-math.Sin(target.Yaw) + dy*-math.Cos(target.Yaw)) / length
			if length > 0 && facingDot >= math.Cos(shield.AngleDegrees*math.Pi/360) {
				absorbed := math.Min(damage, shield.Remaining)
				shield.Remaining -= absorbed
				damage -= absorbed
				if shield.Remaining <= 0 {
					target.KiShield = nil
				}
			}
		}
	}
	target.Health = math.Max(0, target.Health-damage)
}

// KiShieldStates returns live shield objects and their remaining absorption for replication.
func (s *BlockSession) KiShieldStates(now time.Time) map[string]float64 {
	out := make(map[string]float64)
	s.ForEachPlayer(func(p *Player) {
		if p.KiShield != nil && now.Before(p.KiShield.ExpiresAt) && p.KiShield.Remaining > 0 {
			out[p.ID] = p.KiShield.Remaining
		} else if p.KiShield != nil && !now.Before(p.KiShield.ExpiresAt) {
			p.KiShield = nil
		}
	})
	return out
}
