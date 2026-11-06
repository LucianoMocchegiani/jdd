// Package port — Puertos hexagonales del game-server.
package port

// CombatProfile is the server-resolved impact data for a shared action.
type CombatProfile struct {
	Reach  float64
	Damage float64
}

// CombatCatalog resolves a known action without trusting client-provided damage values.
type CombatCatalog interface {
	Get(actionID string) *CombatProfile
}
