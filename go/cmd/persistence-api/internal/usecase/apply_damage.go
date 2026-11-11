// Package usecase — Casos de uso REST y combate.
package usecase

import (
	"context"
	"errors"
	"math"
	"strings"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

// shortcut: caps particle damage at 64 hits per swing; raise only after measuring server/query load.
const MaxWorldHitsPerSwing = 64

func evalIntegridad(integridad float64, condicion string, valor float64) bool {
	switch condicion {
	case "menor": return integridad < valor
	case "mayor": return integridad > valor
	case "igual": return math.Abs(integridad-valor) < 0.01
	default: return false
	}
}

type ApplyDamageInput struct {
	BloqueID string
	ParticleID string
	Damage float64
	WeaponType string
	RateLimiter port.DestroyRateLimiter
}

func ApplyParticleDamage(ctx context.Context, repo port.ParticleRepository, in ApplyDamageInput) (*domain.DamageResult, error) {
	p, err := repo.GetWithDureza(ctx, in.BloqueID, in.ParticleID)
	if err != nil { return nil, err }
	if p == nil { return nil, errors.New("particle not found") }
	dureza := p.Dureza
	if dureza <= 0 { dureza = 1 }
	effectiveDureza := math.Max(dureza, 0.1)
	nueva := math.Max(0, p.Integridad-in.Damage/effectiveDureza)
	transitions, err := repo.GetIntegrityTransitions(ctx, p.TipoParticulaID)
	if err != nil { return nil, err }
	destroyed := false
	for _, t := range transitions { if evalIntegridad(nueva, t.Condicion, t.Valor) { destroyed = true; break } }
	if len(transitions) == 0 && nueva <= 0 { destroyed = true }
	result := &domain.DamageResult{ParticleID: in.ParticleID, NuevaIntegridad: math.Round(nueva*10000)/10000, Destroyed: destroyed, ConsumedDamage: in.Damage}
	if destroyed {
		if in.RateLimiter != nil {
			ok, err := in.RateLimiter.AllowDestroy(ctx, in.BloqueID)
			if err != nil { return nil, err }
			if !ok {
				result.Destroyed = false
				if err := repo.ApplyDamage(ctx, in.ParticleID, nueva); err != nil { return nil, err }
				return result, nil
			}
		}
		result.ConsumedDamage = math.Min(in.Damage, math.Max(0, p.Integridad-nueva)*effectiveDureza)
		pos := domain.CellPos{X: p.CeldaX, Y: p.CeldaY, Z: p.CeldaZ}
		result.Position = &pos
		if err := repo.DeleteParticle(ctx, in.ParticleID); err != nil { return nil, err }
	} else if err := repo.ApplyDamage(ctx, in.ParticleID, nueva); err != nil { return nil, err }
	return result, nil
}

func isSolidParticle(p domain.ParticleNear) bool {
	if p.Extraida { return false }
	return strings.ToLower(p.TipoFisico) == "solido"
}
