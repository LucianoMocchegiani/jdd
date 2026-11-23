package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSweptArcImpact(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"attack","cooldownMs":500,"control":{"inputIntent":"attack_light","type":"one_shot"},"impact":{"shape":"swept_arc","origin":"caster","reach":2,"sweepDegrees":120,"damage":15}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil { t.Fatal(err) }
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	impact := catalog.Get("attack").Impact
	if impact.Shape != "swept_arc" || impact.Origin != "caster" || impact.Reach != 2 || impact.SweepDegrees != 120 { t.Fatalf("unexpected swept-arc impact: %+v", impact) }
}
