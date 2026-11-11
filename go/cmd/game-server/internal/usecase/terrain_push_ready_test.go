package usecase

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
)

func TestTerrainPushReadyWaitsForEveryInitialChunk(t *testing.T) {
	manager := NewTerrainPushManager()
	if manager.IsReady(1) {
		t.Fatal("unknown connection cannot be ready")
	}
	state := entity.NewTerrainPushState("block", 1, 0, 0, 1)
	state.SetPending([]string{"0,0", "1,0"})
	manager.register(state)
	if manager.IsReady(1) {
		t.Fatal("pending chunks must block activation")
	}
	state.MarkChunkReady("0,0")
	if manager.IsReady(1) {
		t.Fatal("all chunks must arrive before activation")
	}
	state.MarkChunkReady("1,0")
	if !manager.IsReady(1) {
		t.Fatal("connection should be ready after every chunk arrives")
	}
}
