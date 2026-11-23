package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadProjectileImpactDamageProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"kamehameha","impact":{"shape":"projectile","origin":"caster","speed":18,"reach":28,"damage":30,"radius":0.55,"delayMs":1033}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil { t.Fatal(err) }
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	impact := catalog.Get("kamehameha").Impact
	if impact == nil || impact.Shape != "projectile" || impact.Damage != 30 || impact.Reach != 28 {
		t.Fatalf("unexpected projectile impact: %+v", impact)
	}
}
