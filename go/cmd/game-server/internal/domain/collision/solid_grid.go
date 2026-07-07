// Package collision — Grilla de celdas sólidas para colisión.
package collision

import (
	"sync"

	"github.com/juego-de-dioses/jd/pkg/jd/cellkey"
)

// SolidGridCache — O(1) sólidos para colisión (subset de terrain:ready).
type SolidGridCache struct {
	mu     sync.RWMutex
	solid  map[string]struct{}
	loaded bool
}

// NewSolidGrid construye solid grid.
func NewSolidGrid() *SolidGridCache {
	return &SolidGridCache{solid: make(map[string]struct{})}
}

// MergeSolidCells implementa merge solid cells.
func (g *SolidGridCache) MergeSolidCells(cells []string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, c := range cells {
		g.solid[c] = struct{}{}
	}
	g.loaded = true
}

// RemoveCell implementa remove cell.
func (g *SolidGridCache) RemoveCell(x, y, z int) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.solid, cellkey.Format(x, y, z))
}

// IsLoaded implementa is loaded.
func (g *SolidGridCache) IsLoaded() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.loaded
}

// IsCellSolid implementa is cell solid.
func (g *SolidGridCache) IsCellSolid(x, y, z int) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	_, ok := g.solid[cellkey.Format(x, y, z)]
	return ok
}

// IsBodyBlocked implementa is body blocked.
func (g *SolidGridCache) IsBodyBlocked(fx, fy, fz int) bool {
	return g.IsCellSolid(fx, fy, fz) || g.IsCellSolid(fx, fy, fz+1)
}

// Count implementa count.
func (g *SolidGridCache) Count() int {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return len(g.solid)
}
