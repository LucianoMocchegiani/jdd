package entity

import (
	"testing"
	"time"
)

func TestKiShieldConeAbsorbsFrontDamageAndSpillsExcess(t *testing.T) {
	session := NewBlockSession("block", 1)
	session.AddPlayer("target", 0, 0, 0, 0, 0)
	session.AddPlayer("front", 0, -2, 0, 0, 0)
	now := time.Now()
	if !session.CreateKiShield("target", "cone", 50, 120, 5*time.Second, now) { t.Fatal("shield creation failed") }
	if !session.ApplyPlayerDamageFrom("front", "target", 1, 60, now) { t.Fatal("damage was not applied") }
	target, _ := session.GetPlayer("target")
	if target.Health != 90 || len(session.KiShieldStates(now)) != 0 { t.Fatalf("front hit should absorb 50 and spill 10: health=%v shields=%v", target.Health, session.KiShieldStates(now)) }
}

func TestKiShieldRadialAbsorbsFromEveryDirection(t *testing.T) {
	session := NewBlockSession("block", 1)
	session.AddPlayer("target", 0, 0, 0, 0, 0)
	session.AddPlayer("behind", 0, 2, 0, 0, 0)
	now := time.Now()
	if !session.CreateKiShield("target", "radial", 50, 0, 5*time.Second, now) { t.Fatal("shield creation failed") }
	if !session.ApplyPlayerDamageFrom("behind", "target", 1, 20, now) { t.Fatal("damage was not applied") }
	target, _ := session.GetPlayer("target")
	if target.Health != 100 || session.KiShieldStates(now)["target"].Remaining != 30 || session.KiShieldStates(now)["target"].Shape != "radial" {
		t.Fatalf("radial hit was not absorbed: health=%v shields=%v", target.Health, session.KiShieldStates(now))
	}
}

func TestKiShieldDoesNotAbsorbBehindConeOrAfterExpiry(t *testing.T) {
	for _, tc := range []struct { name, source string; after time.Duration }{
		{name: "behind", source: "behind"}, {name: "expired", source: "front", after: 6 * time.Second},
	} {
		t.Run(tc.name, func(t *testing.T) {
			session := NewBlockSession("block", 1)
			session.AddPlayer("target", 0, 0, 0, 0, 0)
			session.AddPlayer("front", 0, -2, 0, 0, 0)
			session.AddPlayer("behind", 0, 2, 0, 0, 0)
			now := time.Now()
			if !session.CreateKiShield("target", "cone", 50, 120, 5*time.Second, now) { t.Fatal("shield creation failed") }
			if !session.ApplyPlayerDamageFrom(tc.source, "target", 1, 20, now.Add(tc.after)) { t.Fatal("damage was not applied") }
			target, _ := session.GetPlayer("target")
			if target.Health != 80 { t.Fatalf("unblocked hit health=%v, want 80", target.Health) }
		})
	}
}
