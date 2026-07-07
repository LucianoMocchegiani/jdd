// Tests: Coordenadas de chunk (floor division, keys, radio).
package chunkcoords_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/pkg/jd/chunkcoords"
)

const chunkSize = 40

// Golden vectors — must match Python chunk_coords.py and rust chunkcoords.rs.
func TestCoordFromCell_Golden(t *testing.T) {
	cases := []struct {
		cell int
		want int
	}{
		{0, 0},
		{39, 0},
		{40, 1},
		{45, 1},
		{-1, -1},
		{-40, -1},
		{-41, -2},
	}
	for _, c := range cases {
		if got := chunkcoords.CoordFromCell(c.cell, chunkSize); got != c.want {
			t.Errorf("CoordFromCell(%d) = %d, want %d", c.cell, got, c.want)
		}
	}
}

func TestKey_Golden(t *testing.T) {
	if got := chunkcoords.Key(1, -2); got != "1,-2" {
		t.Errorf("Key = %q", got)
	}
}

func TestKeyFromCell_Golden(t *testing.T) {
	if got := chunkcoords.KeyFromCell(45, 45, chunkSize); got != "1,1" {
		t.Errorf("KeyFromCell(45,45) = %q", got)
	}
}

func TestCellBounds_Golden(t *testing.T) {
	xMin, xMax, yMin, yMax := chunkcoords.CellBounds(1, 0, chunkSize)
	if xMin != 40 || xMax != 79 || yMin != 0 || yMax != 39 {
		t.Errorf("CellBounds(1,0) = (%d,%d,%d,%d)", xMin, xMax, yMin, yMax)
	}
}

func TestKeysInRadius_CountGolden(t *testing.T) {
	keys := chunkcoords.KeysInRadius(50, 50, 48, chunkSize)
	if len(keys) < 4 {
		t.Errorf("expected at least 4 chunks, got %d", len(keys))
	}
	if _, ok := keys["1,1"]; !ok {
		t.Errorf("expected chunk 1,1 in radius at (50,50)")
	}
}

func TestUnionForPlayers_Golden(t *testing.T) {
	a := chunkcoords.UnionForPlayers([][2]float64{{50, 50}, {200, 200}}, 48, chunkSize)
	if len(a) < 8 {
		t.Errorf("union of two distant players should cover many chunks, got %d", len(a))
	}
}
