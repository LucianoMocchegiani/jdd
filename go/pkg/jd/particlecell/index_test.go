package particlecell

import "testing"

func TestColumnIndex(t *testing.T) {
	for _, test := range []struct {
		coordinate float64
		want       int
	}{
		{0, 0},
		{0.49, 0},
		{0.5, 1},
		{-0.49, 0},
		{-0.5, 0},
		{-0.51, -1},
	} {
		if got := ColumnIndex(test.coordinate); got != test.want {
			t.Errorf("ColumnIndex(%v) = %d, want %d", test.coordinate, got, test.want)
		}
	}
}
