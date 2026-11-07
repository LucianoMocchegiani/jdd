package systems

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
)

func TestRunPlayerTickKeepsGroundAirFallbackWithoutMediumRules(t *testing.T) {
	p := entity.NewPlayer("p", 1, 0, 0, 1, 0, 0)
	grid := collision.NewSolidGrid()
	cfg := &session.Config{ContactSampleRadiusCells: 2, PlayerMoveSpeedCells: 1}
	RunPlayerTick(p, grid, cfg, nil, 1.0/30)
	if p.Medium != "air" {
		t.Fatalf("expected fallback air medium, got %s", p.Medium)
	}
}
