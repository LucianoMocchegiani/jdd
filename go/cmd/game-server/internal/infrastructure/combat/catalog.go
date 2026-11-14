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
		ID         string  `json:"id"`
		CooldownMs int     `json:"cooldownMs"`
		ManaCost   float64 `json:"manaCost"`
		Control    struct {
			InputIntent string `json:"inputIntent"`
			When        struct {
				Not struct {
					Medium []string `json:"medium"`
				} `json:"not"`
			} `json:"when"`
		} `json:"control"`
		Impact     *port.DamageProfile `json:"impact"`
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
	profiles      map[string]*port.CombatProfile
	byInputIntent map[string]string
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
	catalog := &Catalog{profiles: make(map[string]*port.CombatProfile), byInputIntent: make(map[string]string)}
	for _, action := range raw.Actions {
		if action.ID == "" {
			return nil, fmt.Errorf("action without id")
		}
		if action.ManaCost < 0 {
			return nil, fmt.Errorf("action %q has invalid manaCost", action.ID)
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
			InputIntent:    action.Control.InputIntent,
			Cooldown:       time.Duration(action.CooldownMs) * time.Millisecond,
			ManaCost:       action.ManaCost,
			BlockedMediums: action.Control.When.Not.Medium,
			Impact:         action.Impact,
			Projectile:     projectile,
		}
		if action.Control.InputIntent != "" && (action.Impact != nil || projectile != nil) {
			if _, exists := catalog.byInputIntent[action.Control.InputIntent]; exists {
				return nil, fmt.Errorf("duplicate combat input intent %q", action.Control.InputIntent)
			}
			catalog.byInputIntent[action.Control.InputIntent] = action.ID
		}
	}
	return catalog, nil
}

func (c *Catalog) Get(actionID string) *port.CombatProfile {
	return c.profiles[actionID]
}

func (c *Catalog) GetByInputIntent(intent string) (string, *port.CombatProfile) {
	id := c.byInputIntent[intent]
	return id, c.profiles[id]
}

var _ port.CombatCatalog = (*Catalog)(nil)
