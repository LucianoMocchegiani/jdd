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
			WorldDamage struct {
				Reach  float64 `json:"reach"`
				Damage float64 `json:"damage"`
			} `json:"worldDamage"`
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
		world, entities := action.Impact.WorldDamage, action.Impact.EntityDamage
		profile := &port.CombatProfile{WorldDamage: world.Reach > 0 || world.Damage > 0}
		if entities.Reach > 0 && entities.Damage > 0 {
			profile.EntityDamage = &port.EntityDamageProfile{Reach: entities.Reach, Damage: entities.Damage}
		}
		catalog.profiles[id] = profile
	}
	return catalog, nil
}

func (c *Catalog) Get(actionID string) *port.CombatProfile {
	return c.profiles[actionID]
}

var _ port.CombatCatalog = (*Catalog)(nil)
