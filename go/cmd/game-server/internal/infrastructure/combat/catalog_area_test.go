package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadTargetedRadialImpactSeparatesTargetingFromDamage(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"orbe_explosivo","cooldownMs":3000,"manaCost":20,"control":{"inputIntent":"target_orbe","type":"one_shot"},"targeting":{"type":"ground_point","range":18,"effect":"orb"},"impact":{"shape":"radial","origin":"target","radius":3,"damage":20}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}

	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	profile := catalog.Get("orbe_explosivo")
	if profile == nil || profile.Targeting == nil || profile.Targeting.Range != 18 || profile.Targeting.Effect != "orb" ||
		profile.Impact == nil || profile.Impact.Shape != "radial" || profile.Impact.Origin != "target" || profile.Impact.Radius != 3 || profile.Impact.Damage != 20 {
		t.Fatalf("unexpected targeted impact profile: %+v", profile)
	}
	if id, _ := catalog.GetByInputIntent("target_orbe"); id != "orbe_explosivo" {
		t.Fatalf("targeting input mapped to %q", id)
	}
}
