// Package wire — Codificación wire binaria (MsgPack) inter-servicio/cliente.
package wire

const (
	FormatJSON    = "json"
	FormatMsgpack = "msgpack"
)

// ResolveFormat elige el formato acordado (M6).
// El servidor puede desactivar msgpack con WIRE_FORMAT=json.
func ResolveFormat(clientPref, serverDefault string) string {
	if serverDefault != FormatMsgpack {
		return FormatJSON
	}
	if clientPref == FormatMsgpack {
		return FormatMsgpack
	}
	return FormatJSON
}

// ValidFormat ejecuta valid format.
func ValidFormat(s string) bool {
	return s == FormatJSON || s == FormatMsgpack
}
