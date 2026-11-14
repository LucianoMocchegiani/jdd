package entity

import (
	"testing"
	"time"
)

func TestManaRegenerationUsesCombatStateAndCapsAtReserve(t *testing.T) {
	now := time.Unix(100, 0)
	p := &Player{Mana: 50, MaxMana: 100, InCombatUntil: now.Add(time.Second)}
	p.RegenerateMana(2, now)
	if p.Mana != 53 {
		t.Fatalf("combat regeneration = %v, want 53", p.Mana)
	}
	p.InCombatUntil = now
	p.RegenerateMana(2, now)
	if p.Mana != 59 {
		t.Fatalf("out-of-combat regeneration = %v, want 59", p.Mana)
	}
	p.RegenerateMana(100, now)
	if p.Mana != p.MaxMana {
		t.Fatalf("mana exceeded reserve: %v", p.Mana)
	}
}
