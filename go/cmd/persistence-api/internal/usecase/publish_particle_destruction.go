package usecase

import (
	"context"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
)

func (s *SwingService) publishParticleDestruction(ctx context.Context, blockID string, result *domain.DamageResult) {
	if result == nil || !result.Destroyed || result.Position == nil {
		return
	}
	_ = s.Events.PublishCellDestroyed(ctx, blockID, result.ParticleID, result.Position.X, result.Position.Y, result.Position.Z)
	_ = s.Events.PublishParticleDestroyed(ctx, blockID, result.ParticleID, result.Position.X, result.Position.Y, result.Position.Z)
}
