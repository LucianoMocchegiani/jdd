package combat

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadAreaAction(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	data := `{"actions":[{"id":"orbe_explosivo","cooldownMs":3000,"manaCost":20,"control":{"inputIntent":"target_orbe","type":"one_shot"},"area":{"range":18,"radius":3,"damage":20,"effect":"orb"}}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}

	catalog, err := LoadCatalog(path)
	if err != nil {
		t.Fatal(err)
	}
	profile := catalog.Get("orbe_explosivo")
	if profile == nil || profile.Area == nil || profile.Area.Range != 18 || profile.Area.Radius != 3 || profile.Area.Damage != 20 || profile.Area.Effect != "orb" {
		t.Fatalf("unexpected area profile: %+v", profile)
	}
	if id, _ := catalog.GetByInputIntent("target_orbe"); id != "orbe_explosivo" {
		t.Fatalf("area input mapped to %q", id)
	}
}
