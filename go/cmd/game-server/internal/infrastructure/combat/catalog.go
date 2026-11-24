// Package combat loads combat profiles from the shared action registry.
package combat

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

type actionFile struct {
	Actions []struct {
		ID                string  `json:"id"`
		CooldownMs        int     `json:"cooldownMs"`
		ManaCost          float64 `json:"manaCost"`
		ManaCostPerSecond float64 `json:"manaCostPerSecond"`
		DamageIntervalMs  int     `json:"damageIntervalMs"`
		Control           struct {
			InputIntent string `json:"inputIntent"`
			Type        string `json:"type"`
			When        struct {
				Not struct { Medium []string `json:"medium"` } `json:"not"`
			} `json:"when"`
		} `json:"control"`
		Impact *port.DamageProfile `json:"impact"`
		Movement *struct {
			DashDistance   float64 `json:"dashDistance"`
			DashDurationMs int     `json:"dashDurationMs"`
		} `json:"movement"`
		Defense *struct {
			Shape        string  `json:"shape"`
			Absorption   float64 `json:"absorption"`
			DurationMs   int     `json:"durationMs"`
			AngleDegrees float64 `json:"angleDegrees"`
		} `json:"defense"`
		Targeting *port.TargetingProfile `json:"targeting"`
	} `json:"actions"`
}

// Catalog stores validated combat profiles indexed by action ID and input intent.
type Catalog struct {
	profiles      map[string]*port.CombatProfile
	byInputIntent map[string]string
}

// LoadCatalog reads action data and rejects invalid or duplicate combat profiles.
func LoadCatalog(path string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil { return nil, err }
	var raw actionFile
	if err := json.Unmarshal(data, &raw); err != nil { return nil, err }
	catalog := &Catalog{profiles: make(map[string]*port.CombatProfile), byInputIntent: make(map[string]string)}
	for _, action := range raw.Actions {
		if action.ID == "" { return nil, fmt.Errorf("action without id") }
		if action.ManaCost < 0 || action.ManaCostPerSecond < 0 { return nil, fmt.Errorf("action %q has invalid mana cost", action.ID) }
		if action.Impact != nil {
			if action.Control.Type != "sustained" && action.CooldownMs <= 0 { return nil, fmt.Errorf("action %q has combat impact without positive cooldownMs", action.ID) }
			shape := action.Impact.Shape
			if shape == "" { shape = "line"; action.Impact.Shape = shape }
			if action.Impact.Origin == "" { action.Impact.Origin = "caster" }
			valid := action.Impact.Damage > 0 && ((shape == "line" && action.Impact.Origin == "caster" && action.Impact.Reach > 0 && action.Impact.Width >= 0 && action.Impact.Width <= 5) ||
				(shape == "swept_arc" && action.Impact.Origin == "caster" && action.Impact.Reach > 0 && action.Impact.Reach <= 10 && action.Impact.SweepDegrees > 0 && action.Impact.SweepDegrees <= 180) ||
				(shape == "radial" && (action.Impact.Origin == "caster" || action.Impact.Origin == "target") && action.Impact.Radius > 0 && action.Impact.Radius <= 10) ||
				(shape == "projectile" && action.Impact.Origin == "caster" && action.Impact.Reach > 0 && action.Impact.Reach <= 1000 && action.Impact.Speed > 0 && action.Impact.Speed <= 100 && action.Impact.Radius > 0 && action.Impact.Radius <= 5 && action.Impact.DelayMs >= 0 && action.Impact.DelayMs <= 10000))
			if !valid { return nil, fmt.Errorf("action %q has invalid impact", action.ID) }
		}
		if action.Movement != nil {
			m := action.Movement
			if action.Control.Type != "one_shot" || action.CooldownMs <= 0 || m.DashDistance <= 0 || m.DashDistance > 8 || m.DashDurationMs < 50 || m.DashDurationMs > 500 || action.ManaCost != 0 || action.ManaCostPerSecond != 0 || action.Impact != nil || action.Defense != nil || action.Targeting != nil {
				return nil, fmt.Errorf("action %q has invalid movement profile", action.ID)
			}
		}
		if action.Defense != nil {
			d := action.Defense
			validShape := (d.Shape == "cone" && d.AngleDegrees > 0 && d.AngleDegrees <= 180) || (d.Shape == "radial" && d.AngleDegrees == 0)
			validCycle := (action.Control.Type == "sustained" && action.ManaCostPerSecond > 0 && action.CooldownMs == 0 && action.ManaCost == 0) ||
				(action.Control.Type != "sustained" && action.CooldownMs > 0 && action.ManaCostPerSecond == 0)
			if !validShape || d.Absorption <= 0 || d.Absorption > 1000 || d.DurationMs <= 0 || d.DurationMs > 10000 || !validCycle || action.Impact != nil || action.Targeting != nil {
				return nil, fmt.Errorf("action %q has invalid defense profile", action.ID)
			}
		}
		if action.Targeting != nil && (action.Targeting.Type != "ground_point" || action.Targeting.Range <= 0 || action.Targeting.Range > 100 || (action.Targeting.Effect != "orb" && action.Targeting.Effect != "thunder" && action.Targeting.Effect != "teleport")) {
			return nil, fmt.Errorf("action %q has invalid targeting profile", action.ID)
		}
		if action.Targeting != nil && action.Targeting.Effect == "teleport" && (action.Impact != nil || action.ManaCost <= 0) {
			return nil, fmt.Errorf("action %q has invalid teleport profile", action.ID)
		}
		if action.Targeting != nil && action.Targeting.Effect != "teleport" && (action.Impact == nil || action.Impact.Shape != "radial" || action.Impact.Origin != "target") {
			return nil, fmt.Errorf("action %q targeting requires a radial impact with target origin", action.ID)
		}
		if action.Impact != nil && action.Impact.Origin == "target" && action.Targeting == nil {
			return nil, fmt.Errorf("action %q target-origin impact requires targeting", action.ID)
		}
		if action.Control.Type == "sustained" {
			validSustained := action.ManaCostPerSecond > 0 && ((action.Defense != nil && action.Defense.Shape == "radial" && action.Impact == nil) ||
				(action.Defense == nil && action.DamageIntervalMs > 0 && action.Impact != nil && action.Impact.Shape != "projectile"))
			if !validSustained { return nil, fmt.Errorf("action %q has invalid sustained profile", action.ID) }
		}
		if _, exists := catalog.profiles[action.ID]; exists { return nil, fmt.Errorf("duplicate action id %q", action.ID) }
		profile := &port.CombatProfile{
			InputIntent: action.Control.InputIntent, ControlType: action.Control.Type,
			Cooldown: time.Duration(action.CooldownMs) * time.Millisecond,
			ManaCost: action.ManaCost, ManaCostPerSecond: action.ManaCostPerSecond,
			DamageInterval: time.Duration(action.DamageIntervalMs) * time.Millisecond,
			BlockedMediums: action.Control.When.Not.Medium, Impact: action.Impact, Targeting: action.Targeting,
		}
		if action.Movement != nil {
			profile.Movement = &port.MovementProfile{DashDistance: action.Movement.DashDistance, DashDuration: time.Duration(action.Movement.DashDurationMs) * time.Millisecond}
		}
		if action.Defense != nil {
			profile.Defense = &port.DefenseProfile{Shape: action.Defense.Shape, Absorption: action.Defense.Absorption, Duration: time.Duration(action.Defense.DurationMs) * time.Millisecond, AngleDegrees: action.Defense.AngleDegrees}
		}
		catalog.profiles[action.ID] = profile
		if action.Control.InputIntent != "" && (action.Impact != nil || action.Targeting != nil || action.Defense != nil || action.Movement != nil) {
			if _, exists := catalog.byInputIntent[action.Control.InputIntent]; exists { return nil, fmt.Errorf("duplicate combat input intent %q", action.Control.InputIntent) }
			catalog.byInputIntent[action.Control.InputIntent] = action.ID
		}
	}
	return catalog, nil
}

// Get returns the server-owned profile for an action, or nil when it is unknown.
func (c *Catalog) Get(actionID string) *port.CombatProfile { return c.profiles[actionID] }

// GetByInputIntent resolves the action associated with a combat input intent.
func (c *Catalog) GetByInputIntent(intent string) (string, *port.CombatProfile) {
	id := c.byInputIntent[intent]
	return id, c.profiles[id]
}
var _ port.CombatCatalog = (*Catalog)(nil)
