// Package systems — Sistemas de simulación autoritativa.
package systems

import (
	"log"
	"math"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
)

func RunPlayerTick(p *entity.Player, grid *collision.SolidGridCache, cfg *session.Config, mediumRules *jdmedium.Resolver, dt float64) {
	medium := resolveMedium(p, grid, cfg, mediumRules)
	p.Medium = medium
	speed := cfg.PlayerMoveSpeedCells
	if medium == "ground" && p.Intents["run_forward"] && p.Intents["move_forward"] {
		speed *= runSpeedMultiplier
	}
	forward, backward := p.Intents["move_forward"], p.Intents["move_backward"]
	if medium == "ground" {
		p.VX, p.VY = computePlanarVelocityFromIntents(p.Intents, speed, p.Yaw)
		if p.Intents["jump"] {
			p.VZ = jumpImpulseZ
		} else if p.VZ <= 0 {
			p.VZ = 0
		}
	} else {
		vx, vy, vz := computeVelocity3DFromIntents(p.Intents, speed, p.Yaw, p.Pitch, cfg.CameraDefaultPitch)
		p.VX, p.VY = vx, vy
		if forward || backward {
			p.VZ = vz
		}
		p.VZ -= cfg.GravityCells * dt
	}
	tryMoveAxis(p, grid, "x", p.VX*dt)
	tryMoveAxis(p, grid, "y", p.VY*dt)
	tryMoveAxis(p, grid, "z", p.VZ*dt)
	if cellBelowSolid(p, grid) && p.VZ <= 0 {
		p.VZ = 0
		p.Z = math.Floor(p.Z)
	}
	p.Medium = resolveMedium(p, grid, cfg, mediumRules)
}

func resolveMedium(p *entity.Player, grid *collision.SolidGridCache, cfg *session.Config, rules *jdmedium.Resolver) string {
	if rules == nil {
		if cellBelowSolid(p, grid) {
			return "ground"
		}
		return "air"
	}
	radius := float64(cfg.ContactSampleRadiusCells)
	return rules.Resolve(grid.ContactParticlesNear(p.X, p.Y, p.Z, radius), cellBelowSolid(p, grid), p.X, p.Y, p.Z, radius)
}

func cellBelowSolid(p *entity.Player, grid *collision.SolidGridCache) bool {
	x, y, z := int(math.Floor(p.X)), int(math.Floor(p.Y)), int(math.Floor(p.Z))-1
	solid := grid.IsCellSolid(x, y, z)
	if solid && !p.GroundCellDebugLogged {
		log.Printf("ground cell: player=%s position=(%.3f,%.3f,%.3f) cell=(%d,%d,%d) solid=%t", p.ID, p.X, p.Y, p.Z, x, y, z, solid)
		p.GroundCellDebugLogged = true
	}
	return solid
}

func tryMoveAxis(p *entity.Player, grid *collision.SolidGridCache, axis string, delta float64) {
	if math.Abs(delta) < 1e-9 {
		return
	}
	nx, ny, nz := p.X, p.Y, p.Z
	switch axis {
	case "x":
		nx += delta
	case "y":
		ny += delta
	case "z":
		nz += delta
	}
	fx, fy, fz := int(math.Floor(nx)), int(math.Floor(ny)), int(math.Floor(nz))
	if grid.IsBodyBlocked(fx, fy, fz) {
		switch axis {
		case "x":
			p.VX = 0
		case "y":
			p.VY = 0
		case "z":
			p.VZ = 0
		}
		return
	}
	p.X, p.Y, p.Z = nx, ny, nz
}
