package usecase_test

import (
	"context"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

func TestProjectileDamagesOnlyTheSolidParticleHit(t *testing.T) {
	repo := &swingRepo{
		near: []domain.ParticleNear{
			{ID: "rock-hit", CeldaX: 1, CeldaY: -3, CeldaZ: 1, TipoFisico: "solido"},
			{ID: "rock-nearby", CeldaX: 2, CeldaY: -3, CeldaZ: 1, TipoFisico: "solido"},
		},
		particles: map[string]domain.ParticleWithDureza{
			"rock-hit": {ID: "rock-hit", Integridad: 10, Dureza: 1},
			"rock-nearby": {ID: "rock-nearby", Integridad: 10, Dureza: 1},
		},
	}
	service := usecase.NewSwingService(repo, swingCatalog{&domain.CombatProfile{ActionID: "kamehameha", ProjectileDamage: 30}}, &swingEvents{}, nil)
	out, err := service.ApplySwing(context.Background(), usecase.SwingCommand{
		BloqueID: "block", PlayerID: "attacker", ActionID: "kamehameha", EntityID: 1, Seq: 1,
		ParticleID: "rock-hit", ParticleX: 1, ParticleY: -3, ParticleZ: 1,
	})
	if err != nil { t.Fatal(err) }
	if len(repo.deleted) != 1 || repo.deleted[0] != "rock-hit" || len(out.Hits) != 1 || !out.Hits[0].Destroyed {
		t.Fatalf("expected projectile to destroy only its hit particle; deleted=%v outcome=%+v", repo.deleted, out)
	}
	if len(repo.applied) != 0 { t.Fatalf("unexpected damage to nearby particles: %v", repo.applied) }
}
