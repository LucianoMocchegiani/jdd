package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRadialImpactCanUseEitherActionCycle(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"aura_de_ki","manaCostPerSecond":5,"damageIntervalMs":1000,"control":{"inputIntent":"continuous_aura","type":"sustained"},"impact":{"shape":"radial","radius":3,"damage":5}},{"id":"light_radial","cooldownMs":500,"control":{"inputIntent":"attack_light","type":"one_shot"},"impact":{"shape":"radial","radius":2,"damage":15}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"aura_de_ki", "light_radial"} {
		profile := catalog.Get(id)
		if profile == nil || profile.Impact == nil || profile.Impact.Shape != "radial" {
			t.Fatalf("action %q did not load its radial impact: %+v", id, profile)
		}
	}
	if profile := catalog.Get("aura_de_ki"); profile.ControlType != "sustained" || profile.ManaCostPerSecond != 5 {
		t.Fatalf("unexpected sustained profile: %+v", profile)
	}
	if profile := catalog.Get("light_radial"); profile.ControlType != "one_shot" || profile.Cooldown.Milliseconds() != 500 {
		t.Fatalf("unexpected one-shot profile: %+v", profile)
	}
}
