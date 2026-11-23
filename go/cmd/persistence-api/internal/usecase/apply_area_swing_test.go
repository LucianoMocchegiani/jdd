package usecase_test

import (
	"context"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

func TestAreaSwingDamagesParticlesAroundConfiguredImpactTarget(t *testing.T) {
	repo := &swingRepo{
		near: []domain.ParticleNear{
			{ID: "inside", CeldaX: 0, CeldaY: 0, CeldaZ: 0, TipoFisico: "solido"},
			{ID: "outside", CeldaX: 4, CeldaY: 0, CeldaZ: 0, TipoFisico: "solido"},
		},
		particles: map[string]domain.ParticleWithDureza{
			"inside":  {ID: "inside", Integridad: 100, Dureza: 1},
			"outside": {ID: "outside", Integridad: 100, Dureza: 1},
		},
	}
	svc := usecase.NewSwingService(repo, swingCatalog{
		&domain.CombatProfile{
			ActionID: "orbe_explosivo",
			Impact:   &domain.ImpactProfile{Shape: "radial", Origin: "target", Radius: 2, Damage: 20},
		},
	}, &swingEvents{}, nil)

	_, err := svc.ApplySwing(context.Background(), usecase.SwingCommand{
		BloqueID: "block", PlayerID: "caster", ActionID: "orbe_explosivo", Seq: 1,
		AreaTarget: &usecase.AreaTarget{X: 0, Y: 0, Z: 0},
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.applied["inside"] != 80 || repo.applied["outside"] != 0 {
		t.Fatalf("target-origin radial impact damaged unexpected particles: %v", repo.applied)
	}
}
