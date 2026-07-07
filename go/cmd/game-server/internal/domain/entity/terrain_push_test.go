// Tests: Entidades de dominio (sesión, jugador, terreno).
package entity_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
)

func TestMarkChunkReadyCompletesRound(t *testing.T) {
	st := entity.NewTerrainPushState("b1", 1, 0, 0, 1)
	st.SetPending([]string{"0,0", "1,0"})

	matched, done := st.MarkChunkReady("0,0")
	if !matched || done {
		t.Fatalf("expected partial match, done=%v", done)
	}
	matched, done = st.MarkChunkReady("1,0")
	if !matched || !done {
		t.Fatal("expected round complete")
	}
	_, sent, pending := st.Snapshot()
	if sent != 2 || pending != 0 {
		t.Fatalf("sent=%d pending=%d", sent, pending)
	}
}

func TestMarkChunkReadyIgnoresUnknownChunk(t *testing.T) {
	st := entity.NewTerrainPushState("b1", 1, 0, 0, 1)
	st.SetPending([]string{"0,0"})
	matched, _ := st.MarkChunkReady("9,9")
	if matched {
		t.Fatal("unexpected match")
	}
}
