package systems

import (
	"math"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
)

func TestStartPlanarDashUsesMovementOrFacingAndMovesAuthoritatively(t *testing.T) {
	for _, tc := range []struct {
		name    string
		intents map[string]bool
		wantX   float64
		wantY   float64
	}{
		{name: "facing when idle", wantY: -1},
		{name: "movement direction", intents: map[string]bool{"move_right": true}, wantX: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := entity.NewPlayer("p", 1, 0, 0, 1, 0, 0)
			p.Intents = tc.intents
			if !StartPlanarDash(p, 2, 0.2) { t.Fatal("dash did not start") }
			if math.Abs(p.DashVX-10*tc.wantX) > 1e-9 || math.Abs(p.DashVY-10*tc.wantY) > 1e-9 {
				t.Fatalf("dash velocity=(%v,%v)", p.DashVX, p.DashVY)
			}
			RunPlayerTickWithEffects(p, collision.NewSolidGrid(), &session.Config{PlayerMoveSpeedCells: 1}, nil, 0.1, p.Intents, 1)
			if p.X == 0 && p.Y == 0 { t.Fatal("dash did not move the player") }
		})
	}
}

func TestStartPlanarDashRejectsInvalidState(t *testing.T) {
	p := entity.NewPlayer("p", 1, 0, 0, 1, 0, 0)
	p.Medium = "air"
	if StartPlanarDash(p, 2, 0.2) { t.Fatal("dash started in air") }
	p.Medium = "ground"
	if StartPlanarDash(p, 0, 0.2) { t.Fatal("dash started with no distance") }
}
