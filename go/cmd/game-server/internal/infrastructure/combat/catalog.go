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
		Impact struct {
			WorldDamage  *port.DamageProfile `json:"worldDamage"`
			EntityDamage *port.DamageProfile `json:"entityDamage"`
		} `json:"impact"`
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
		if action.WorldDamage != nil || action.EntityDamage != nil {
			if action.CooldownMs <= 0 {
				return nil, fmt.Errorf("action %q has combat impact without positive cooldownMs", action.ID)
			}
		}
		catalog.profiles[action.ID] = &port.CombatProfile{
			Cooldown: time.Duration(action.CooldownMs) * time.Millisecond,
			BlockedMediums: action.Control.When.Not.Medium,
			WorldDamage: validDamage(action.Impact.WorldDamage),
			EntityDamage: validDamage(action.Impact.EntityDamage),
		}
	}
	return catalog, nil
}

func validDamage(profile *port.DamageProfile) *port.DamageProfile {
	if profile == nil || profile.Reach <= 0 || profile.Damage <= 0 {
		return nil
	}
	return profile
}

func (c *Catalog) Get(actionID string) *port.CombatProfile {
	return c.profiles[actionID]
}

var _ port.CombatCatalog = (*Catalog)(nil)
