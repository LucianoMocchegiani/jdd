// Package usecase — Casos de uso REST y combate.
package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

const maxProcessedSwings = 4096

// SwingCommand representa swing command.
type SwingCommand struct {
	BloqueID string  `json:"bloque_id"`
	PlayerID string  `json:"player_id"`
	ActionID string  `json:"action_id"`
	EntityID int     `json:"entity_id"`
	Seq      int     `json:"seq"`
	PosX     float64 `json:"pos_x"`
	PosY     float64 `json:"pos_y"`
	PosZ     float64 `json:"pos_z"`
	IsNPC    bool    `json:"is_npc"`
}

// SwingOutcome representa swing outcome.
type SwingOutcome struct {
	OK              bool
	Duplicate       bool
	Error           string
	ActionID        string
	Hits            []domain.DamageResult
	DestroyedCount  int
}

// SwingService representa swing service.
type SwingService struct {
	Repo      port.ParticleRepository
	Catalog   port.CombatCatalog
	Events    port.EventPublisher
	RateLimit port.DestroyRateLimiter

	mu        sync.Mutex
	processed map[string]struct{}
}

// NewSwingService construye swing service.
func NewSwingService(repo port.ParticleRepository, cat port.CombatCatalog, ev port.EventPublisher, rl port.DestroyRateLimiter) *SwingService {
	return &SwingService{
		Repo:      repo,
		Catalog:   cat,
		Events:    ev,
		RateLimit: rl,
		processed: make(map[string]struct{}),
	}
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

// ApplySwing implementa apply swing.
func (s *SwingService) ApplySwing(ctx context.Context, cmd SwingCommand) (SwingOutcome, error) {
	if !s.rememberSwing(cmd.PlayerID, cmd.EntityID, cmd.Seq) {
		return SwingOutcome{OK: true, Duplicate: true, ActionID: cmd.ActionID}, nil
	}

	profile := s.Catalog.Get(cmd.ActionID)
	if profile == nil {
		return SwingOutcome{OK: false, Error: "unknown_action", ActionID: cmd.ActionID}, nil
	}
	if profile.WorldDamage == nil {
		return SwingOutcome{OK: true, ActionID: cmd.ActionID}, nil
	}

	world := profile.WorldDamage
	candidates, err := s.Repo.GetParticlesNear(ctx, cmd.BloqueID, cmd.PosX, cmd.PosY, cmd.PosZ, world.Reach)
	if err != nil {
		return SwingOutcome{}, err
	}

	var hits []domain.DamageResult
	for _, row := range candidates {
		if len(hits) >= MaxWorldHitsPerSwing {
			break
		}
		if !isSolidParticle(row) {
			continue
		}
		res, err := ApplyParticleDamage(ctx, s.Repo, ApplyDamageInput{
			BloqueID:    cmd.BloqueID,
			ParticleID:  row.ID,
			Damage:      world.Damage,
			WeaponType:  cmd.ActionID,
			RateLimiter: s.RateLimit,
		})
		if err != nil || res == nil {
			continue
		}
		hits = append(hits, *res)
		if res.Destroyed && res.Position != nil {
			_ = s.Events.PublishCellDestroyed(ctx, cmd.BloqueID, res.ParticleID, res.Position.X, res.Position.Y, res.Position.Z)
			_ = s.Events.PublishParticleDestroyed(ctx, cmd.BloqueID, res.ParticleID, res.Position.X, res.Position.Y, res.Position.Z)
		}
	}

	destroyed := 0
	for _, h := range hits {
		if h.Destroyed {
			destroyed++
		}
	}

	out := SwingOutcome{
		OK:             true,
		ActionID:       cmd.ActionID,
		Hits:           hits,
		DestroyedCount: destroyed,
	}

	if payload, err := buildSwingResultJSON(cmd, hits); err == nil {
		_ = s.Events.PublishSwingResult(ctx, payload)
	}

	return out, nil
}

func buildSwingResultJSON(cmd SwingCommand, hits []domain.DamageResult) (string, error) {
	hitPayload := make([]map[string]interface{}, 0, len(hits))
	for _, h := range hits {
		hitPayload = append(hitPayload, map[string]interface{}{
			"particle_id":  h.ParticleID,
			"destroyed":    h.Destroyed,
			"integridad":   h.NuevaIntegridad,
		})
	}
	payload := map[string]interface{}{
		"type":      "swing_result",
		"seq":       cmd.Seq,
		"entity_id": cmd.EntityID,
		"action_id": cmd.ActionID,
		"bloque_id": cmd.BloqueID,
		"hits":      hitPayload,
	}
	b, err := json.Marshal(payload)
	return string(b), err
}
