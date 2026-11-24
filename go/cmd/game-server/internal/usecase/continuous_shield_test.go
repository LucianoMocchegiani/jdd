package usecase

import (
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

type continuousShieldCatalog map[string]*port.CombatProfile
func (c continuousShieldCatalog) Get(id string) *port.CombatProfile { return c[id] }

func TestContinuousRadialShieldDrainsManaWithoutPublishingDamage(t *testing.T) {
	session := entity.NewBlockSession("block", 1)
	_, player := session.AddPlayer("player", 0, 0, 0, 0, 0)
	player.ContinuousAttackID = "escudo_radial_de_ki"
	player.Intents = map[string]bool{"continuous_ki_shield": true}
	profile := &port.CombatProfile{InputIntent: "continuous_ki_shield", ControlType: "sustained", ManaCostPerSecond: 5,
		Defense: &port.DefenseProfile{Shape: "radial", Absorption: 50, Duration: 5 * time.Second}}
	if !session.CreateKiShield("player", "radial", 50, 0, 5*time.Second, time.Now()) { t.Fatal("shield creation failed") }
	svc := &Services{Combat: continuousShieldCatalog{"escudo_radial_de_ki": profile}}
	if _, published, remove := svc.advanceContinuousAttack(session, player, 0.1, time.Now(), true); published || remove { t.Fatal("active shield tick must not publish damage or remove shield") }
	if player.Mana != 99.5 || len(session.KiShieldStates(time.Now())) != 1 { t.Fatalf("sustained shield state: mana=%v shields=%v", player.Mana, session.KiShieldStates(time.Now())) }
}
