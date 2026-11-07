// Package port — Puertos hexagonales del game-server.
package port

import "time"

// DamageProfile is the server-resolved reach and damage for an action impact.
type DamageProfile struct {
	Reach  float64
	Damage float64
}

// CombatProfile contains the combat rules configured on a shared action.
type CombatProfile struct {
	Cooldown          time.Duration
	BlockedMediums    []string
	WorldDamage       *DamageProfile
	EntityDamage      *DamageProfile
}

// CombatCatalog resolves a known action without trusting client-provided combat values.
type CombatCatalog interface {
	Get(actionID string) *CombatProfile
}
