package combat

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadActionCombatProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"attack","cooldownMs":500,"control":{"when":{"not":{"medium":["air","submerged_full"]}}},"impact":{"worldDamage":{"reach":2,"damage":15},"entityDamage":{"reach":2,"damage":15}}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	p := catalog.Get("attack")
	if p == nil || p.Cooldown != 500*time.Millisecond || p.WorldDamage == nil || p.EntityDamage == nil || p.WorldDamage.Reach != 2 || p.EntityDamage.Damage != 15 || len(p.BlockedMediums) != 2 {
		t.Fatalf("unexpected action profile: %+v", p)
	}
}
