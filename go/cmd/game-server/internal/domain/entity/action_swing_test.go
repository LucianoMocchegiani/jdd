package entity

import (
	"testing"
	"time"
)

func TestActionCooldownsAreIndependent(t *testing.T) {
	s := NewBlockSession("b", 1)
	s.AddPlayer("player", 0, 0, 0, 0, 0)
	now := time.Now()
	if _, ok := s.BeginActionSwing("player", "attack", 1, now, 3*time.Second, nil); !ok {
		t.Fatal("first attack should be accepted")
	}
	if _, ok := s.BeginActionSwing("player", "kamehameha", 2, now.Add(time.Second), 3*time.Second, nil); !ok {
		t.Fatal("another ability should not inherit the first ability's cooldown")
	}
	if _, ok := s.BeginActionSwing("player", "kamehameha", 3, now.Add(2*time.Second), 3*time.Second, nil); ok {
		t.Fatal("same ability should remain on cooldown")
	}
}
