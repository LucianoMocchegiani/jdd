// Package port — Puertos hexagonales del game-server.
package port

import "time"

type DamageProfile struct {
	Reach  float64 `json:"reach"`
	Width  float64 `json:"width"`
	Damage float64 `json:"damage"`
}

type AreaProfile struct {
	Range  float64 `json:"range"`
	Radius float64 `json:"radius"`
	Damage float64 `json:"damage"`
	Effect string  `json:"effect"`
}

type ProjectileProfile struct {
	Speed  float64
	Range  float64
	Damage float64
	Radius float64
	Delay  time.Duration
}

type CombatProfile struct {
	InputIntent       string
	ControlType       string
	Cooldown          time.Duration
	ManaCost          float64
	ManaCostPerSecond float64
	DamageInterval    time.Duration
	BlockedMediums    []string
	Impact            *DamageProfile
	Area              *AreaProfile
	Projectile        *ProjectileProfile
}

type CombatCatalog interface {
	Get(actionID string) *CombatProfile
}
