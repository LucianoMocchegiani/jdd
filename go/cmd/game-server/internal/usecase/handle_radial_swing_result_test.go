package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestHandleSwingResultAppliesRadialDamageToEachMatchingEntityOnce(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 7)
	sess.AddPlayer("attacker", 0, 0, 0, 0, 0)
	sess.AddPlayer("target-a", 0, -1, 0, 0, 0)
	sess.AddPlayer("target-b", 1, 0, 0, 0, 0)
	svc := &usecase.Services{Sessions: store, Hub: wshub.NewHub()}
	svc.HandleSwingResult(usecase.SwingResultEvent{
		BloqueID: "block", EcoID: 7, PlayerID: "attacker", EntityID: 1,
		PlayerHits: []usecase.SwingPlayerDamage{
			{PlayerID: "target-a", EntityID: 2, Damage: 5},
			{PlayerID: "target-b", EntityID: 3, Damage: 5},
			{PlayerID: "target-a", EntityID: 2, Damage: 5},
		},
	})
	for _, playerID := range []string{"target-a", "target-b"} {
		target, ok := sess.GetPlayer(playerID)
		if !ok || target.Health != 95 {
			t.Fatalf("%s health=%v, want 95", playerID, target.Health)
		}
	}
}
