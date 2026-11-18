package usecase_test

import (
	"context"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

func TestRadialImpactDamagesVisibleParticlesAndPlayerTargetsOnlyInRange(t *testing.T) {
	repo := &swingRepo{
		near: []domain.ParticleNear{
			{ID: "wall", CeldaX: 1, CeldaY: 0, CeldaZ: 0, TipoFisico: "solido"},
			{ID: "behind-wall", CeldaX: 2, CeldaY: 0, CeldaZ: 0, TipoFisico: "solido"},
			{ID: "visible", CeldaX: 0, CeldaY: -1, CeldaZ: 0, TipoFisico: "solido"},
		},
		particles: map[string]domain.ParticleWithDureza{
			"wall": {ID: "wall", Integridad: 100, Dureza: 1},
			"behind-wall": {ID: "behind-wall", Integridad: 100, Dureza: 1},
			"visible": {ID: "visible", Integridad: 100, Dureza: 1},
		},
	}
	events := &swingEvents{}
	svc := usecase.NewSwingService(repo, swingCatalog{&domain.CombatProfile{
		ActionID: "aura_de_ki", Impact: &domain.ImpactProfile{Shape: "radial", Radius: 3, Damage: 5},
	}}, events, nil)
	out, err := svc.ApplySwing(context.Background(), usecase.SwingCommand{
		BloqueID: "block", PlayerID: "caster", ActionID: "aura_de_ki", EntityID: 1, Seq: 1,
		Targets: []usecase.SwingPlayerTarget{
			{PlayerID: "visible-player", EntityID: 2, X: 0, Y: -2, Z: 0},
			{PlayerID: "outside-player", EntityID: 3, X: 4, Y: 0, Z: 0},
		},
	})
	if err != nil { t.Fatal(err) }
	if repo.applied["wall"] != 95 || repo.applied["visible"] != 95 || repo.applied["behind-wall"] != 0 {
		t.Fatalf("radial particle damage ignored visibility: %v", repo.applied)
	}
	if len(out.PlayerHits) != 1 || out.PlayerHits[0].PlayerID != "visible-player" || out.PlayerHits[0].Damage != 5 {
		t.Fatalf("radial player hits not restricted by range: %+v", out.PlayerHits)
	}
}
