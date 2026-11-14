package combat

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadActionCombatProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"attack","cooldownMs":500,"control":{"inputIntent":"attack_light","when":{"not":{"medium":["air","submerged_full"]}}},"impact":{"reach":2,"damage":15}},{"id":"kamehameha","cooldownMs":3000,"manaCost":20,"control":{"inputIntent":"attack_projectile"},"projectile":{"speed":18,"range":28,"damage":30,"radius":0.55,"delayMs":1033}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	p := catalog.Get("attack")
	if p == nil || p.InputIntent != "attack_light" || p.Cooldown != 500*time.Millisecond || p.Impact == nil || p.Impact.Reach != 2 || p.Impact.Damage != 15 || len(p.BlockedMediums) != 2 {
		t.Fatalf("unexpected action profile: %+v", p)
	}
	if id, profile := catalog.GetByInputIntent("attack_projectile"); id != "kamehameha" || profile != catalog.Get(id) {
		t.Fatalf("projectile input resolved to %q/%+v", id, profile)
	}
	projectileProfile := catalog.Get("kamehameha")
	projectile := projectileProfile.Projectile
	if projectileProfile.ManaCost != 20 || projectile == nil || projectile.Speed != 18 || projectile.Range != 28 || projectile.Damage != 30 || projectile.Radius != 0.55 || projectile.Delay != 1033*time.Millisecond {
		t.Fatalf("unexpected projectile profile: %+v", projectileProfile)
	}
}
