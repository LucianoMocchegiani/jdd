package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/infrastructure/combat"
)

func TestActionCombatProfileLoad(t *testing.T) {
	c, err := combat.LoadCatalog("../../../../shared/game-data/actions/body-actions.json")
	if err != nil { t.Skip("shared action data not in cwd:", err) }
	p := c.Get("attack")
	if p == nil || p.Impact == nil || p.Impact.Reach != 2 || p.Impact.Damage != 15 { t.Fatalf("unexpected profile: %+v", p) }
	aura := c.Get("aura_de_ki")
	if aura == nil || aura.Impact == nil || aura.Impact.Shape != "radial" || aura.Impact.Radius != 3 { t.Fatalf("unexpected aura profile: %+v", aura) }
	projectile := c.Get("kamehameha")
	if projectile == nil || projectile.ProjectileDamage != 30 { t.Fatalf("unexpected projectile profile: %+v", projectile) }
}
