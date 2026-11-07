// Package combat loads combat profiles from the shared action registry.
package combat

import (
	"encoding/json"
	"os"
	"sync"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

type catalogFile struct {
	Actions []struct {
		ID string `json:"id"`
		Impact struct {
			WorldDamage *struct { Reach int `json:"reach"`; Damage float64 `json:"damage"` } `json:"worldDamage"`
			EntityDamage *struct { Reach float64 `json:"reach"`; Damage float64 `json:"damage"` } `json:"entityDamage"`
		} `json:"impact"`
	} `json:"actions"`
}

type Catalog struct {
	mu sync.RWMutex
	profiles map[string]*domain.CombatProfile
}

func LoadCatalog(path string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil { return nil, err }
	var raw catalogFile
	if err := json.Unmarshal(data, &raw); err != nil { return nil, err }
	c := &Catalog{profiles: make(map[string]*domain.CombatProfile)}
	for _, action := range raw.Actions {
		profile := &domain.CombatProfile{ActionID: action.ID}
		if world := action.Impact.WorldDamage; world != nil && world.Reach > 0 && world.Damage > 0 {
			profile.WorldDamage = &domain.WorldDamageProfile{Reach: world.Reach, Damage: world.Damage}
		}
		if entity := action.Impact.EntityDamage; entity != nil && entity.Reach > 0 && entity.Damage > 0 {
			profile.EntityDamage = &domain.EntityDamageProfile{Reach: entity.Reach, Damage: entity.Damage}
		}
		c.profiles[action.ID] = profile
	}
	return c, nil
}

func (c *Catalog) Get(actionID string) *domain.CombatProfile { c.mu.RLock(); defer c.mu.RUnlock(); return c.profiles[actionID] }
var _ port.CombatCatalog = (*Catalog)(nil)
