// Tests: Grilla de celdas sólidas para colisión.
package collision_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
)

func TestSolidGridMergeAndCollision(t *testing.T) {
	g := collision.NewSolidGrid()
	g.MergeSolidCells([]string{"1,2,3", "4,5,6"})
	if !g.IsCellSolid(1, 2, 3) {
		t.Fatal("expected solid cell")
	}
	g.RemoveCell(1, 2, 3)
	if g.IsCellSolid(1, 2, 3) {
		t.Fatal("expected cell removed")
	}
}

func TestContactParticlesNearOnlyReturnsSampleWindow(t *testing.T) {
	g := collision.NewSolidGrid()
	g.MergeContactParticles([]jdmedium.Particle{
		{X: 0, Y: 0, Z: 0, Name: "agua", Physics: "liquido"},
		{X: 20, Y: 20, Z: 20, Name: "agua", Physics: "liquido"},
	})
	near := g.ContactParticlesNear(0, 0, 0, 2)
	if len(near) != 1 || near[0].X != 0 {
		t.Fatalf("unexpected samples: %+v", near)
	}
	g.RemoveCell(0, 0, 0)
	if len(g.ContactParticlesNear(0, 0, 0, 2)) != 0 {
		t.Fatal("destroyed contact cell should be removed")
	}
}
