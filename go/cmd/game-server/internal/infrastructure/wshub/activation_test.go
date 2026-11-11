package wshub

import "testing"

func TestPendingJoinIsNotActiveUntilMarkedAndOwnershipMoves(t *testing.T) {
	h := NewHub()
	first := h.Register(nil)
	h.BindPending(first.ID, JoinInfo{BloqueID: "block", EcoID: 1, PlayerID: "player", X: 3, Y: 4, Z: 5})
	if h.IsActive(first.ID) {
		t.Fatal("pending connection must not be active")
	}
	if join, ok := h.PendingJoin(first.ID); !ok || join.Z != 5 {
		t.Fatalf("pending join not preserved: %+v, %v", join, ok)
	}
	if !h.MarkActive(first.ID) || !h.IsActive(first.ID) {
		t.Fatal("mark active did not activate pending connection")
	}
	second := h.Register(nil)
	h.BindPending(second.ID, JoinInfo{BloqueID: "block", EcoID: 1, PlayerID: "player"})
	if !h.MarkActive(second.ID) || h.IsActive(first.ID) || !h.IsActive(second.ID) {
		t.Fatal("new active connection must supersede stale connection ownership")
	}
}
