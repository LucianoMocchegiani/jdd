package medium

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveUsesSharedParticleAndMediumRules(t *testing.T) {
	dir := t.TempDir()
	rulesPath, particlesPath := filepath.Join(dir, "medium.json"), filepath.Join(dir, "particles.json")
	if err := os.WriteFile(rulesPath, []byte(`{"rules":{"submergedFullRatio":0.55,"submergedPartialRatio":0.12,"groundSolidCellsMin":1},"resolutionOrder":["submerged_full","submerged_partial","ground","air"]}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(particlesPath, []byte(`{"submergedCountFamilies":["liquid","granular"],"typeOverrides":{"arena":{"family":"granular","contributesTo":["ground","submerged"]}},"defaultByPhysics":{"liquido":{"family":"liquid"},"solido":{"family":"solid"}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	resolver, err := Load(rulesPath, particlesPath)
	if err != nil {
		t.Fatal(err)
	}
	liquid := []Particle{{X: 0, Y: 0, Z: 0, Name: "agua", Physics: "liquido"}, {X: 1, Y: 0, Z: 0, Name: "agua", Physics: "liquido"}}
	if got := resolver.Resolve(liquid, false, 0, 0, 0, 2); got != "submerged_full" {
		t.Fatalf("expected full submersion, got %s", got)
	}
	partial := []Particle{
		{X: 0, Y: 0, Z: 0, Name: "agua", Physics: "liquido"},
		{X: 1, Y: 0, Z: 0, Name: "piedra", Physics: "solido"},
		{X: 0, Y: 1, Z: 0, Name: "piedra", Physics: "solido"},
		{X: -1, Y: 0, Z: 0, Name: "piedra", Physics: "solido"},
		{X: 0, Y: -1, Z: 0, Name: "piedra", Physics: "solido"},
	}
	if got := resolver.Resolve(partial, false, 0, 0, 0, 2); got != "submerged_partial" {
		t.Fatalf("expected partial submersion, got %s", got)
	}
	if got := resolver.Resolve(nil, true, 0, 0, 1, 2); got != "ground" {
		t.Fatalf("expected ground, got %s", got)
	}

	edgeGround := []Particle{{X: 1, Y: 0, Z: -1, Name: "piedra", Physics: "solido"}}
	if got := resolver.Resolve(edgeGround, false, 0.6, 0, 0, 2); got != "ground" {
		t.Fatalf("expected centered particle below feet to resolve ground, got %s", got)
	}
}
