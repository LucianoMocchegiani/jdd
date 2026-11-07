package systems

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
)

func TestRunPlayerTickUsesAuthoritativeFluidSamples(t *testing.T) {
	dir := t.TempDir()
	rulesPath, particlesPath := filepath.Join(dir, "medium.json"), filepath.Join(dir, "particles.json")
	if err := os.WriteFile(rulesPath, []byte(`{"rules":{"submergedFullRatio":0.55,"submergedPartialRatio":0.12,"groundSolidCellsMin":1},"resolutionOrder":["submerged_full","submerged_partial","ground","air"]}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(particlesPath, []byte(`{"submergedCountFamilies":["liquid","granular"],"typeOverrides":{},"defaultByPhysics":{"liquido":{"family":"liquid"}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	resolver, err := jdmedium.Load(rulesPath, particlesPath)
	if err != nil {
		t.Fatal(err)
	}
	p := entity.NewPlayer("p", 1, 0, 0, 0, 0, 0)
	grid := collision.NewSolidGrid()
	grid.MergeContactParticles([]jdmedium.Particle{{X: 0, Y: 0, Z: 0, Name: "agua", Physics: "liquido"}})
	cfg := &session.Config{ContactSampleRadiusCells: 2, PlayerMoveSpeedCells: 1}
	RunPlayerTick(p, grid, cfg, resolver, 1.0/30)
	if p.Medium != "submerged_full" {
		t.Fatalf("expected authoritative submerged medium, got %s", p.Medium)
	}
}
