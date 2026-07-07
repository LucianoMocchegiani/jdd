// Package systems — Sistemas de simulación autoritativa.
package systems

import (
	"math"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
)

// RunPlayerTick — sim autoritativa (espejo game_loop.run_player_tick + MovementSystem).
func RunPlayerTick(p *entity.Player, grid *collision.SolidGridCache, cfg *session.Config, dt float64) {
	onGround := cellBelowSolid(p, grid)
	medium := "air"
	if onGround {
		medium = "ground"
	}
	p.Medium = medium

	speed := cfg.PlayerMoveSpeedCells
	if medium == "ground" && p.Intents["run_forward"] && p.Intents["move_forward"] {
		speed *= runSpeedMultiplier
	}

	forward := p.Intents["move_forward"]
	backward := p.Intents["move_backward"]

	if medium == "ground" {
		p.VX, p.VY = computePlanarVelocityFromIntents(p.Intents, speed, p.Yaw)
		if p.Intents["jump"] {
			p.VZ = jumpImpulseZ
		} else if p.VZ <= 0 {
			p.VZ = 0
		}
	} else {
		vx, vy, vz := computeVelocity3DFromIntents(p.Intents, speed, p.Yaw, p.Pitch, cfg.CameraDefaultPitch)
		p.VX = vx
		p.VY = vy
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
		p.Medium = "ground"
		floorZ := math.Floor(p.Z)
		if p.Z < floorZ+0.01 {
			p.Z = floorZ
		}
	}
}

func cellBelowSolid(p *entity.Player, grid *collision.SolidGridCache) bool {
	bx := int(math.Floor(p.X))
	by := int(math.Floor(p.Y))
	bz := int(math.Floor(p.Z)) - 1
	return grid.IsCellSolid(bx, by, bz)
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
	fx := int(math.Floor(nx))
	fy := int(math.Floor(ny))
	fz := int(math.Floor(nz))
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
