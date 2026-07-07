// Tests: Modelos Eco y Assignment.
package domain_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/registry/internal/domain"
)

func TestEcoLabel(t *testing.T) {
	if got := domain.EcoLabel("bloque-1", 2, "normal"); got != "Eco 2" {
		t.Fatalf("got %q", got)
	}
	if got := domain.EcoLabel("bloque-1", 1, "war"); got != "Eco 1 (guerra)" {
		t.Fatalf("got %q", got)
	}
}
