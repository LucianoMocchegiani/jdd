// Tests: Casos de uso REST y combate.
package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/infrastructure/combat"
)

func TestCombatCatalogLoad(t *testing.T) {
	c, err := combat.LoadCatalog("../../../../shared/game-data/actions/combat-catalog.json")
	if err != nil {
		t.Skip("combat catalog not in cwd:", err)
	}
	p := c.Get("attack")
	if p == nil || p.WorldDamage == nil {
		t.Fatal("expected attack profile with world damage")
	}
	if p.WorldDamage.Reach != 2 || p.WorldDamage.Damage != 15 {
		t.Fatalf("unexpected profile: %+v", p.WorldDamage)
	}
}
