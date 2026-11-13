package usecase_test

import (
	"encoding/json"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestBuildAllPlayerStatesPublishesAcceptedActionSequence(t *testing.T) {
	sess := memory.NewSessionStore().GetOrCreate("block", 1)
	sess.AddPlayer("player", 0, 0, 0, 0, 0)
	sess.UpdatePlayer("player", func(p *entity.Player) {
		p.ActionID = "kamehameha"
		p.ActionSeq = 3
	})

	states := usecase.BuildAllPlayerStates(sess, 1)
	var state struct {
		ActionID  string `json:"action_id"`
		ActionSeq int    `json:"action_seq"`
	}
	if len(states) != 1 || json.Unmarshal([]byte(states[0]), &state) != nil {
		t.Fatalf("unexpected player states: %v", states)
	}
	if state.ActionID != "kamehameha" || state.ActionSeq != 3 {
		t.Fatalf("published action event = %q/%d, want kamehameha/3", state.ActionID, state.ActionSeq)
	}
}
