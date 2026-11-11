package combat

import "testing"

func TestForwardDistanceOrdersAlongFacingDirection(t *testing.T) {
	origin := Point{}
	if got := ForwardDistance(origin, 0, 0, -2); got != 2 {
		t.Fatalf("forward distance = %v, want 2", got)
	}
	if got := ForwardDistance(origin, 0, 0, 2); got != -2 {
		t.Fatalf("behind distance = %v, want -2", got)
	}
}
