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
	SweepDegrees  float64 `json:"sweepDegrees,omitempty"`
	Speed         float64 `json:"speed,omitempty"`
	DelayMs       int     `json:"delayMs,omitempty"`
	Damage        float64 `json:"damage"`
}

// DefenseProfile configures the cone-shaped shield object created by a defensive action.
type DefenseProfile struct {
	Shape        string        `json:"shape"`
	Absorption   float64       `json:"absorption"`
	Duration     time.Duration `json:"-"`
	AngleDegrees float64       `json:"angleDegrees"`
}

// TargetingProfile configures how a player selects an impact point.
type TargetingProfile struct {
	Type   string  `json:"type"`
	Range  float64 `json:"range"`
	Effect string  `json:"effect"`
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
	Defense           *DefenseProfile
	Targeting         *TargetingProfile
}

// CombatCatalog resolves trusted combat rules from the shared action registry.
type CombatCatalog interface { Get(actionID string) *CombatProfile }
