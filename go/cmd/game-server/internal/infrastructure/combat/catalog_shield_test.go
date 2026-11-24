package combat

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadKiShieldDefenseProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"escudo_de_ki","cooldownMs":10000,"manaCost":10,"control":{"inputIntent":"attack_ki_shield","type":"one_shot"},"defense":{"shape":"cone","absorption":50,"durationMs":5000,"angleDegrees":120}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil { t.Fatal(err) }
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	profile := catalog.Get("escudo_de_ki")
	if profile == nil || profile.Defense == nil || profile.Defense.Absorption != 50 || profile.Defense.Duration != 5*time.Second || profile.Defense.AngleDegrees != 120 || profile.Cooldown != 10*time.Second || profile.ManaCost != 10 {
		t.Fatalf("unexpected shield profile: %+v", profile)
	}
	if id, byIntent := catalog.GetByInputIntent("attack_ki_shield"); id != "escudo_de_ki" || byIntent != profile { t.Fatalf("shield intent resolved to %q/%+v", id, byIntent) }
}
