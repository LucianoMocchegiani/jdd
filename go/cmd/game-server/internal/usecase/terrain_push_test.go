// Tests: Casos de uso: join, tick, input, terreno y destrucción.
package usecase_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestBuildTerrainChunkDone(t *testing.T) {
	wire := usecase.BuildTerrainChunkDone("bloque-1", 3, 5)
	if wire == "" {
		t.Fatal("empty wire")
	}
	if !contains(wire, "terrain_chunk_done") || !contains(wire, `"seq":3`) {
		t.Fatalf("unexpected payload: %s", wire)
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func TestNeedsChunkOnlyNew(t *testing.T) {
	st := entity.NewTerrainPushState("b", 1, 0, 0, 1)
	st.SetPending(nil)
	// simulate sent
	st.SetPending([]string{"0,0"})
	st.MarkChunkReady("0,0")

	if st.NeedsChunk("0,0", true) {
		t.Fatal("already sent")
	}
	if !st.NeedsChunk("1,0", true) {
		t.Fatal("new chunk should be needed")
	}
}
