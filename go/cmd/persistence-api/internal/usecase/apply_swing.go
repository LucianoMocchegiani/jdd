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

// SwingPlayerTarget is a position snapshot supplied by the authoritative game server.
type SwingPlayerTarget struct {
	PlayerID string  `json:"player_id"`
	EntityID int     `json:"entity_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
}

// SwingCommand representa swing command.
type SwingCommand struct {
	BloqueID string              `json:"bloque_id"`
	PlayerID string              `json:"player_id"`
	ActionID string              `json:"action_id"`
	EntityID int                 `json:"entity_id"`
	Seq      int                 `json:"seq"`
	PosX     float64             `json:"pos_x"`
	PosY     float64             `json:"pos_y"`
	PosZ     float64             `json:"pos_z"`
	Yaw      float64             `json:"yaw"`
	IsNPC    bool                `json:"is_npc"`
	Targets  []SwingPlayerTarget `json:"targets"`
}

type SwingOutcome struct {
	OK              bool
	Duplicate       bool
	Error           string
	ActionID        string
	Hits            []domain.DamageResult
	DestroyedCount  int
	TargetPlayerID  string
	TargetEntityID  int
	EntityDamage    float64
	Truncated       bool
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

func swingDedupKey(playerID string, entityID, seq int) string {
	if playerID != "" {
		return fmt.Sprintf("p:%s:%d", playerID, seq)
	}
	return fmt.Sprintf("e:%d:%d", entityID, seq)
}

func (s *SwingService) rememberSwing(playerID string, entityID, seq int) bool {
	key := swingDedupKey(playerID, entityID, seq)
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

// ApplySwing performs one candidate query and resolves world/entity impacts in trajectory order.
func (s *SwingService) ApplySwing(ctx context.Context, cmd SwingCommand) (SwingOutcome, error) {
	if cmd.PlayerID == "" || cmd.Seq <= 0 {
		return SwingOutcome{Error: "invalid_swing", ActionID: cmd.ActionID}, nil
	}
	profile := s.Catalog.Get(cmd.ActionID)
	if profile == nil {
		return SwingOutcome{Error: "unknown_action", ActionID: cmd.ActionID}, nil
	}
	if !s.rememberSwing(cmd.PlayerID, cmd.EntityID, cmd.Seq) {
		return SwingOutcome{OK: true, Duplicate: true, ActionID: cmd.ActionID}, nil
	}
	if profile.Impact == nil {
		return SwingOutcome{OK: true, ActionID: cmd.ActionID}, nil
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
		if isSolidParticle(p) && jdcombat.HitsWorldCell(origin, cmd.Yaw, p.CeldaX, p.CeldaY, p.CeldaZ, impact.Reach) {
			impacts = append(impacts, swingImpact{
				forward:  jdcombat.ForwardDistance(origin, cmd.Yaw, float64(p.CeldaX), float64(p.CeldaY)),
				particle: &p,
			})
		}
	}
	for i := range cmd.Targets {
		target := cmd.Targets[i]
		if target.PlayerID == "" || target.PlayerID == cmd.PlayerID ||
			!jdcombat.HitsPlayer(origin, cmd.Yaw, jdcombat.Point{X: target.X, Y: target.Y, Z: target.Z}, impact.Reach) {
			continue
		}
		impacts = append(impacts, swingImpact{
			forward: jdcombat.ForwardDistance(origin, cmd.Yaw, target.X, target.Y),
			player:  &target,
		})
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
	worldHits := 0
	truncated := false
	var targetPlayerID string
	var targetEntityID int
	var entityDamage float64
	for _, hit := range impacts {
		if remaining <= 0 {
			break
		}
		if hit.player != nil {
			targetPlayerID, targetEntityID, entityDamage = hit.player.PlayerID, hit.player.EntityID, remaining
			break
		}
		if worldHits >= MaxWorldHitsPerSwing {
			truncated = true
			break
		}
		res, err := ApplyParticleDamage(ctx, s.Repo, ApplyDamageInput{
			BloqueID: cmd.BloqueID, ParticleID: hit.particle.ID, Damage: remaining,
			WeaponType: cmd.ActionID, RateLimiter: s.RateLimit,
		})
		if err != nil {
			return SwingOutcome{}, fmt.Errorf("apply swing particle %s: %w", hit.particle.ID, err)
		}
		if res == nil {
			return SwingOutcome{}, fmt.Errorf("apply swing particle %s: empty damage result", hit.particle.ID)
		}
		worldHits++
		hits = append(hits, *res)
		if res.Destroyed && res.Position != nil {
			_ = s.Events.PublishCellDestroyed(ctx, cmd.BloqueID, res.ParticleID, res.Position.X, res.Position.Y, res.Position.Z)
			_ = s.Events.PublishParticleDestroyed(ctx, cmd.BloqueID, res.ParticleID, res.Position.X, res.Position.Y, res.Position.Z)
		}
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
	out := SwingOutcome{
		OK: true, ActionID: cmd.ActionID, Hits: hits, DestroyedCount: destroyed,
		TargetPlayerID: targetPlayerID, TargetEntityID: targetEntityID,
		EntityDamage: entityDamage, Truncated: truncated,
	}
	payload, err := buildSwingResultJSON(cmd, out)
	if err != nil {
		return out, err
	}
	if err := s.Events.PublishSwingResult(ctx, payload); err != nil {
		return out, fmt.Errorf("publish swing result: %w", err)
	}
	return out, nil
}

func buildSwingResultJSON(cmd SwingCommand, out SwingOutcome) (string, error) {
	hitPayload := make([]map[string]interface{}, 0, len(out.Hits))
	for _, hit := range out.Hits {
		hitPayload = append(hitPayload, map[string]interface{}{
			"particle_id": hit.ParticleID,
			"destroyed":   hit.Destroyed,
			"integridad":  hit.NuevaIntegridad,
		})
	}
	payload := map[string]interface{}{
		"type": "swing_result", "seq": cmd.Seq, "entity_id": cmd.EntityID, "player_id": cmd.PlayerID,
		"action_id": cmd.ActionID, "bloque_id": cmd.BloqueID, "hits": hitPayload,
		"target_player_id": out.TargetPlayerID, "target_entity_id": out.TargetEntityID,
		"entity_damage": out.EntityDamage, "truncated": out.Truncated,
	}
	b, err := json.Marshal(payload)
	return string(b), err
}
