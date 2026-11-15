package combat

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSustainedImpactWidth(t *testing.T) {
	path := filepath.Join(t.TempDir(), "actions.json")
	if err := os.WriteFile(path, []byte(`{"actions":[{"id":"rayo_de_ki","impact":{"reach":28,"width":0.55,"damage":5}}]}`), 0600); err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadCatalog(path)
	if err != nil { t.Fatal(err) }
	if got := catalog.Get("rayo_de_ki").Impact.Width; got != 0.55 {
		t.Fatalf("width = %v, want 0.55", got)
	}
}
