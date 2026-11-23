package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRadialImpactProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"trueno","targeting":{"type":"ground_point","range":18,"effect":"thunder"},"impact":{"shape":"radial","origin":"target","radius":2,"damage":25}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}

	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	impact := catalog.Get("trueno").Impact
	if impact == nil || impact.Shape != "radial" || impact.Origin != "target" || impact.Radius != 2 || impact.Damage != 25 {
		t.Fatalf("unexpected radial impact profile: %+v", impact)
	}
}
