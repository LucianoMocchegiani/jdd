package entity

import (
	"math"
	"time"
)

// KiShield is an independent session object with its own cone and absorption budget.
type KiShield struct {
	Remaining    float64
	AngleDegrees float64
	ExpiresAt    time.Time
}

func (s *BlockSession) CreateKiShield(playerID string, absorption, angleDegrees float64, duration time.Duration, now time.Time) bool {
	if absorption <= 0 || math.IsNaN(absorption) || math.IsInf(absorption, 0) || angleDegrees <= 0 || angleDegrees > 180 || duration <= 0 {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	player := s.Players[playerID]
	if player == nil || player.Health <= 0 {
		return false
	}
	if s.kiShields == nil {
		s.kiShields = make(map[string]*KiShield)
	}
	s.kiShields[playerID] = &KiShield{Remaining: absorption, AngleDegrees: angleDegrees, ExpiresAt: now.Add(duration)}
	return true
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
	s.applyShieldDamageLocked(s.Players[sourceID], targetID, target, damage, now)
	return true
}

func (s *BlockSession) applyShieldDamageLocked(source *Player, targetID string, target *Player, damage float64, now time.Time) {
	shield := s.kiShields[targetID]
	if shield != nil {
		if !now.Before(shield.ExpiresAt) || shield.Remaining <= 0 {
			delete(s.kiShields, targetID)
		} else if source != nil && source.ID != target.ID {
			dx, dy := source.X-target.X, source.Y-target.Y
			length := math.Hypot(dx, dy)
			if length > 0 {
				facingDot := (dx*-math.Sin(target.Yaw) + dy*-math.Cos(target.Yaw)) / length
				if facingDot >= math.Cos(shield.AngleDegrees*math.Pi/360) {
					absorbed := math.Min(damage, shield.Remaining)
					shield.Remaining -= absorbed
					damage -= absorbed
					if shield.Remaining <= 0 {
						delete(s.kiShields, targetID)
					}
				}
			}
		}
	}
	target.Health = math.Max(0, target.Health-damage)
}

func (s *BlockSession) KiShieldStates(now time.Time) map[string]float64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]float64)
	for id, shield := range s.kiShields {
		player := s.Players[id]
		if player == nil || player.Health <= 0 || !now.Before(shield.ExpiresAt) || shield.Remaining <= 0 {
			delete(s.kiShields, id)
			continue
		}
		out[id] = shield.Remaining
	}
	return out
}
