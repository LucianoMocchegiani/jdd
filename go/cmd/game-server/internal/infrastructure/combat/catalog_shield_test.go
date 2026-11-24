package combat

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadKiShieldDefenseProfiles(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"escudo_de_ki","cooldownMs":10000,"manaCost":10,"control":{"inputIntent":"attack_ki_shield","type":"one_shot"},"defense":{"shape":"cone","absorption":50,"durationMs":5000,"angleDegrees":120}},{"id":"escudo_radial_de_ki","manaCostPerSecond":5,"control":{"inputIntent":"continuous_ki_shield","type":"sustained"},"defense":{"shape":"radial","absorption":50,"durationMs":5000}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil { t.Fatal(err) }
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	cone := catalog.Get("escudo_de_ki")
	if cone == nil || cone.Defense == nil || cone.Defense.Absorption != 50 || cone.Defense.Duration != 5*time.Second || cone.Defense.AngleDegrees != 120 || cone.Cooldown != 10*time.Second || cone.ManaCost != 10 {
		t.Fatalf("unexpected cone profile: %+v", cone)
	}
	radial := catalog.Get("escudo_radial_de_ki")
	if radial == nil || radial.Defense == nil || radial.Defense.Shape != "radial" || radial.Defense.Absorption != 50 || radial.ManaCostPerSecond != 5 || radial.ControlType != "sustained" {
		t.Fatalf("unexpected continuous radial profile: %+v", radial)
	}
	if id, byIntent := catalog.GetByInputIntent("continuous_ki_shield"); id != "escudo_radial_de_ki" || byIntent != radial {
		t.Fatalf("shield intent resolved to %q/%+v", id, byIntent)
	}
}
