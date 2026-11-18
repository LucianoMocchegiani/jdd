package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestHandleInputStartsAuraAsSustainedWithoutOneShotEnqueue(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 5)
	sess.AddPlayer("player", 0, 0, 0, 0, 0)
	publisher := &swingPublisher{}
	profile := &port.CombatProfile{
		InputIntent: "continuous_aura", ControlType: "sustained", ManaCostPerSecond: 5,
		DamageInterval: 1e9, Impact: &port.DamageProfile{Shape: "radial", Radius: 3, Damage: 5},
	}
	svc := &usecase.Services{Sessions: store, SwingPub: publisher, Combat: inputAttackCatalog{"aura_de_ki": profile}}
	if _, ok := svc.HandleInput(usecase.InputPayload{
		BloqueID: "block", EcoID: 5, PlayerID: "player", Seq: 1, Intents: map[string]bool{"continuous_aura": true},
	}); !ok {
		t.Fatal("aura input rejected")
	}
	player, _ := sess.GetPlayer("player")
	if player.ContinuousAttackID != "aura_de_ki" || player.ActionID != "aura_de_ki" || player.ActionSeq != 1 || publisher.calls != 0 {
		t.Fatalf("aura was not started as sustained: state=%+v published=%d", player, publisher.calls)
	}
}
