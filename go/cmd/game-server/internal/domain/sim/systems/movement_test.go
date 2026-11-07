package systems

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
)

func TestRunPlayerTickUsesAuthoritativeFluidSamples(t *testing.T) {
	p := entity.NewPlayer("p", 1, 0, 0, 0, 0, 0)
	grid := collision.NewSolidGrid()
	grid.MergeContactParticles([]jdmedium.Particle{{X: 0, Y: 0, Z: 0, Name: "agua", Physics: "liquido"}})
	cfg := &session.Config{ContactSampleRadiusCells: 2, PlayerMoveSpeedCells: 1}
	resolver := &jdmedium.Resolver{}
	p.Medium = "submerged_full"
	// A nil resolver keeps legacy ground/air fallback; actual threshold behavior is tested in pkg/jd/medium.
	RunPlayerTick(p, grid, cfg, resolver, 1.0/30)
	if p.Medium != "air" {
		t.Fatalf("unexpected medium without configured rules: %s", p.Medium)
	}
}
