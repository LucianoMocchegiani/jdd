package usecase_test

import (
	"math"
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestHandleInputStartsDashUsingServerProfile(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 0, 0, 1, 0, 0)
	svc := &usecase.Services{Sessions: store, Combat: inputAttackCatalog{
		"esquive_rapido": {InputIntent: "attack_dodge", ControlType: "one_shot", Cooldown: 2 * time.Second,
			Movement: &port.MovementProfile{DashDistance: 8, DashDuration: 280 * time.Millisecond}},
	}}
	response, ok := svc.HandleInput(usecase.InputPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", Seq: 1, Intents: map[string]bool{"attack_dodge": true}})
	if !ok { t.Fatalf("dash input rejected: %s", response) }
	p, _ := sess.GetPlayer("player")
	if p.ActionID != "esquive_rapido" || p.ActionSeq != 1 || math.Abs(p.DashRemaining-0.28) > 1e-9 || p.DashVY >= 0 || p.Mana != 100 {
		t.Fatalf("unexpected dash state: action=%q/%d dash=%v velocity=(%v,%v) mana=%v", p.ActionID, p.ActionSeq, p.DashRemaining, p.DashVX, p.DashVY, p.Mana)
	}
}
