// Package usecase — Casos de uso REST y combate.
package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"sync"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

const maxProcessedSwings = 4096

type SwingPlayerTarget struct {
	PlayerID string  `json:"player_id"`
	EntityID int     `json:"entity_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
}

type AreaTarget struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type SwingCommand struct {
	BloqueID   string              `json:"bloque_id"`
	EcoID      int                 `json:"eco_id"`
	PlayerID   string              `json:"player_id"`
	ActionID   string              `json:"action_id"`
	EntityID   int                 `json:"entity_id"`
	Seq        int                 `json:"seq"`
	PosX       float64             `json:"pos_x"`
	PosY       float64             `json:"pos_y"`
	PosZ       float64             `json:"pos_z"`
	Yaw        float64             `json:"yaw"`
	IsNPC      bool                `json:"is_npc"`
	Targets    []SwingPlayerTarget `json:"targets"`
	AreaTarget *AreaTarget         `json:"area_target,omitempty"`
	ParticleID string              `json:"particle_id"`
	ParticleX  int                 `json:"particle_x"`
	ParticleY  int                 `json:"particle_y"`
	ParticleZ  int                 `json:"particle_z"`
}

type SwingPlayerHit struct {
	PlayerID string  `json:"player_id"`
	EntityID int     `json:"entity_id"`
	Damage   float64 `json:"damage"`
}

type SwingOutcome struct {
	OK             bool
	Duplicate      bool
	Error          string
	ActionID       string
	Hits           []domain.DamageResult
	DestroyedCount int
	TargetPlayerID string
	TargetEntityID int
	EntityDamage   float64
	PlayerHits     []SwingPlayerHit
	BeamLength     float64
	Truncated      bool
}

type SwingService struct {
	Repo      port.ParticleRepository
	Catalog   port.CombatCatalog
	Events    port.EventPublisher
	RateLimit port.DestroyRateLimiter

	mu        sync.Mutex
	processed map[string]struct{}
}

func NewSwingService(repo port.ParticleRepository, cat port.CombatCatalog, ev port.EventPublisher, rl port.DestroyRateLimiter) *SwingService {
	return &SwingService{Repo: repo, Catalog: cat, Events: ev, RateLimit: rl, processed: make(map[string]struct{})}
}

func swingDedupKey(playerID, actionID string, entityID, seq int) string {
	if playerID != "" {
		return fmt.Sprintf("p:%s:%s:%d", playerID, actionID, seq)
	}
	return fmt.Sprintf("e:%d:%s:%d", entityID, actionID, seq)
}

func (s *SwingService) rememberSwing(playerID, actionID string, entityID, seq int) bool {
	key := swingDedupKey(playerID, actionID, entityID, seq)
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.processed[key]; ok {
		return false
	}
	s.processed[key] = struct{}{}
	if len(s.processed) > maxProcessedSwings {
		i := 0
		for k := range s.processed {
			delete(s.processed, k)
			i++
			if i >= maxProcessedSwings/2 {
				break
			}
		}
	}
	return true
}

type swingImpact struct {
	forward  float64
	particle *domain.ParticleNear
	player   *SwingPlayerTarget
}

func (s *SwingService) ApplySwing(ctx context.Context, cmd SwingCommand) (SwingOutcome, error) {
	if cmd.PlayerID == "" || cmd.Seq <= 0 {
		return SwingOutcome{Error: "invalid_swing", ActionID: cmd.ActionID}, nil
	}
	profile := s.Catalog.Get(cmd.ActionID)
	if profile == nil {
		return SwingOutcome{Error: "unknown_action", ActionID: cmd.ActionID}, nil
	}
	if !s.rememberSwing(cmd.PlayerID, cmd.ActionID, cmd.EntityID, cmd.Seq) {
		return SwingOutcome{OK: true, Duplicate: true, ActionID: cmd.ActionID}, nil
	}
	if cmd.ParticleID != "" {
		return s.applyProjectileParticleHit(ctx, cmd, profile)
	}
	if profile.Area != nil {
		return s.applyAreaSwing(ctx, cmd, profile)
	}
	if profile.Impact == nil {
		return SwingOutcome{OK: true, ActionID: cmd.ActionID}, nil
	}
	if profile.Impact.Shape == "radial" {
		return s.applyRadialImpact(ctx, cmd, profile)
	}

	impact := profile.Impact
	queryReach := int(math.Ceil(impact.Reach)) + 1
	candidates, err := s.Repo.GetParticlesNear(ctx, cmd.BloqueID, cmd.PosX, cmd.PosY, cmd.PosZ, queryReach)
	if err != nil {
		return SwingOutcome{}, err
	}
	origin := jdcombat.Point{X: cmd.PosX, Y: cmd.PosY, Z: cmd.PosZ}
	impacts := make([]swingImpact, 0, len(candidates)+len(cmd.Targets))
	for i := range candidates {
		p := candidates[i]
		if isSolidParticle(p) && jdcombat.HitsWorldCellWithWidth(origin, cmd.Yaw, p.CeldaX, p.CeldaY, p.CeldaZ, impact.Reach, impact.Width) {
			impacts = append(impacts, swingImpact{forward: jdcombat.ForwardDistance(origin, cmd.Yaw, float64(p.CeldaX), float64(p.CeldaY)), particle: &p})
		}
	}
	for i := range cmd.Targets {
		target := cmd.Targets[i]
		if target.PlayerID == "" || target.PlayerID == cmd.PlayerID || !jdcombat.HitsPlayerWithWidth(origin, cmd.Yaw, jdcombat.Point{X: target.X, Y: target.Y, Z: target.Z}, impact.Reach, impact.Width) {
			continue
		}
		impacts = append(impacts, swingImpact{forward: jdcombat.ForwardDistance(origin, cmd.Yaw, target.X, target.Y), player: &target})
	}
	sort.SliceStable(impacts, func(i, j int) bool {
		a, b := impacts[i], impacts[j]
		if a.forward != b.forward {
			return a.forward < b.forward
		}
		if (a.particle != nil) != (b.particle != nil) {
			return a.particle != nil
		}
		if a.particle != nil {
			return a.particle.ID < b.particle.ID
		}
		return a.player.PlayerID < b.player.PlayerID
	})

	remaining := impact.Damage
	var hits []domain.DamageResult
	worldHits, truncated := 0, false
	var targetPlayerID string
	var targetEntityID int
	var entityDamage float64
	beamLength, hasImpact := impact.Reach, false
	for _, hit := range impacts {
		if remaining <= 0 {
			break
		}
		if !hasImpact {
			beamLength, hasImpact = hit.forward, true
		}
		if hit.player != nil {
			targetPlayerID, targetEntityID, entityDamage = hit.player.PlayerID, hit.player.EntityID, remaining
			break
		}
		if worldHits >= MaxWorldHitsPerSwing {
			truncated = true
			break
		}
		res, err := ApplyParticleDamage(ctx, s.Repo, ApplyDamageInput{BloqueID: cmd.BloqueID, ParticleID: hit.particle.ID, Damage: remaining, WeaponType: cmd.ActionID, RateLimiter: s.RateLimit})
		if err != nil {
			return SwingOutcome{}, fmt.Errorf("apply swing particle %s: %w", hit.particle.ID, err)
		}
		if res == nil {
			return SwingOutcome{}, fmt.Errorf("apply swing particle %s: empty damage result", hit.particle.ID)
		}
		worldHits++
		hits = append(hits, *res)
		s.publishParticleDestruction(ctx, cmd.BloqueID, res)
		if !res.Destroyed {
			break
		}
		remaining = math.Max(0, remaining-res.ConsumedDamage)
		if res.ConsumedDamage <= 0 {
			break
		}
	}
	destroyed := 0
	for _, hit := range hits {
		if hit.Destroyed {
			destroyed++
		}
	}
	return s.publishSwingOutcome(ctx, cmd, SwingOutcome{OK: true, ActionID: cmd.ActionID, Hits: hits, DestroyedCount: destroyed, TargetPlayerID: targetPlayerID, TargetEntityID: targetEntityID, EntityDamage: entityDamage, BeamLength: beamLength, Truncated: truncated})
}

func (s *SwingService) applyAreaSwing(ctx context.Context, cmd SwingCommand, profile *domain.CombatProfile) (SwingOutcome, error) {
	if cmd.AreaTarget == nil || !finiteSwingCoordinate(cmd.AreaTarget.X) || !finiteSwingCoordinate(cmd.AreaTarget.Y) || !finiteSwingCoordinate(cmd.AreaTarget.Z) {
		return SwingOutcome{Error: "invalid_area_target", ActionID: cmd.ActionID}, nil
	}
	center, radius := cmd.AreaTarget, profile.Area.Radius
	candidates, err := s.Repo.GetParticlesNear(ctx, cmd.BloqueID, center.X, center.Y, center.Z, int(math.Ceil(radius))+1)
	if err != nil {
		return SwingOutcome{}, err
	}
	var hits []domain.DamageResult
	for _, p := range candidates {
		dx, dy, dz := float64(p.CeldaX)-center.X, float64(p.CeldaY)-center.Y, float64(p.CeldaZ)-center.Z
		if !isSolidParticle(p) || dx*dx+dy*dy+dz*dz > radius*radius {
			continue
		}
		if len(hits) >= MaxWorldHitsPerSwing {
			return s.publishSwingOutcome(ctx, cmd, SwingOutcome{OK: true, ActionID: cmd.ActionID, Hits: hits, Truncated: true})
		}
		res, err := ApplyParticleDamage(ctx, s.Repo, ApplyDamageInput{BloqueID: cmd.BloqueID, ParticleID: p.ID, Damage: profile.Area.Damage, WeaponType: cmd.ActionID, RateLimiter: s.RateLimit})
		if err != nil {
			return SwingOutcome{}, fmt.Errorf("apply area particle %s: %w", p.ID, err)
		}
		if res == nil {
			return SwingOutcome{}, fmt.Errorf("apply area particle %s: empty damage result", p.ID)
		}
		hits = append(hits, *res)
		s.publishParticleDestruction(ctx, cmd.BloqueID, res)
	}
	destroyed := 0
	for _, hit := range hits {
		if hit.Destroyed { destroyed++ }
	}
	return s.publishSwingOutcome(ctx, cmd, SwingOutcome{OK: true, ActionID: cmd.ActionID, Hits: hits, DestroyedCount: destroyed})
}

func finiteSwingCoordinate(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }

func (s *SwingService) applyProjectileParticleHit(ctx context.Context, cmd SwingCommand, profile *domain.CombatProfile) (SwingOutcome, error) {
	if profile.ProjectileDamage <= 0 {
		return SwingOutcome{Error: "invalid_projectile_hit", ActionID: cmd.ActionID}, nil
	}
	candidates, err := s.Repo.GetParticlesNear(ctx, cmd.BloqueID, float64(cmd.ParticleX), float64(cmd.ParticleY), float64(cmd.ParticleZ), 1)
	if err != nil { return SwingOutcome{}, err }
	var target *domain.ParticleNear
	for i := range candidates {
		p := candidates[i]
		if p.ID == cmd.ParticleID && p.CeldaX == cmd.ParticleX && p.CeldaY == cmd.ParticleY && p.CeldaZ == cmd.ParticleZ && isSolidParticle(p) {
			target = &p
			break
		}
	}
	var hits []domain.DamageResult
	if target != nil {
		result, err := ApplyParticleDamage(ctx, s.Repo, ApplyDamageInput{BloqueID: cmd.BloqueID, ParticleID: target.ID, Damage: profile.ProjectileDamage, WeaponType: cmd.ActionID, RateLimiter: s.RateLimit})
		if err != nil { return SwingOutcome{}, fmt.Errorf("apply projectile particle %s: %w", target.ID, err) }
		if result == nil { return SwingOutcome{}, fmt.Errorf("apply projectile particle %s: empty damage result", target.ID) }
		hits = append(hits, *result)
		s.publishParticleDestruction(ctx, cmd.BloqueID, result)
	}
	destroyed := 0
	for _, hit := range hits { if hit.Destroyed { destroyed++ } }
	return s.publishSwingOutcome(ctx, cmd, SwingOutcome{OK: true, ActionID: cmd.ActionID, Hits: hits, DestroyedCount: destroyed})
}

func (s *SwingService) publishSwingOutcome(ctx context.Context, cmd SwingCommand, out SwingOutcome) (SwingOutcome, error) {
	payload, err := buildSwingResultJSON(cmd, out)
	if err != nil { return out, err }
	if err := s.Events.PublishSwingResult(ctx, payload); err != nil { return out, fmt.Errorf("publish swing result: %w", err) }
	return out, nil
}

func buildSwingResultJSON(cmd SwingCommand, out SwingOutcome) (string, error) {
	hitPayload := make([]map[string]interface{}, 0, len(out.Hits))
	for _, hit := range out.Hits {
		hitPayload = append(hitPayload, map[string]interface{}{"particle_id": hit.ParticleID, "destroyed": hit.Destroyed, "integridad": hit.NuevaIntegridad})
	}
	payload := map[string]interface{}{
		"type": "swing_result", "seq": cmd.Seq, "entity_id": cmd.EntityID, "player_id": cmd.PlayerID, "eco_id": cmd.EcoID,
		"action_id": cmd.ActionID, "bloque_id": cmd.BloqueID, "hits": hitPayload, "player_hits": out.PlayerHits,
		"target_player_id": out.TargetPlayerID, "target_entity_id": out.TargetEntityID,
		"entity_damage": out.EntityDamage, "beam_length": out.BeamLength, "truncated": out.Truncated,
	}
	b, err := json.Marshal(payload)
	return string(b), err
}
