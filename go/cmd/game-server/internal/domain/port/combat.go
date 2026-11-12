// Package port — Puertos hexagonales del game-server.
package port

import "time"

// DamageProfile is the shared reach and damage budget for an action impact.
type DamageProfile struct {
	Reach  float64 `json:"reach"`
	Damage float64 `json:"damage"`
}

// ProjectileProfile configures a reusable discrete projectile in world units.
type ProjectileProfile struct {
	Speed  float64
	Range  float64
	Damage float64
	Radius float64
	Delay  time.Duration
}

// CombatProfile contains the combat rules configured on a shared action.
type CombatProfile struct {
	Cooldown       time.Duration
	BlockedMediums []string
	Impact         *DamageProfile
	Projectile     *ProjectileProfile
}

// CombatCatalog resolves a known action without trusting client-provided combat values.
type CombatCatalog interface {
	Get(actionID string) *CombatProfile
}
