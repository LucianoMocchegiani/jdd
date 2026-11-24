package systems

import (
	"log"
	"math"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/collision"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/pkg/jd/particlecell"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
)

func RunPlayerTick(p *entity.Player, grid *collision.SolidGridCache, cfg *session.Config, mediumRules *jdmedium.Resolver, dt float64) {
	ResolvePlayerContact(p, grid, cfg, mediumRules)
	RunPlayerTickWithEffects(p, grid, cfg, mediumRules, dt, p.Intents, 1)
}

func RunPlayerTickWithEffects(p *entity.Player, grid *collision.SolidGridCache, cfg *session.Config, mediumRules *jdmedium.Resolver, dt float64, intents map[string]bool, speedMultiplier float64) {
	if p.DashRemaining > 0 {
		runDashTick(p, grid, mediumRules, cfg, dt)
		return
	}
	speed := cfg.PlayerMoveSpeedCells * speedMultiplier
	if p.Medium == "ground" && intents["run_forward"] && intents["move_forward"] {
		speed *= runSpeedMultiplier
	}
	forward, backward := intents["move_forward"], intents["move_backward"]
	if p.Medium == "ground" {
		p.VX, p.VY = computePlanarVelocityFromIntents(intents, speed, p.Yaw)
		if intents["jump"] {
			p.VZ = jumpImpulseZ
		} else if p.VZ <= 0 {
			p.VZ = 0
		}
	} else {
		vx, vy, vz := computeVelocity3DFromIntents(intents, speed, p.Yaw, p.Pitch, cfg.CameraDefaultPitch)
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
	ResolvePlayerContact(p, grid, cfg, mediumRules)
}

// StartPlanarDash applies a short impulse using movement input, or facing when idle.
func StartPlanarDash(p *entity.Player, distance, duration float64) bool {
	if p.Medium != "ground" || distance <= 0 || duration <= 0 || p.DashRemaining > 0 {
		return false
	}
	dx, dy := computePlanarVelocityFromIntents(p.Intents, 1, p.Yaw)
	if math.Hypot(dx, dy) < 1e-6 {
		dx, dy = cameraPlanarForwardUnit(p.Yaw)
	}
	p.DashVX, p.DashVY = dx*distance/duration, dy*distance/duration
	p.DashRemaining = duration
	return true
}

func runDashTick(p *entity.Player, grid *collision.SolidGridCache, mediumRules *jdmedium.Resolver, cfg *session.Config, dt float64) {
	dashDT := math.Min(dt, p.DashRemaining)
	p.VX, p.VY = p.DashVX, p.DashVY
	if !moveDashAxis(p, grid, "x", p.VX*dashDT) { p.DashVX, p.VX = 0, 0 }
	if !moveDashAxis(p, grid, "y", p.VY*dashDT) { p.DashVY, p.VY = 0, 0 }
	p.DashRemaining -= dt
	if p.DashRemaining <= 0 || (p.DashVX == 0 && p.DashVY == 0) {
		p.DashRemaining, p.DashVX, p.DashVY = 0, 0, 0
		p.VX, p.VY = 0, 0
	}
	ResolvePlayerContact(p, grid, cfg, mediumRules)
}

func moveDashAxis(p *entity.Player, grid *collision.SolidGridCache, axis string, delta float64) bool {
	steps := int(math.Ceil(math.Abs(delta) / 0.25))
	if steps == 0 { return true }
	step := delta / float64(steps)
	for i := 0; i < steps; i++ {
		beforeX, beforeY := p.X, p.Y
		tryMoveAxis(p, grid, axis, step)
		if p.X == beforeX && p.Y == beforeY { return false }
	}
	return true
}

func ResolvePlayerContact(p *entity.Player, grid *collision.SolidGridCache, cfg *session.Config, rules *jdmedium.Resolver) {
	if rules == nil {
		p.DominantParticleName = ""
		if cellBelowSolid(p, grid) { p.Medium = "ground" } else { p.Medium = "air" }
		return
	}
	radius := float64(cfg.ContactSampleRadiusCells)
	contact := rules.ResolveContact(grid.ContactParticlesNear(p.X, p.Y, p.Z, radius), cellBelowSolid(p, grid), p.X, p.Y, p.Z, radius)
	p.Medium, p.DominantParticleName = contact.Medium, contact.DominantType
}

func cellBelowSolid(p *entity.Player, grid *collision.SolidGridCache) bool {
	x, y, z := particlecell.ColumnIndex(p.X), particlecell.ColumnIndex(p.Y), int(math.Floor(p.Z))-1
	solid := grid.IsCellSolid(x, y, z)
	if solid && !p.GroundCellDebugLogged {
		log.Printf("ground cell: player=%s position=(%.3f,%.3f,%.3f) cell=(%d,%d,%d) solid=%t", p.ID, p.X, p.Y, p.Z, x, y, z, solid)
		p.GroundCellDebugLogged = true
	}
	return solid
}

func tryMoveAxis(p *entity.Player, grid *collision.SolidGridCache, axis string, delta float64) {
	if math.Abs(delta) < 1e-9 { return }
	nx, ny, nz := p.X, p.Y, p.Z
	switch axis { case "x": nx += delta; case "y": ny += delta; case "z": nz += delta }
	fx, fy, fz := particlecell.ColumnIndex(nx), particlecell.ColumnIndex(ny), int(math.Floor(nz))
	if grid.IsBodyBlocked(fx, fy, fz) {
		switch axis { case "x": p.VX = 0; case "y": p.VY = 0; case "z": p.VZ = 0 }
		return
	}
	p.X, p.Y, p.Z = nx, ny, nz
}
