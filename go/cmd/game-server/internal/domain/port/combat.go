// Package port — Puertos hexagonales del game-server.
package port

// EntityDamageProfile is server-resolved damage against player hitboxes.
type EntityDamageProfile struct {
	Reach  float64
	Damage float64
}

// CombatProfile contains the impact types configured for a shared action.
type CombatProfile struct {
	WorldDamage  bool
	EntityDamage *EntityDamageProfile
}

// CombatCatalog resolves a known action without trusting client-provided damage values.
type CombatCatalog interface {
	Get(actionID string) *CombatProfile
}
