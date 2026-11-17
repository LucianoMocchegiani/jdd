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
		ID         string                `json:"id"`
		Impact     *domain.ImpactProfile `json:"impact"`
		Area       *domain.AreaProfile   `json:"area"`
		Projectile *struct { Damage float64 `json:"damage"` } `json:"projectile"`
	} `json:"actions"`
}

// Catalog stores validated damage profiles by action ID.
type Catalog struct {
	mu       sync.RWMutex
	profiles map[string]*domain.CombatProfile
}

// LoadCatalog reads action data and rejects profiles with invalid or conflicting damage modes.
func LoadCatalog(path string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil { return nil, err }
	var raw catalogFile
	if err := json.Unmarshal(data, &raw); err != nil { return nil, err }
	c := &Catalog{profiles: make(map[string]*domain.CombatProfile)}
	for _, action := range raw.Actions {
		if action.ID == "" { return nil, fmt.Errorf("action without id") }
		if action.Impact != nil && (action.Impact.Reach <= 0 || action.Impact.Damage <= 0 || action.Impact.Width < 0 || action.Impact.Width > 5) {
			return nil, fmt.Errorf("action %q has invalid impact", action.ID)
		}
		if action.Area != nil && (action.Area.Radius <= 0 || action.Area.Radius > 10 || action.Area.Damage <= 0) {
			return nil, fmt.Errorf("action %q has invalid area", action.ID)
		}
		if action.Area != nil && (action.Impact != nil || action.Projectile != nil) {
			return nil, fmt.Errorf("action %q cannot combine area and line/projectile profiles", action.ID)
		}
		var projectileDamage float64
		if action.Projectile != nil {
			projectileDamage = action.Projectile.Damage
			if projectileDamage <= 0 { return nil, fmt.Errorf("action %q has invalid projectile", action.ID) }
		}
		if _, exists := c.profiles[action.ID]; exists { return nil, fmt.Errorf("duplicate action id %q", action.ID) }
		c.profiles[action.ID] = &domain.CombatProfile{ActionID: action.ID, Impact: action.Impact, Area: action.Area, ProjectileDamage: projectileDamage}
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
