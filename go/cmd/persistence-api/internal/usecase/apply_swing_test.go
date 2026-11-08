// Tests: Casos de uso REST y combate.
package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/infrastructure/combat"
)

func TestActionCombatProfileLoad(t *testing.T) {
	c, err := combat.LoadCatalog("../../../../shared/game-data/actions/body-actions.json")
	if err != nil { t.Skip("shared action data not in cwd:", err) }
	p := c.Get("attack")
	if p == nil || p.WorldDamage == nil || p.EntityDamage == nil { t.Fatal("expected action profile with world and entity damage") }
	if p.WorldDamage.Reach != 2 || p.WorldDamage.Damage != 15 || p.EntityDamage.Reach != 2 || p.EntityDamage.Damage != 15 { t.Fatalf("unexpected profile: %+v", p) }
}
