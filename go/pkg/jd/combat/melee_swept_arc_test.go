package combat

import "testing"

func TestSweptArcCoversOnlyFrontSector(t *testing.T) {
	origin := Point{}
	if !HitsPlayerWithSweptArc(origin, 0, Point{X: 0, Y: -2, Z: 0}, 2, 120) {
		t.Fatal("player in front should be hit")
	}
	if HitsPlayerWithSweptArc(origin, 0, Point{X: 1.5, Y: 0, Z: 0}, 2, 120) {
		t.Fatal("player to the side should not be hit")
	}
	if HitsPlayerWithSweptArc(origin, 0, Point{X: 0, Y: 2, Z: 0}, 2, 120) {
		t.Fatal("player behind the attacker should not be hit")
	}
	if HitsPlayerWithSweptArc(origin, 0, Point{X: 0, Y: -2, Z: 0}, 2, 0) {
		t.Fatal("zero-degree sweep should be rejected")
	}
	if !HitsWorldCellWithSweptArc(origin, 0, 0, -2, 1, 2, 120) {
		t.Fatal("particle in front should be hit")
	}
	if HitsWorldCellWithSweptArc(origin, 0, 2, 0, 1, 2, 120) {
		t.Fatal("particle to the side should not be hit")
	}
}
