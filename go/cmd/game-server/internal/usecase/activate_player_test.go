package usecase_test

import (
	"strings"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestPlayerActivatesOnlyAfterInitialTerrainIsReady(t *testing.T) {
	hub := wshub.NewHub()
	conn := hub.Register(nil)
	hub.BindPending(conn.ID, wshub.JoinInfo{BloqueID: "block", EcoID: 1, PlayerID: "player"})
	terrain := usecase.NewTerrainPushManager()
	state := entity.NewTerrainPushState("block", conn.ID, 0, 0, 1)
	state.SetPending([]string{"0,0"})
	terrainState := state
	// Keep this test at the use-case boundary while modeling the pending chunk.
	registerTerrainState(terrain, terrainState)
	store := memory.NewSessionStore()
	svc := &usecase.Services{Sessions: store, Hub: hub, TerrainPush: terrain}

	res := svc.ActivatePlayer(conn.ID, [3]float64{2, 3, 4})
	if !strings.Contains(res.JoinErrJSON, "terrain_not_ready") {
		t.Fatalf("activation should wait for terrain: %+v", res)
	}
	if _, exists := store.Get("block", 1); exists {
		t.Fatal("player session must not be created before terrain is ready")
	}

	state.MarkChunkReady("0,0")
	res = svc.ActivatePlayer(conn.ID, [3]float64{2, 3, 4})
	if res.JoinOKJSON == "" || !hub.IsActive(conn.ID) {
		t.Fatalf("expected active join after terrain load: %+v", res)
	}
	player, exists := store.Get("block", 1)
	if !exists {
		t.Fatal("active player session was not created")
	}
	spawned, exists := player.GetPlayer("player")
	if !exists || spawned.Z != 4 {
		t.Fatalf("player did not spawn at resolved position: %+v", spawned)
	}
}
