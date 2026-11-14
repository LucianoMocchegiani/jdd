// Package conditions evaluates shared particle-contact condition rules.
package conditions

import (
	"encoding/json"
	"os"
	"time"
)

type ApplyRef struct {
	ConditionID string `json:"conditionId"`
	DurationMS  *int   `json:"durationMs"`
	Stacks      int    `json:"stacks"`
}

type TickEffect struct {
	IntervalMS int     `json:"intervalMs"`
	Damage     float64 `json:"damage"`
}

type Definition struct {
	ID        string `json:"id"`
	Lifecycle struct {
		DurationMS *int `json:"durationMs"`
		Stackable  bool `json:"stackable"`
		MaxStacks  int  `json:"maxStacks"`
	} `json:"lifecycle"`
	Effects struct {
		Movement struct {
			SpeedMultiplier float64 `json:"speedMultiplier"`
		} `json:"movement"`
		BlockIntents   []string   `json:"blockIntents"`
		BlockActionIDs []string   `json:"blockActionIds"`
		Tick           *TickEffect `json:"tick"`
	} `json:"effects"`
}

type Instance struct {
	ConditionID string
	Stacks      int
	ExpiresAt   *time.Time
}

type contactRules struct {
	OnEnter []ApplyRef `json:"onEnter"`
	OnStay  []ApplyRef `json:"onStay"`
}

type particleRule struct {
	Conditions contactRules `json:"conditions"`
}

type Catalog struct {
	definitions map[string]Definition
	particles   map[string]particleRule
}

type conditionFile struct {
	Conditions []Definition `json:"conditions"`
}

func Load(statusPath, elementalPath, particleRegistryPath string) (*Catalog, error) {
	c := &Catalog{definitions: make(map[string]Definition), particles: make(map[string]particleRule)}
	for _, path := range []string{statusPath, elementalPath} {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		var file conditionFile
		if err := json.Unmarshal(data, &file); err != nil {
			return nil, err
		}
		for _, def := range file.Conditions {
			if def.ID == "" {
				return nil, os.ErrInvalid
			}
			if _, exists := c.definitions[def.ID]; exists {
				return nil, os.ErrInvalid
			}
			if def.Effects.Tick != nil && def.Effects.Tick.IntervalMS <= 0 {
				return nil, os.ErrInvalid
			}
			c.definitions[def.ID] = def
		}
	}
	data, err := os.ReadFile(particleRegistryPath)
	if err != nil {
		return nil, err
	}
	var registry struct {
		TypeOverrides map[string]particleRule `json:"typeOverrides"`
	}
	if err := json.Unmarshal(data, &registry); err != nil {
		return nil, err
	}
	c.particles = registry.TypeOverrides
	return c, nil
}

// Update expires conditions, applies contact transitions and accumulates debug tick damage.
func (c *Catalog) Update(active *[]Instance, lastContact *string, lastTickAt *map[string]time.Time, dominant string, now time.Time) float64 {
	kept := (*active)[:0]
	for _, instance := range *active {
		if instance.ExpiresAt == nil || now.Before(*instance.ExpiresAt) {
			kept = append(kept, instance)
		}
	}
	*active = kept
	if *lastTickAt == nil {
		*lastTickAt = make(map[string]time.Time)
	}
	if dominant != *lastContact {
		c.apply(active, c.particles[dominant].Conditions.OnEnter, now)
		*lastContact = dominant
	}
	if rule, ok := c.particles[dominant]; ok {
		c.apply(active, rule.Conditions.OnStay, now)
	}
	var damage float64
	for _, instance := range *active {
		def, ok := c.definitions[instance.ConditionID]
		if !ok || def.Effects.Tick == nil {
			continue
		}
		tick := def.Effects.Tick
		last := (*lastTickAt)[instance.ConditionID]
		if now.Sub(last) < time.Duration(tick.IntervalMS)*time.Millisecond {
			continue
		}
		(*lastTickAt)[instance.ConditionID] = now
		damage += tick.Damage * float64(instance.Stacks)
	}
	return damage
}

func (c *Catalog) apply(active *[]Instance, refs []ApplyRef, now time.Time) {
	for _, ref := range refs {
		def, ok := c.definitions[ref.ConditionID]
		if !ok {
			continue
		}
		duration := ref.DurationMS
		if duration == nil {
			duration = def.Lifecycle.DurationMS
		}
		var expires *time.Time
		if duration != nil {
			t := now.Add(time.Duration(*duration) * time.Millisecond)
			expires = &t
		}
		stacks := ref.Stacks
		if stacks <= 0 {
			stacks = 1
		}
		for i := range *active {
			instance := &(*active)[i]
			if instance.ConditionID != ref.ConditionID {
				continue
			}
			if def.Lifecycle.Stackable {
				max := def.Lifecycle.MaxStacks
				if max <= 0 {
					max = 1
				}
				instance.Stacks += stacks
				if instance.Stacks > max {
					instance.Stacks = max
				}
			}
			if expires != nil {
				instance.ExpiresAt = expires
			}
			goto next
		}
		if !def.Lifecycle.Stackable {
			stacks = 1
		}
		if max := def.Lifecycle.MaxStacks; def.Lifecycle.Stackable && max > 0 && stacks > max {
			stacks = max
		}
		*active = append(*active, Instance{ConditionID: ref.ConditionID, Stacks: stacks, ExpiresAt: expires})
	next:
	}
}

func (c *Catalog) BlocksIntent(active []Instance, intent string) bool {
	for _, instance := range active {
		for _, blocked := range c.definitions[instance.ConditionID].Effects.BlockIntents {
			if blocked == intent {
				return true
			}
		}
	}
	return false
}

func (c *Catalog) BlocksAction(active []Instance, actionID string) bool {
	for _, instance := range active {
		for _, blocked := range c.definitions[instance.ConditionID].Effects.BlockActionIDs {
			if blocked == actionID {
				return true
			}
		}
	}
	return false
}

func (c *Catalog) FilterIntents(active []Instance, intents map[string]bool) map[string]bool {
	filtered := make(map[string]bool, len(intents))
	for intent, enabled := range intents {
		if enabled && !c.BlocksIntent(active, intent) {
			filtered[intent] = true
		}
	}
	return filtered
}

func (c *Catalog) MovementSpeedMultiplier(active []Instance) float64 {
	multiplier := 1.0
	for _, instance := range active {
		if speed := c.definitions[instance.ConditionID].Effects.Movement.SpeedMultiplier; speed > 0 {
			multiplier *= speed
		}
	}
	return multiplier
}

func IDs(active []Instance) []string {
	ids := make([]string, 0, len(active))
	for _, instance := range active {
		ids = append(ids, instance.ConditionID)
	}
	return ids
}
