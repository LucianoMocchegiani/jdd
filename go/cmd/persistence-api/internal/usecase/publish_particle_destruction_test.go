package usecase_test

import (
	"context"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

type particleDestructionEvents struct{ cells, particles int }

func (e *particleDestructionEvents) PublishCellDestroyed(context.Context, string, string, int, int, int) error {
	e.cells++
	return nil
}
func (e *particleDestructionEvents) PublishParticleDestroyed(context.Context, string, string, int, int, int) error {
	e.particles++
	return nil
}
func (*particleDestructionEvents) PublishSwingResult(context.Context, string) error { return nil }

func TestSwingPublishesDestructionEventsAfterParticleDamage(t *testing.T) {
	repo := &swingRepo{
		near: []domain.ParticleNear{{ID: "stone", CeldaY: -1, CeldaZ: 1, TipoFisico: "solido"}},
		particles: map[string]domain.ParticleWithDureza{
			"stone": {ID: "stone", Integridad: 10, Dureza: 1},
		},
	}
	events := &particleDestructionEvents{}
	svc := usecase.NewSwingService(repo, swingCatalog{&domain.CombatProfile{
		ActionID: "attack", Impact: &domain.ImpactProfile{Reach: 4, Damage: 15},
	}}, events, nil)
	if _, err := svc.ApplySwing(context.Background(), usecase.SwingCommand{
		BloqueID: "block", PlayerID: "attacker", ActionID: "attack", Seq: 1,
	}); err != nil {
		t.Fatal(err)
	}
	if events.cells != 1 || events.particles != 1 {
		t.Fatalf("destruction events = (%d, %d), want (1, 1)", events.cells, events.particles)
	}
}
