package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadAreaDamageProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"trueno","area":{"radius":2,"damage":25}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}

	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	profile := catalog.Get("trueno")
	if profile == nil || profile.Area == nil || profile.Area.Radius != 2 || profile.Area.Damage != 25 {
		t.Fatalf("unexpected area damage profile: %+v", profile)
	}
}
