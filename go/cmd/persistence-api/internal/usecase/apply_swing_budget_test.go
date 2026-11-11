package usecase_test

import (
	"context"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

type swingRepo struct {
	near      []domain.ParticleNear
	particles map[string]domain.ParticleWithDureza
	deleted   []string
	applied   map[string]float64
}

func (r *swingRepo) GetParticlesNear(context.Context, string, float64, float64, float64, int) ([]domain.ParticleNear, error) {
	return r.near, nil
}

func (r *swingRepo) GetWithDureza(_ context.Context, _, id string) (*domain.ParticleWithDureza, error) {
	p, ok := r.particles[id]
	if !ok {
		return nil, nil
	}
	return &p, nil
}

func (*swingRepo) GetIntegrityTransitions(context.Context, string) ([]domain.IntegrityTransition, error) {
	return nil, nil
}

func (r *swingRepo) ApplyDamage(_ context.Context, id string, integrity float64) error {
	if r.applied == nil {
		r.applied = make(map[string]float64)
	}
	r.applied[id] = integrity
	return nil
}

func (r *swingRepo) DeleteParticle(_ context.Context, id string) error {
	r.deleted = append(r.deleted, id)
	return nil
}

type swingCatalog struct{ profile *domain.CombatProfile }

func (c swingCatalog) Get(string) *domain.CombatProfile { return c.profile }

type swingEvents struct{ result string }

func (*swingEvents) PublishCellDestroyed(context.Context, string, string, int, int, int) error {
	return nil
}
func (*swingEvents) PublishParticleDestroyed(context.Context, string, string, int, int, int) error {
	return nil
}
func (e *swingEvents) PublishSwingResult(_ context.Context, payload string) error {
	e.result = payload
	return nil
}

func TestApplySwingSharesDamageBetweenParticleAndPlayer(t *testing.T) {
	repo := &swingRepo{
		near:      []domain.ParticleNear{{ID: "stone", CeldaY: -1, CeldaZ: 1, TipoFisico: "solido"}},
		particles: map[string]domain.ParticleWithDureza{"stone": {ID: "stone", Integridad: 10, Dureza: 1}},
	}
	events := &swingEvents{}
	svc := usecase.NewSwingService(repo, swingCatalog{&domain.CombatProfile{
		ActionID: "attack", Impact: &domain.ImpactProfile{Reach: 4, Damage: 15},
	}}, events, nil)
	out, err := svc.ApplySwing(context.Background(), usecase.SwingCommand{
		BloqueID: "block", PlayerID: "attacker", ActionID: "attack", EntityID: 1, Seq: 1,
		Yaw: 0, Targets: []usecase.SwingPlayerTarget{{PlayerID: "target", EntityID: 2, Y: -2}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.deleted) != 1 || repo.deleted[0] != "stone" {
		t.Fatalf("particle not destroyed: %v", repo.deleted)
	}
	if out.TargetPlayerID != "target" || out.EntityDamage != 5 {
		t.Fatalf("remaining damage not shared with player: %+v", out)
	}
	if out.DestroyedCount != 1 {
		t.Fatalf("unexpected destroyed count: %d", out.DestroyedCount)
	}
}

func TestApplySwingStopsAtParticleThatSurvives(t *testing.T) {
	repo := &swingRepo{
		near:      []domain.ParticleNear{{ID: "stone", CeldaY: -1, CeldaZ: 1, TipoFisico: "solido"}},
		particles: map[string]domain.ParticleWithDureza{"stone": {ID: "stone", Integridad: 10, Dureza: 1}},
	}
	svc := usecase.NewSwingService(repo, swingCatalog{&domain.CombatProfile{
		ActionID: "attack", Impact: &domain.ImpactProfile{Reach: 4, Damage: 5},
	}}, &swingEvents{}, nil)
	out, err := svc.ApplySwing(context.Background(), usecase.SwingCommand{
		BloqueID: "block", PlayerID: "attacker", ActionID: "attack", EntityID: 1, Seq: 1,
		Targets: []usecase.SwingPlayerTarget{{PlayerID: "target", EntityID: 2, Y: -2}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.deleted) != 0 || repo.applied["stone"] != 5 {
		t.Fatalf("surviving particle should absorb the blow: deleted=%v applied=%v", repo.deleted, repo.applied)
	}
	if out.TargetPlayerID != "" || out.EntityDamage != 0 {
		t.Fatalf("attack passed through a surviving particle: %+v", out)
	}
}
