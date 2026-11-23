// Package port defines the game-server's combat configuration and publishing contracts.
package port

import "time"

// DamageProfile defines impact geometry independently from action cycle and target selection.
type DamageProfile struct {
	Shape         string  `json:"shape,omitempty"`
	Origin        string  `json:"origin,omitempty"`
	BlockBySolids bool    `json:"blockBySolids,omitempty"`
	Reach         float64 `json:"reach,omitempty"`
	Width         float64 `json:"width,omitempty"`
	Radius        float64 `json:"radius,omitempty"`
	Damage        float64 `json:"damage"`
}

// TargetingProfile configures how a player selects an impact point.
type TargetingProfile struct {
	Type   string  `json:"type"`
	Range  float64 `json:"range"`
	Effect string  `json:"effect"`
}

// ProjectileProfile configures projectile movement, collision, damage, and optional delay.
type ProjectileProfile struct {
	Speed  float64
	Range  float64
	Damage float64
	Radius float64
	Delay  time.Duration
}

// CombatProfile contains server-owned rules for one action, not client-supplied combat values.
type CombatProfile struct {
	InputIntent       string
	ControlType       string
	Cooldown          time.Duration
	ManaCost          float64
	ManaCostPerSecond float64
	DamageInterval    time.Duration
	BlockedMediums    []string
	Impact            *DamageProfile
	Targeting         *TargetingProfile
	Projectile        *ProjectileProfile
}

// CombatCatalog resolves trusted combat rules from the shared action registry.
type CombatCatalog interface { Get(actionID string) *CombatProfile }
