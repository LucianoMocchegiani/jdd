package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRadialSustainedCombatProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"aura_de_ki","manaCostPerSecond":5,"damageIntervalMs":1000,"control":{"inputIntent":"continuous_aura","type":"sustained"},"impact":{"shape":"radial","radius":3,"damage":5}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil { t.Fatal(err) }
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	profile := catalog.Get("aura_de_ki")
	if profile == nil || profile.ControlType != "sustained" || profile.Impact == nil || profile.Impact.Shape != "radial" || profile.Impact.Radius != 3 || profile.ManaCostPerSecond != 5 {
		t.Fatalf("unexpected radial profile: %+v", profile)
	}
}
