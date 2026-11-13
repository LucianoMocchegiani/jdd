package usecase_test

import (
	"encoding/json"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestPlayerStatesDoNotReplayOldActionsOnJoinButPublishAcceptedActionOncePerTick(t *testing.T) {
	sess := memory.NewSessionStore().GetOrCreate("block", 1)
	sess.AddPlayer("player", 0, 0, 0, 0, 0)
	sess.UpdatePlayer("player", func(p *entity.Player) {
		p.ActionID = "kamehameha"
		p.ActionSeq = 1
	})

	var state struct {
		ActionID  string `json:"action_id"`
		ActionSeq int    `json:"action_seq"`
	}
	decode := func(messages []string) {
		t.Helper()
		if len(messages) != 1 {
			t.Fatalf("unexpected player states: %v", messages)
		}
		state = struct {
			ActionID  string `json:"action_id"`
			ActionSeq int    `json:"action_seq"`
		}{}
		if err := json.Unmarshal([]byte(messages[0]), &state); err != nil {
			t.Fatalf("invalid player state: %v", err)
		}
	}

	decode(usecase.BuildAllPlayerStates(sess, 1))
	if state.ActionID != "" {
		t.Fatalf("join snapshot replayed old action: %q", state.ActionID)
	}
	decode(usecase.BuildAllPlayerStates(sess, 2))
	if state.ActionID != "" {
		t.Fatalf("non-tick state replayed old action: %q", state.ActionID)
	}
	decode(usecase.BuildTickPlayerStates(sess, 3))
	if state.ActionID != "kamehameha" || state.ActionSeq != 1 {
		t.Fatalf("published action event = %q/%d, want kamehameha/1", state.ActionID, state.ActionSeq)
	}
	decode(usecase.BuildTickPlayerStates(sess, 4))
	if state.ActionID != "" {
		t.Fatalf("action event was published more than once: %q", state.ActionID)
	}
}
