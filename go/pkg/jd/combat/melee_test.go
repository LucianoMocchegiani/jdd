package combat

import "testing"

func TestMeleeHitVolumes(t *testing.T) {
	origin := Point{X: 0, Y: 0, Z: 0}
	if !HitsPlayer(origin, 0, Point{Y: -1, Z: 0}, 2) {
		t.Fatal("forward player should be hit")
	}
	if HitsPlayer(origin, 0, Point{Y: 1, Z: 0}, 2) {
		t.Fatal("player behind attacker should not be hit")
	}
	if HitsPlayer(origin, 0, Point{X: 2, Y: -1, Z: 0}, 2) {
		t.Fatal("player outside strike width should not be hit")
	}
	if HitsPlayer(origin, 0, Point{Y: -1, Z: 3}, 2) {
		t.Fatal("player above strike should not be hit")
	}
	if HitsPlayer(origin, 0, Point{Y: -4, Z: 0}, 2) {
		t.Fatal("player beyond reach should not be hit")
	}
	if !HitsWorldCell(origin, 0, 0, -1, 0, 2) {
		t.Fatal("forward particle should be hit")
	}
	if HitsWorldCell(origin, 0, 0, 1, 0, 2) {
		t.Fatal("particle behind attacker should not be hit")
	}
	if HitsWorldCell(origin, 0, 0, -2, 0, 1) {
		t.Fatal("particle beyond reach should not be hit based on its center")
	}
}
