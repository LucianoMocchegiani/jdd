// Tests: Codificación wire binaria (MsgPack) inter-servicio/cliente.
package wire_test

import (
	"encoding/json"
	"testing"

	jdwire "github.com/juego-de-dioses/jd/pkg/jd/wire"
)

func TestPlayerStateMsgpackRoundtrip(t *testing.T) {
	raw := `{"type":"player_state","server_tick":1,"player_id":"p1","bloque_id":"b1","x":1.5,"y":2,"z":3}`
	b, err := jdwire.EncodePlayerStateFromJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	m, err := jdwire.DecodePlayerState(b)
	if err != nil {
		t.Fatal(err)
	}
	if m["type"] != "player_state" || m["player_id"] != "p1" {
		t.Fatalf("map: %v", m)
	}
}

func TestResolveFormat(t *testing.T) {
	if got := jdwire.ResolveFormat(jdwire.FormatMsgpack, jdwire.FormatJSON); got != jdwire.FormatJSON {
		t.Fatalf("server json only: %s", got)
	}
	if got := jdwire.ResolveFormat(jdwire.FormatMsgpack, jdwire.FormatMsgpack); got != jdwire.FormatMsgpack {
		t.Fatalf("both msgpack: %s", got)
	}
	if got := jdwire.ResolveFormat(jdwire.FormatJSON, jdwire.FormatMsgpack); got != jdwire.FormatJSON {
		t.Fatalf("client json: %s", got)
	}
}

func TestResolveFormatJSONKeys(t *testing.T) {
	raw := `{"type":"player_state","intents":{"run":true}}`
	b, _ := jdwire.EncodePlayerStateFromJSON(raw)
	m, _ := jdwire.DecodePlayerState(b)
	intents, ok := m["intents"].(map[string]interface{})
	if !ok {
		// msgpack may decode map[interface{}]interface{}
		b2, _ := json.Marshal(m["intents"])
		var intents2 map[string]interface{}
		_ = json.Unmarshal(b2, &intents2)
		intents = intents2
	}
	if intents == nil {
		t.Fatalf("intents missing: %v", m)
	}
}
