// Package entity — Entidades de dominio (sesión, jugador, terreno).
package entity

import "fmt"

// SessionKey ejecuta session key.
func SessionKey(bloqueID string, ecoID int) string {
	return fmt.Sprintf("%s:%d", bloqueID, ecoID)
}
