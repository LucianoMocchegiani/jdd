package usecase

import (
	"math"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

// snapshotSwingTargets freezes the live, in-range player targets for the impact's configured shape.
func snapshotSwingTargets(sess *entity.BlockSession, cmd port.SwingCommand, profile *port.CombatProfile) []port.SwingTarget {
	origin := jdcombat.Point{X: cmd.PosX, Y: cmd.PosY, Z: cmd.PosZ}
	targets := make([]port.SwingTarget, 0)
	sess.ForEachPlayer(func(p *entity.Player) {
		if p.ID == cmd.PlayerID || p.Health <= 0 {
			return
		}
		hit := false
		if profile.Impact.Shape == "radial" {
			dx, dy, dz := p.X-cmd.PosX, p.Y-cmd.PosY, p.Z-cmd.PosZ
			radius := profile.Impact.Radius + 0.45
			hit = dx*dx+dy*dy+dz*dz <= radius*radius && hasRadialLineOfSight(sess, origin, jdcombat.Point{X: p.X, Y: p.Y, Z: p.Z})
		} else {
			hit = jdcombat.HitsPlayerWithWidth(origin, cmd.Yaw, jdcombat.Point{X: p.X, Y: p.Y, Z: p.Z}, profile.Impact.Reach, profile.Impact.Width)
		}
		if hit {
			targets = append(targets, port.SwingTarget{PlayerID: p.ID, EntityID: int(p.EntityID), X: p.X, Y: p.Y, Z: p.Z})
		}
	})
	return targets
}

func hasRadialLineOfSight(sess *entity.BlockSession, origin, target jdcombat.Point) bool {
	grid := sess.SolidGrid
	if grid == nil || !grid.IsLoaded() {
		return false
	}
	origin.Z += 0.9
	target.Z += 0.9
	dx, dy, dz := target.X-origin.X, target.Y-origin.Y, target.Z-origin.Z
	distance := math.Sqrt(dx*dx + dy*dy + dz*dz)
	steps := int(math.Ceil(distance / 0.2))
	start := [3]int{int(math.Floor(origin.X)), int(math.Floor(origin.Y)), int(math.Floor(origin.Z))}
	end := [3]int{int(math.Floor(target.X)), int(math.Floor(target.Y)), int(math.Floor(target.Z))}
	for i := 1; i < steps; i++ {
		t := float64(i) / float64(steps)
		x, y, z := int(math.Floor(origin.X+dx*t)), int(math.Floor(origin.Y+dy*t)), int(math.Floor(origin.Z+dz*t))
		if [3]int{x, y, z} != start && [3]int{x, y, z} != end && grid.IsCellSolid(x, y, z) {
			return false
		}
	}
	return true
}
