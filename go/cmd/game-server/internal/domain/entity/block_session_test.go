package entity

import (
	"testing"
	"time"

	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

func TestSwingReservationAndSingleHit(t *testing.T) {
	s := NewBlockSession("b", 1)
	s.AddPlayer("attacker", 0, 0, 0, 0, 0)
	s.AddPlayer("target", 0, -1, 0, 0, 0)
	now := time.Now()
	blocked := []string{"air", "submerged_full"}
	reservation, ok := s.BeginSwing("attacker", 1, now, 500*time.Millisecond, blocked)
	if !ok {
		t.Fatal("first swing should be accepted")
	}
	if _, ok := s.BeginSwing("attacker", 1, now, 500*time.Millisecond, blocked); ok {
		t.Fatal("duplicate swing should be rejected")
	}
	if _, ok := s.BeginSwing("attacker", 2, now.Add(100*time.Millisecond), 500*time.Millisecond, blocked); ok {
		t.Fatal("swing during cooldown should be rejected")
	}
	s.ApplyMeleeDamage("attacker", jdcombat.Point{X: reservation.X, Y: reservation.Y, Z: reservation.Z}, reservation.Yaw, 2, 15)
	target, ok := s.GetPlayer("target")
	if !ok || target.Health != 85 {
		t.Fatalf("unexpected target health: %+v", target)
	}

	s.UpdatePlayer("attacker", func(p *Player) { p.Medium = "air" })
	if _, ok := s.BeginSwing("attacker", 2, now.Add(time.Second), 500*time.Millisecond, blocked); ok {
		t.Fatal("action forbidden by its medium rule should be rejected")
	}
}
