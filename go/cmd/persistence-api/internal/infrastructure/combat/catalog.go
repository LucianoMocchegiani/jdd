// Package combat loads combat profiles from the shared action registry.
package combat

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

type catalogFile struct {
	Actions []struct {
		ID     string                `json:"id"`
		Impact *domain.ImpactProfile `json:"impact"`
	} `json:"actions"`
}

type Catalog struct {
	mu       sync.RWMutex
	profiles map[string]*domain.CombatProfile
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
	c := &Catalog{profiles: make(map[string]*domain.CombatProfile)}
	for _, action := range raw.Actions {
		if action.ID == "" {
			return nil, fmt.Errorf("action without id")
		}
		if action.Impact != nil && (action.Impact.Reach <= 0 || action.Impact.Damage <= 0) {
			return nil, fmt.Errorf("action %q has invalid impact", action.ID)
		}
		if _, exists := c.profiles[action.ID]; exists {
			return nil, fmt.Errorf("duplicate action id %q", action.ID)
		}
		c.profiles[action.ID] = &domain.CombatProfile{ActionID: action.ID, Impact: action.Impact}
	}
	return c, nil
}

func (c *Catalog) Get(actionID string) *domain.CombatProfile {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.profiles[actionID]
}

var _ port.CombatCatalog = (*Catalog)(nil)
