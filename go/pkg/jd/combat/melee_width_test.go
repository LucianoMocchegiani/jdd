package combat

import "testing"

func TestConfiguredImpactWidth(t *testing.T) {
	origin := Point{}
	if !HitsWorldCellWithWidth(origin, 0, 0, -3, 0, 4, 0.55) {
		t.Fatal("cell inside beam width should be hit")
	}
	if HitsWorldCellWithWidth(origin, 0, 1, -3, 0, 4, 0.55) {
		t.Fatal("cell outside beam width should not be hit")
	}
	if !HitsWorldCell(origin, 0, 0, -3, 0, 4) {
		t.Fatal("default melee width should remain unchanged")
	}
}
