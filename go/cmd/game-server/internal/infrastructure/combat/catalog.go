package combat

import "math"

// Point uses world coordinates where Z is vertical.
type Point struct {
	X, Y, Z float64
}

const (
	playerHitboxRadius = 0.45
	playerHitboxHeight = 1.8
	defaultImpactWidth = 0.65
)

// shortcut: horizontal sector checked once on input, not a time-sampled 3D blade path; improve when animation exposes hit windows.
func HitsPlayerWithSweptArc(origin Point, yaw float64, target Point, reach, sweepDegrees float64) bool {
	if reach <= 0 || sweepDegrees <= 0 || sweepDegrees > 180 {
		return false
	}
	dx, dy := target.X-origin.X, target.Y-origin.Y
	forward, lateral := signedPlanarHit(origin, yaw, target.X, target.Y)
	distance := math.Hypot(dx, dy)
	if forward < -playerHitboxRadius || distance > reach+playerHitboxRadius {
		return false
	}
	if distance > playerHitboxRadius {
		allowance := math.Asin(math.Min(1, playerHitboxRadius/distance))
		if math.Abs(math.Atan2(lateral, forward)) > sweepDegrees*math.Pi/360+allowance {
			return false
		}
	}
	strikeZ := origin.Z + 1
	return strikeZ >= target.Z-0.3 && strikeZ <= target.Z+playerHitboxHeight+0.3
}

// shortcut: fixed unobstructed sector/capsule; replace with swept per-part collision and occlusion when available.
func HitsPlayer(origin Point, yaw float64, target Point, reach float64) bool {
	return HitsPlayerWithWidth(origin, yaw, target, reach, defaultImpactWidth)
}

// HitsPlayerWithWidth tests a target against the line attack using the configured lateral width.
// A zero width keeps the historical default; a negative width is rejected.
func HitsPlayerWithWidth(origin Point, yaw float64, target Point, reach, width float64) bool {
	if width < 0 {
		return false
	}
	if width == 0 {
		width = defaultImpactWidth
	}
	forward, lateral := planarHit(origin, yaw, target.X, target.Y)
	if forward <= 0 || forward > reach+playerHitboxRadius || lateral > width+playerHitboxRadius {
		return false
	}
	strikeZ := origin.Z + 1
	return strikeZ >= target.Z-0.3 && strikeZ <= target.Z+playerHitboxHeight+0.3
}

// HitsWorldCellWithSweptArc tests a solid cell against the same horizontal sword-sweep sector.
func HitsWorldCellWithSweptArc(origin Point, yaw float64, x, y, z int, reach, sweepDegrees float64) bool {
	if reach <= 0 || sweepDegrees <= 0 || sweepDegrees > 180 {
		return false
	}
	dx, dy := float64(x)-origin.X, float64(y)-origin.Y
	forward, lateral := signedPlanarHit(origin, yaw, float64(x), float64(y))
	distance := math.Hypot(dx, dy)
	if forward < -0.5 || distance > reach+0.5 || math.Abs(float64(z)-(origin.Z+1)) > 1 {
		return false
	}
	if distance > 0.5 && math.Abs(math.Atan2(lateral, forward)) > sweepDegrees*math.Pi/360+math.Asin(math.Min(1, 0.5/distance)) {
		return false
	}
	return true
}

// HitsWorldCell approximates contact with one particle cell in front of the player.
func HitsWorldCell(origin Point, yaw float64, x, y, z int, reach float64) bool {
	return HitsWorldCellWithWidth(origin, yaw, x, y, z, reach, defaultImpactWidth)
}

// HitsWorldCellWithWidth tests a world cell against the line attack's configured lateral width.
// A zero width keeps the historical default; a negative width is rejected.
func HitsWorldCellWithWidth(origin Point, yaw float64, x, y, z int, reach, width float64) bool {
	if width < 0 {
		return false
	}
	if width == 0 {
		width = defaultImpactWidth
	}
	cell := Point{float64(x), float64(y), float64(z)}
	forward, lateral := planarHit(origin, yaw, cell.X, cell.Y)
	return forward > 0 && forward <= reach+0.5 && lateral <= width && math.Abs(cell.Z-(origin.Z+1)) <= 1
}

// ForwardDistance projects a point onto the attack direction for impact ordering.
func ForwardDistance(origin Point, yaw, x, y float64) float64 {
	forward, _ := planarHit(origin, yaw, x, y)
	return forward
}

func planarHit(origin Point, yaw, x, y float64) (forward, lateral float64) {
	forward, lateral = signedPlanarHit(origin, yaw, x, y)
	return forward, math.Abs(lateral)
}

func signedPlanarHit(origin Point, yaw, x, y float64) (forward, lateral float64) {
	dx, dy := x-origin.X, y-origin.Y
	fx, fy := -math.Sin(yaw), -math.Cos(yaw)
	rightX, rightY := math.Cos(yaw), -math.Sin(yaw)
	return dx*fx + dy*fy, dx*rightX + dy*rightY
}
