package usecase

import (
	"strings"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
)

type testTerrainPublisher struct{}

func (testTerrainPublisher) PublishChunkRequest(port.ChunkRequest) error { return nil }

func TestPlayerActivatesOnlyAfterInitialTerrainIsReady(t *testing.T) {
	hub := wshub.NewHub()
	conn := hub.Register(nil)
	hub.BindPending(conn.ID, wshub.JoinInfo{BloqueID: "block", EcoID: 1, PlayerID: "player"})
	terrain := NewTerrainPushManager()
	state := entity.NewTerrainPushState("block", conn.ID, 0, 0, 1)
	state.SetPending([]string{"0,0"})
	terrain.register(state)
	store := memory.NewSessionStore()
	svc := &Services{Sessions: store, Hub: hub, TerrainPush: terrain}

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

func TestPreparedJoinRetainsTerrainCollisionGridUntilActivation(t *testing.T) {
	hub := wshub.NewHub()
	conn := hub.Register(nil)
	store := memory.NewSessionStore()
	svc := &Services{
		Sessions: store, Hub: hub, TerrainPush: NewTerrainPushManager(),
		TerrainPub: testTerrainPublisher{},
		SessionCfg: &session.Config{ChunkSizeCells: 40, TerrainCollisionLoadRadiusCells: 1},
	}

	res := svc.JoinBlock(JoinBlockInput{BloqueID: "block", PlayerID: "player", ConnID: conn.ID, DeferActivation: true, X: 2, Y: 3})
	if res.JoinErrJSON != "" {
		t.Fatalf("prepare join failed: %s", res.JoinErrJSON)
	}
	sess, exists := store.Get("block", 1)
	if !exists || sess.PlayerCount() != 0 {
		t.Fatal("prepare join should keep collision session without activating a player")
	}

	svc.HandleChunkReady(port.ChunkReady{BloqueID: "block", ChunkCX: 0, ChunkCY: 0, SolidCells: []string{"2,3,4"}})
	res = svc.ActivatePlayer(conn.ID, [3]float64{2, 3, 5})
	if res.JoinOKJSON == "" || !sess.SolidGrid.IsCellSolid(2, 3, 4) {
		t.Fatal("terrain solids must remain in the authoritative collision grid after activation")
	}
}
