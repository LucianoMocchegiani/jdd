// Package combat — Catálogo de combate compartido.
package combat

import (
	"encoding/json"
	"os"
	"sync"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

type catalogFile struct {
	Actions map[string]struct {
		Impact struct {
			WorldDamage struct {
				Reach  int     `json:"reach"`
				Damage float64 `json:"damage"`
			} `json:"worldDamage"`
		} `json:"impact"`
	} `json:"actions"`
}

// Catalog representa catalog.
type Catalog struct {
	mu       sync.RWMutex
	profiles map[string]*domain.CombatProfile
}

// LoadCatalog ejecuta load catalog.
func LoadCatalog(path string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var raw catalogFile
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	c := &Catalog{profiles: make(map[string]*domain.CombatProfile)}
	for id, action := range raw.Actions {
		wd := action.Impact.WorldDamage
		if wd.Reach <= 0 && wd.Damage <= 0 {
			c.profiles[id] = &domain.CombatProfile{ActionID: id}
			continue
		}
		reach := wd.Reach
		if reach < 1 {
			reach = 1
		}
		damage := wd.Damage
		if damage <= 0 {
			damage = 15
		}
		c.profiles[id] = &domain.CombatProfile{
			ActionID: id,
			WorldDamage: &domain.WorldDamageProfile{
				Reach:  reach,
				Damage: damage,
			},
		}
	}
	return c, nil
}

// Get implementa get.
func (c *Catalog) Get(actionID string) *domain.CombatProfile {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.profiles[actionID]
}

var _ port.CombatCatalog = (*Catalog)(nil)
