// Package port — Puertos de repositorios y workers.
package port

import (
	"context"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
)

// ParticleRepository representa particle repository.
type ParticleRepository interface {
	GetParticlesNear(ctx context.Context, bloqueID string, cx, cy, cz float64, radius int) ([]domain.ParticleNear, error)
	GetWithDureza(ctx context.Context, bloqueID, particleID string) (*domain.ParticleWithDureza, error)
	GetIntegrityTransitions(ctx context.Context, tipoParticulaID string) ([]domain.IntegrityTransition, error)
	ApplyDamage(ctx context.Context, particleID string, nuevaIntegridad float64) error
	DeleteParticle(ctx context.Context, particleID string) error
}

// DestroyRateLimiter representa destroy rate limiter.
type DestroyRateLimiter interface {
	AllowDestroy(ctx context.Context, bloqueID string) (bool, error)
}

// EventPublisher representa event publisher.
type EventPublisher interface {
	PublishCellDestroyed(ctx context.Context, bloqueID, particleID string, x, y, z int) error
	PublishParticleDestroyed(ctx context.Context, bloqueID, particleID string, x, y, z int) error
	PublishSwingResult(ctx context.Context, payloadJSON string) error
}

// CombatCatalog representa combat catalog.
type CombatCatalog interface {
	Get(actionID string) *domain.CombatProfile
}
