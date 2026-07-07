// Tests: Grilla de celdas sólidas para colisión.
package collision_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
)

func TestSolidGridMergeAndCollision(t *testing.T) {
	g := collision.NewSolidGrid()
	g.MergeSolidCells([]string{"1,2,3", "4,5,6"})
	if !g.IsCellSolid(1, 2, 3) {
		t.Fatal("expected solid cell")
	}
	if g.IsBodyBlocked(4, 5, 6) {
		// feet at 4,5,6 — head at 4,5,7 also solid
	}
	g.RemoveCell(1, 2, 3)
	if g.IsCellSolid(1, 2, 3) {
		t.Fatal("expected cell removed")
	}
}
