// Package usecase applies configurable radial continuous-impact pulses.
package usecase

import (
	"context"
	"fmt"
	"math"
	"sort"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

func (s *SwingService) applyRadialImpact(ctx context.Context, cmd SwingCommand, profile *domain.CombatProfile) (SwingOutcome, error) {
	impact := profile.Impact
	if impact.Radius <= 0 || impact.Radius > 10 || impact.Damage <= 0 ||
		!finiteSwingCoordinate(cmd.PosX) || !finiteSwingCoordinate(cmd.PosY) || !finiteSwingCoordinate(cmd.PosZ) {
		return SwingOutcome{Error: "invalid_radial_impact", ActionID: cmd.ActionID}, nil
	}

	candidates, err := s.Repo.GetParticlesNear(ctx, cmd.BloqueID, cmd.PosX, cmd.PosY, cmd.PosZ, int(math.Ceil(impact.Radius))+1)
	if err != nil {
		return SwingOutcome{}, err
	}
	origin := jdcombat.Point{X: cmd.PosX, Y: cmd.PosY, Z: cmd.PosZ + 0.9}
	obstacles := make(map[[3]int]struct{}, len(candidates))
	for _, particle := range candidates {
		if isSolidParticle(particle) {
			obstacles[[3]int{particle.CeldaX, particle.CeldaY, particle.CeldaZ}] = struct{}{}
		}
	}
	visible := make([]domain.ParticleNear, 0, len(candidates))
	for _, particle := range candidates {
		if !isSolidParticle(particle) {
			continue
		}
		target := jdcombat.Point{X: float64(particle.CeldaX), Y: float64(particle.CeldaY), Z: float64(particle.CeldaZ)}
		if squaredDistance(origin, target) <= impact.Radius*impact.Radius && radialParticleVisible(origin, target, obstacles) {
			visible = append(visible, particle)
		}
	}
	sort.Slice(visible, func(i, j int) bool {
		a, b := visible[i], visible[j]
		da := squaredDistance(origin, jdcombat.Point{X: float64(a.CeldaX), Y: float64(a.CeldaY), Z: float64(a.CeldaZ)})
		db := squaredDistance(origin, jdcombat.Point{X: float64(b.CeldaX), Y: float64(b.CeldaY), Z: float64(b.CeldaZ)})
		if da != db {
			return da < db
		}
		return a.ID < b.ID
	})
	truncated := len(visible) > MaxWorldHitsPerSwing
	if truncated {
		visible = visible[:MaxWorldHitsPerSwing]
	}
	var hits []domain.DamageResult
	for _, particle := range visible {
		res, err := ApplyParticleDamage(ctx, s.Repo, ApplyDamageInput{
			BloqueID: cmd.BloqueID, ParticleID: particle.ID, Damage: impact.Damage,
			WeaponType: cmd.ActionID, RateLimiter: s.RateLimit,
		})
		if err != nil {
			return SwingOutcome{}, fmt.Errorf("apply radial particle %s: %w", particle.ID, err)
		}
		if res == nil {
			return SwingOutcome{}, fmt.Errorf("apply radial particle %s: empty damage result", particle.ID)
		}
		hits = append(hits, *res)
		s.publishParticleDestruction(ctx, cmd.BloqueID, res)
	}

	playerHits := make([]SwingPlayerHit, 0, len(cmd.Targets))
	seenPlayers := make(map[string]struct{}, len(cmd.Targets))
	playerRadius := impact.Radius + 0.45
	for _, target := range cmd.Targets {
		if target.PlayerID == "" || target.PlayerID == cmd.PlayerID || target.EntityID <= 0 ||
			!finiteSwingCoordinate(target.X) || !finiteSwingCoordinate(target.Y) || !finiteSwingCoordinate(target.Z) ||
			squaredDistance(origin, jdcombat.Point{X: target.X, Y: target.Y, Z: target.Z + 0.9}) > playerRadius*playerRadius {
			continue
		}
		if _, duplicate := seenPlayers[target.PlayerID]; duplicate {
			continue
		}
		seenPlayers[target.PlayerID] = struct{}{}
		playerHits = append(playerHits, SwingPlayerHit{PlayerID: target.PlayerID, EntityID: target.EntityID, Damage: impact.Damage})
	}
	sort.Slice(playerHits, func(i, j int) bool { return playerHits[i].PlayerID < playerHits[j].PlayerID })
	destroyed := 0
	for _, hit := range hits {
		if hit.Destroyed {
			destroyed++
		}
	}
	return s.publishSwingOutcome(ctx, cmd, SwingOutcome{
		OK: true, ActionID: cmd.ActionID, Hits: hits, DestroyedCount: destroyed,
		PlayerHits: playerHits, Truncated: truncated,
	})
}

func radialParticleVisible(origin, target jdcombat.Point, obstacles map[[3]int]struct{}) bool {
	dx, dy, dz := target.X-origin.X, target.Y-origin.Y, target.Z-origin.Z
	steps := int(math.Ceil(math.Sqrt(dx*dx+dy*dy+dz*dz) / 0.2))
	start := [3]int{int(math.Floor(origin.X)), int(math.Floor(origin.Y)), int(math.Floor(origin.Z))}
	end := [3]int{int(math.Floor(target.X)), int(math.Floor(target.Y)), int(math.Floor(target.Z))}
	for i := 1; i < steps; i++ {
		t := float64(i) / float64(steps)
		cell := [3]int{
			int(math.Floor(origin.X + dx*t)),
			int(math.Floor(origin.Y + dy*t)),
			int(math.Floor(origin.Z + dz*t)),
		}
		if cell != start && cell != end {
			if _, blocked := obstacles[cell]; blocked {
				return false
			}
		}
	}
	return true
}

func squaredDistance(a, b jdcombat.Point) float64 {
	dx, dy, dz := a.X-b.X, a.Y-b.Y, a.Z-b.Z
	return dx*dx + dy*dy + dz*dz
}
