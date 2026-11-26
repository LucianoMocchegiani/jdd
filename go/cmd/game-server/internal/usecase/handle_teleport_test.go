package usecase_test

import (
	"encoding/json"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
	"github.com/juego-de-dioses/jd/pkg/jd/cellkey"
)

func teleportProfile() *port.CombatProfile {
	return &port.CombatProfile{
		ManaCost: 20,
		Targeting: &port.TargetingProfile{Type: "ground_point", Range: 18, Effect: "teleport"},
	}
}

func TestTeleportSpendsManaAndMovesPlayerToFreeGroundPoint(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("caster", 0, 0, 1, 0, 0)
	sess.SolidGrid.MergeSolidCells([]string{cellkey.Format(3, 0, 0)})
	svc := &usecase.Services{Sessions: store, Combat: combatCatalog{"teletransporte": teleportProfile()}}
	response, failed := svc.HandleAreaSpell(usecase.AreaSpellPayload{
		BloqueID: "block", EcoID: 1, PlayerID: "caster", Seq: 1, ActionID: "teletransporte",
		Target: port.AreaTarget{X: 3, Y: 0, Z: 0.45},
	})
	var ack struct {
		Type string `json:"type"`
		Seq int `json:"seq"`
		ActionID string `json:"action_id"`
	}
	player, _ := sess.GetPlayer("caster")
	if failed || json.Unmarshal([]byte(response), &ack) != nil || ack.Type != "swing_queued" || ack.Seq != 1 || ack.ActionID != "teletransporte" {
		t.Fatalf("valid teleport was rejected: response=%q", response)
	}
	if player.X != 3 || player.Y != 0 || player.Z != 1 || player.Mana != 80 {
		t.Fatalf("unexpected teleport state: position=(%v,%v,%v) mana=%v", player.X, player.Y, player.Z, player.Mana)
	}
}

func TestTeleportRejectsBlockedLandingWithoutSpendingMana(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("caster", 0, 0, 1, 0, 0)
	sess.SolidGrid.MergeSolidCells([]string{cellkey.Format(3, 0, 0), cellkey.Format(3, 0, 1)})
	svc := &usecase.Services{Sessions: store, Combat: combatCatalog{"teletransporte": teleportProfile()}}
	_, failed := svc.HandleAreaSpell(usecase.AreaSpellPayload{
		BloqueID: "block", EcoID: 1, PlayerID: "caster", Seq: 1, ActionID: "teletransporte",
		Target: port.AreaTarget{X: 3, Y: 0, Z: 0.45},
	})
	player, _ := sess.GetPlayer("caster")
	if !failed || player.X != 0 || player.Z != 1 || player.Mana != 100 {
		t.Fatalf("invalid landing changed player: position=(%v,%v,%v) mana=%v", player.X, player.Y, player.Z, player.Mana)
	}
}
