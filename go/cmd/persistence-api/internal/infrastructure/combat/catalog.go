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

// Catalog stores validated damage profiles by action ID.
type Catalog struct {
	mu       sync.RWMutex
	profiles map[string]*domain.CombatProfile
}

// LoadCatalog reads action data and rejects invalid or conflicting damage profiles.
func LoadCatalog(path string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil { return nil, err }
	var raw catalogFile
	if err := json.Unmarshal(data, &raw); err != nil { return nil, err }
	c := &Catalog{profiles: make(map[string]*domain.CombatProfile)}
	for _, action := range raw.Actions {
		if action.ID == "" { return nil, fmt.Errorf("action without id") }
		if action.Impact != nil {
			shape := action.Impact.Shape
			if shape == "" { shape = "line"; action.Impact.Shape = shape }
			if action.Impact.Origin == "" { action.Impact.Origin = "caster" }
			valid := action.Impact.Damage > 0 && ((shape == "line" && action.Impact.Origin == "caster" && action.Impact.Reach > 0 && action.Impact.Width >= 0 && action.Impact.Width <= 5) ||
				(shape == "swept_arc" && action.Impact.Origin == "caster" && action.Impact.Reach > 0 && action.Impact.Reach <= 10 && action.Impact.SweepDegrees > 0 && action.Impact.SweepDegrees <= 180) ||
				(shape == "radial" && (action.Impact.Origin == "caster" || action.Impact.Origin == "target") && action.Impact.Radius > 0 && action.Impact.Radius <= 10) ||
				(shape == "projectile" && action.Impact.Origin == "caster" && action.Impact.Reach > 0 && action.Impact.Reach <= 1000 && action.Impact.Speed > 0 && action.Impact.Speed <= 100 && action.Impact.Radius > 0 && action.Impact.Radius <= 5 && action.Impact.DelayMs >= 0 && action.Impact.DelayMs <= 10000))
			if !valid { return nil, fmt.Errorf("action %q has invalid impact", action.ID) }
		}
		if _, exists := c.profiles[action.ID]; exists { return nil, fmt.Errorf("duplicate action id %q", action.ID) }
		c.profiles[action.ID] = &domain.CombatProfile{ActionID: action.ID, Impact: action.Impact}
	}
	return c, nil
}

// Get returns the persistence-side damage profile for an action, or nil if absent.
func (c *Catalog) Get(actionID string) *domain.CombatProfile {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.profiles[actionID]
}

var _ port.CombatCatalog = (*Catalog)(nil)
