package medium

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveContactReturnsDominantParticleType(t *testing.T) {
	dir := t.TempDir()
	rulesPath, particlesPath := filepath.Join(dir, "medium.json"), filepath.Join(dir, "particles.json")
	if err := os.WriteFile(rulesPath, []byte(`{"rules":{"submergedFullRatio":0.55,"submergedPartialRatio":0.12,"groundSolidCellsMin":1},"resolutionOrder":["submerged_full","submerged_partial","ground","air"]}`), 0600); err != nil { t.Fatal(err) }
	if err := os.WriteFile(particlesPath, []byte(`{"submergedCountFamilies":["liquid"],"typeOverrides":{},"defaultByPhysics":{"liquido":{"family":"liquid"},"solido":{"family":"solid"}}}`), 0600); err != nil { t.Fatal(err) }
	resolver, err := Load(rulesPath, particlesPath)
	if err != nil { t.Fatal(err) }
	contact := resolver.ResolveContact([]Particle{{X: 0, Y: 0, Z: 0, Name: "agua", Physics: "liquido"}, {X: 0, Y: 0, Z: 1, Name: "agua", Physics: "liquido"}, {X: 1, Y: 0, Z: 0, Name: "lava", Physics: "liquido"}}, false, 0, 0, 0, 2)
	if contact.DominantType != "agua" || contact.Medium != "submerged_full" { t.Fatalf("contact = %+v", contact) }
}
