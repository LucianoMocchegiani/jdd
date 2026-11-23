package combat

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadActionCombatProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"attack","cooldownMs":500,"control":{"inputIntent":"attack_light","when":{"not":{"medium":["air","submerged_full"]}}},"impact":{"reach":2,"damage":15}},{"id":"kamehameha","cooldownMs":3000,"manaCost":20,"control":{"inputIntent":"attack_projectile"},"impact":{"shape":"projectile","origin":"caster","speed":18,"reach":28,"damage":30,"radius":0.55,"delayMs":1033}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil { t.Fatal(err) }
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	p := catalog.Get("attack")
	if p == nil || p.InputIntent != "attack_light" || p.Cooldown != 500*time.Millisecond || p.Impact == nil || p.Impact.Shape != "line" || p.Impact.Reach != 2 || p.Impact.Damage != 15 || len(p.BlockedMediums) != 2 {
		t.Fatalf("unexpected action profile: %+v", p)
	}
	if id, profile := catalog.GetByInputIntent("attack_projectile"); id != "kamehameha" || profile != catalog.Get(id) {
		t.Fatalf("projectile input resolved to %q/%+v", id, profile)
	}
	projectileProfile := catalog.Get("kamehameha")
	impact := projectileProfile.Impact
	if projectileProfile.ManaCost != 20 || impact == nil || impact.Shape != "projectile" || impact.Origin != "caster" || impact.Speed != 18 || impact.Reach != 28 || impact.Damage != 30 || impact.Radius != 0.55 || impact.DelayMs != 1033 {
		t.Fatalf("unexpected projectile impact profile: %+v", projectileProfile)
	}
}

func TestLoadSustainedKiBeamProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"rayo_de_ki","manaCostPerSecond":5,"damageIntervalMs":1000,"control":{"inputIntent":"continuous_attack","type":"sustained"},"impact":{"reach":28,"width":0.55,"damage":5}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil { t.Fatal(err) }
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	p := catalog.Get("rayo_de_ki")
	if p == nil || p.ControlType != "sustained" || p.ManaCostPerSecond != 5 || p.DamageInterval != time.Second || p.Impact == nil || p.Impact.Shape != "line" || p.Impact.Width != 0.55 {
		t.Fatalf("unexpected sustained profile: %+v", p)
	}
}
