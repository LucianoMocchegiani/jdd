// Package usecase — Casos de uso REST y combate.
package usecase

import (
	"context"
	"math"
	"strings"
	"errors"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

const MaxWorldHitsPerSwing = 64

func evalIntegridad(integridad float64, condicion string, valor float64) bool {
	switch condicion {
	case "menor":
		return integridad < valor
	case "mayor":
		return integridad > valor
	case "igual":
		return math.Abs(integridad-valor) < 0.01
	default:
		return false
	}
}

// ApplyDamageInput representa apply damage input.
type ApplyDamageInput struct {
	BloqueID    string
	ParticleID  string
	Damage      float64
	WeaponType  string
	RateLimiter port.DestroyRateLimiter
}

// ApplyParticleDamage ejecuta apply particle damage.
func ApplyParticleDamage(ctx context.Context, repo port.ParticleRepository, in ApplyDamageInput) (*domain.DamageResult, error) {
	p, err := repo.GetWithDureza(ctx, in.BloqueID, in.ParticleID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, errors.New("particle not found")
	}

	dureza := p.Dureza
	if dureza <= 0 {
		dureza = 1
	}
	damageEff := in.Damage / math.Max(dureza, 0.1)
	nueva := math.Max(0, p.Integridad-damageEff)

	transitions, err := repo.GetIntegrityTransitions(ctx, p.TipoParticulaID)
	if err != nil {
		return nil, err
	}

	destroyed := false
	for _, t := range transitions {
		if evalIntegridad(nueva, t.Condicion, t.Valor) {
			destroyed = true
			break
		}
	}
	if len(transitions) == 0 && nueva <= 0 {
		destroyed = true
	}

	result := &domain.DamageResult{
		ParticleID:      in.ParticleID,
		NuevaIntegridad: math.Round(nueva*10000) / 10000,
		Destroyed:       destroyed,
	}

	if destroyed {
		if in.RateLimiter != nil {
			ok, err := in.RateLimiter.AllowDestroy(ctx, in.BloqueID)
			if err != nil {
				return nil, err
			}
			if !ok {
				// rate limited — aplicar daño sin destruir
				destroyed = false
				result.Destroyed = false
				if err := repo.ApplyDamage(ctx, in.ParticleID, nueva); err != nil {
				return nil, err
			}
				return result, nil
			}
		}
		pos := domain.CellPos{X: p.CeldaX, Y: p.CeldaY, Z: p.CeldaZ}
		result.Position = &pos
		if err := repo.DeleteParticle(ctx, in.ParticleID); err != nil {
			return nil, err
		}
	} else {
		if err := repo.ApplyDamage(ctx, in.ParticleID, nueva); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func isSolidParticle(p domain.ParticleNear) bool {
	if p.Extraida {
		return false
	}
	return strings.ToLower(p.TipoFisico) == "solido"
}
