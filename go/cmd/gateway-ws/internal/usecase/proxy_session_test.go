// Tests: Sesión proxy: resolve registry y reenvío WS.
package usecase

import (
	"encoding/json"
	"testing"
)

func TestPatchJoinBlockEnforcesPlayerID(t *testing.T) {
	raw := []byte(`{"type":"join_block","bloque_id":"b1","player_id":"spoof","position":{"x":0,"y":0,"z":0}}`)
	out, err := patchJoinBlock(raw, "trusted-player", true)
	if err != nil {
		t.Fatal(err)
	}
	var msg map[string]interface{}
	if err := json.Unmarshal(out, &msg); err != nil {
		t.Fatal(err)
	}
	if msg["player_id"] != "trusted-player" {
		t.Fatalf("got %v", msg["player_id"])
	}
}

func TestParseJoinBlock(t *testing.T) {
	_, err := parseJoinBlock([]byte(`{"type":"input"}`))
	if err != ErrNotJoinBlock {
		t.Fatalf("got %v", err)
	}
	join, err := parseJoinBlock([]byte(`{"type":"join_block","bloque_id":"b","player_id":"p"}`))
	if err != nil || join.BloqueID != "b" || join.PlayerID != "p" {
		t.Fatalf("join: %+v err %v", join, err)
	}
}
