// insideArea tests player-body centers against the same radial impact used for particles.
func insideArea(p *entity.Player, target port.AreaTarget, radius float64) bool {
	dx, dy, dz := p.X-target.X, p.Y-target.Y, p.Z+0.9-target.Z
	radius += 0.45
	return dx*dx+dy*dy+dz*dz <= radius*radius
}

func finiteAreaCoordinate(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
