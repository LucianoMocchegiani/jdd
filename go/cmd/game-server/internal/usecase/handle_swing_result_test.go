package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestHandleSwingResultAppliesDamageToMatchingTargetEntity(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 3)
	sess.AddPlayer("attacker", 0, 0, 0, 0, 0)
	sess.AddPlayer("target", 0, -2, 0, 0, 0)
	svc := &usecase.Services{Sessions: store, Hub: wshub.NewHub()}

	svc.HandleSwingResult(usecase.SwingResultEvent{
		BloqueID: "block", EcoID: 3, PlayerID: "attacker", EntityID: 1,
		TargetPlayerID: "target", TargetEntityID: 2, EntityDamage: 25,
	})

	target, ok := sess.GetPlayer("target")
	if !ok || target.Health != 75 {
		t.Fatalf("expected target health 75, got %+v", target)
	}
}
