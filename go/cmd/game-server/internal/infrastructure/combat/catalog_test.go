package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEntityDamageProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "combat.json")
	if err := os.WriteFile(path, []byte(`{"actions":{"attack":{"impact":{"worldDamage":{"reach":2,"damage":15},"entityDamage":{"reach":2,"damage":15}}}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	p := catalog.Get("attack")
	if p == nil || !p.WorldDamage || p.EntityDamage == nil || p.EntityDamage.Reach != 2 || p.EntityDamage.Damage != 15 {
		t.Fatalf("unexpected combat profile: %+v", p)
	}
}
