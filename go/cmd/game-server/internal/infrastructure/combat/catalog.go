// Package combat loads action impact profiles from shared game data.
package combat

import (
	"encoding/json"
	"os"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

type catalogFile struct {
	Actions map[string]struct {
		Impact struct {
			EntityDamage struct {
				Reach  float64 `json:"reach"`
				Damage float64 `json:"damage"`
			} `json:"entityDamage"`
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
	var raw catalogFile
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	catalog := &Catalog{profiles: make(map[string]*port.CombatProfile)}
	for id, action := range raw.Actions {
		impact := action.Impact.EntityDamage
		if impact.Reach > 0 && impact.Damage > 0 {
			catalog.profiles[id] = &port.CombatProfile{Reach: impact.Reach, Damage: impact.Damage}
		}
	}
	return catalog, nil
}

func (c *Catalog) Get(actionID string) *port.CombatProfile {
	return c.profiles[actionID]
}

var _ port.CombatCatalog = (*Catalog)(nil)
