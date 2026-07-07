// Package wire — Codificación wire binaria (MsgPack) inter-servicio/cliente.
package wire

import (
	"encoding/json"

	"github.com/vmihailenco/msgpack/v5"
)

// EncodePlayerStateFromJSON ejecuta encode player state from json.
func EncodePlayerStateFromJSON(jsonPayload string) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(jsonPayload), &payload); err != nil {
		return nil, err
	}
	return msgpack.Marshal(payload)
}

// DecodePlayerState ejecuta decode player state.
func DecodePlayerState(data []byte) (map[string]interface{}, error) {
	var payload map[string]interface{}
	if err := msgpack.Unmarshal(data, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}
