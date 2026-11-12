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
		ID         string `json:"id"`
		CooldownMs int    `json:"cooldownMs"`
		Control    struct {
			When struct {
				Not struct {
					Medium []string `json:"medium"`
				} `json:"not"`
			} `json:"when"`
		} `json:"control"`
		Impact    *port.DamageProfile `json:"impact"`
		Projectile *struct {
			Speed   float64 `json:"speed"`
			Range   float64 `json:"range"`
			Damage  float64 `json:"damage"`
			Radius  float64 `json:"radius"`
			DelayMs int     `json:"delayMs"`
		} `json:"projectile"`
	} `json:"actions"`
}

type Catalog struct {
	profiles map[string]*port.CombatProfile
}

func LoadCatalog(path string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var raw actionFile
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	catalog := &Catalog{profiles: make(map[string]*port.CombatProfile)}
	for _, action := range raw.Actions {
		if action.ID == "" {
			return nil, fmt.Errorf("action without id")
		}
		if action.Impact != nil {
			if action.CooldownMs <= 0 {
				return nil, fmt.Errorf("action %q has combat impact without positive cooldownMs", action.ID)
			}
			if action.Impact.Reach <= 0 || action.Impact.Damage <= 0 {
				return nil, fmt.Errorf("action %q has invalid impact", action.ID)
			}
		}
		var projectile *port.ProjectileProfile
		if action.Projectile != nil {
			p := action.Projectile
			if action.CooldownMs <= 0 || p.Speed <= 0 || p.Range <= 0 || p.Damage <= 0 || p.Radius <= 0 || p.DelayMs < 0 || p.Speed > 100 || p.Range > 1000 || p.Radius > 5 || p.DelayMs > 10000 {
				return nil, fmt.Errorf("action %q has invalid projectile profile", action.ID)
			}
			projectile = &port.ProjectileProfile{Speed: p.Speed, Range: p.Range, Damage: p.Damage, Radius: p.Radius, Delay: time.Duration(p.DelayMs) * time.Millisecond}
		}
		if _, exists := catalog.profiles[action.ID]; exists {
			return nil, fmt.Errorf("duplicate action id %q", action.ID)
		}
		catalog.profiles[action.ID] = &port.CombatProfile{
			Cooldown:       time.Duration(action.CooldownMs) * time.Millisecond,
			BlockedMediums: action.Control.When.Not.Medium,
			Impact:         action.Impact,
			Projectile:     projectile,
		}
	}
	return catalog, nil
}

func (c *Catalog) Get(actionID string) *port.CombatProfile {
	return c.profiles[actionID]
}

var _ port.CombatCatalog = (*Catalog)(nil)
