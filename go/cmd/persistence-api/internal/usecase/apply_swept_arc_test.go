package usecase_test

import (
	"context"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

func TestSweptArcDamagesOnlyParticlesAndPlayersInTheFrontSector(t *testing.T) {
	repo := &swingRepo{
		near: []domain.ParticleNear{
			{ID: "front", CeldaY: -1, CeldaZ: 1, TipoFisico: "solido"},
			{ID: "side", CeldaX: 2, CeldaZ: 1, TipoFisico: "solido"},
		},
		particles: map[string]domain.ParticleWithDureza{
			"front": {ID: "front", Integridad: 10, Dureza: 1},
			"side": {ID: "side", Integridad: 100, Dureza: 1},
		},
	}
	svc := usecase.NewSwingService(repo, swingCatalog{&domain.CombatProfile{
		ActionID: "attack", Impact: &domain.ImpactProfile{Shape: "swept_arc", Origin: "caster", Reach: 2, SweepDegrees: 120, Damage: 15},
	}}, &swingEvents{}, nil)
	out, err := svc.ApplySwing(context.Background(), usecase.SwingCommand{
		BloqueID: "block", PlayerID: "caster", ActionID: "attack", EntityID: 1, Seq: 1,
		Targets: []usecase.SwingPlayerTarget{
			{PlayerID: "front-player", EntityID: 2, Y: -2},
			{PlayerID: "side-player", EntityID: 3, X: 1.5},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.deleted) != 1 || repo.deleted[0] != "front" || repo.applied["side"] != 0 {
		t.Fatalf("unexpected particle impact: deleted=%v applied=%v", repo.deleted, repo.applied)
	}
	if out.TargetPlayerID != "front-player" || out.EntityDamage != 5 {
		t.Fatalf("unexpected player damage result: %+v", out)
	}
}
