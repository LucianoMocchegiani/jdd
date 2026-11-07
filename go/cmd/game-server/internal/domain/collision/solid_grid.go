// Package collision — Grilla de celdas sólidas para colisión.
package collision

import (
	"math"
	"sync"

	"github.com/juego-de-dioses/jd/pkg/jd/cellkey"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
)

// SolidGridCache — O(1) sólidos para colisión (subset de terrain:ready).
type SolidGridCache struct {
	mu        sync.RWMutex
	solid     map[string]struct{}
	particles map[string]jdmedium.Particle
	loaded    bool
}

func NewSolidGrid() *SolidGridCache {
	return &SolidGridCache{solid: make(map[string]struct{}), particles: make(map[string]jdmedium.Particle)}
}

func (g *SolidGridCache) MergeSolidCells(cells []string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, c := range cells {
		g.solid[c] = struct{}{}
	}
	g.loaded = true
}

func (g *SolidGridCache) MergeContactParticles(particles []jdmedium.Particle) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, p := range particles {
		g.particles[cellkey.Format(int(math.Floor(p.X)), int(math.Floor(p.Y)), int(math.Floor(p.Z)))] = p
	}
}

func (g *SolidGridCache) ContactParticlesNear(x, y, z, radius float64) []jdmedium.Particle {
	g.mu.RLock()
	defer g.mu.RUnlock()
	var particles []jdmedium.Particle
	for ix := int(math.Floor(x - radius)); ix <= int(math.Floor(x+radius)); ix++ {
		for iy := int(math.Floor(y - radius)); iy <= int(math.Floor(y+radius)); iy++ {
			for iz := int(math.Floor(z - radius)); iz <= int(math.Floor(z+radius)); iz++ {
				if p, ok := g.particles[cellkey.Format(ix, iy, iz)]; ok {
					particles = append(particles, p)
				}
			}
		}
	}
	return particles
}

func (g *SolidGridCache) RemoveCell(x, y, z int) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := cellkey.Format(x, y, z)
	delete(g.solid, key)
	delete(g.particles, key)
}

func (g *SolidGridCache) IsLoaded() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.loaded
}

func (g *SolidGridCache) IsCellSolid(x, y, z int) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	_, ok := g.solid[cellkey.Format(x, y, z)]
	return ok
}

func (g *SolidGridCache) IsBodyBlocked(fx, fy, fz int) bool {
	return g.IsCellSolid(fx, fy, fz) || g.IsCellSolid(fx, fy, fz+1)
}

func (g *SolidGridCache) Count() int {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return len(g.solid)
}
