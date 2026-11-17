package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestHandleInputStartsContinuousAttackWithoutQueueingOneShot(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 4)
	sess.AddPlayer("player", 0, 0, 0, 0, 0)
	publisher := &swingPublisher{}
	profile := &port.CombatProfile{
		InputIntent: "continuous_attack", ControlType: "sustained", ManaCostPerSecond: 5,
		DamageInterval: 1e9, Impact: &port.DamageProfile{Reach: 28, Width: 0.55, Damage: 5},
	}
	svc := &usecase.Services{Sessions: store, SwingPub: publisher, Combat: inputAttackCatalog{"rayo_de_ki": profile}}

	if _, ok := svc.HandleInput(usecase.InputPayload{BloqueID: "block", EcoID: 4, PlayerID: "player", Seq: 1, Intents: map[string]bool{"continuous_attack": true}}); !ok {
		t.Fatal("continuous input rejected")
	}
	player, _ := sess.GetPlayer("player")
	if player.ContinuousAttackID != "rayo_de_ki" || player.ActionID != "rayo_de_ki" || player.ActionSeq != 1 || publisher.calls != 0 {
		t.Fatalf("continuous input state=%+v published=%d, want active and no one-shot", player, publisher.calls)
	}
}
