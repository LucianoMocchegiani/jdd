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

// shortcut: fixed unobstructed sector/capsule; replace with swept per-part collision and occlusion when available.
func HitsPlayer(origin Point, yaw float64, target Point, reach float64) bool {
	return HitsPlayerWithWidth(origin, yaw, target, reach, defaultImpactWidth)
}

func HitsPlayerWithWidth(origin Point, yaw float64, target Point, reach, width float64) bool {
	if width < 0 { return false }
	if width == 0 { width = defaultImpactWidth }
	forward, lateral := planarHit(origin, yaw, target.X, target.Y)
	if forward <= 0 || forward > reach+playerHitboxRadius || lateral > width+playerHitboxRadius {
		return false
	}
	strikeZ := origin.Z + 1
	return strikeZ >= target.Z-0.3 && strikeZ <= target.Z+playerHitboxHeight+0.3
}

// HitsWorldCell approximates contact with one particle cell in front of the player.
func HitsWorldCell(origin Point, yaw float64, x, y, z int, reach float64) bool {
	return HitsWorldCellWithWidth(origin, yaw, x, y, z, reach, defaultImpactWidth)
}

func HitsWorldCellWithWidth(origin Point, yaw float64, x, y, z int, reach, width float64) bool {
	if width < 0 { return false }
	if width == 0 { width = defaultImpactWidth }
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
	dx, dy := x-origin.X, y-origin.Y
	fx, fy := -math.Sin(yaw), -math.Cos(yaw)
	return dx*fx + dy*fy, math.Abs(dx*fy - dy*fx)
}
