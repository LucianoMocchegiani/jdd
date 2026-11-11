package combat

import "math"

// Point uses world coordinates where Z is vertical.
type Point struct {
	X, Y, Z float64
}

const (
	playerHitboxRadius = 0.45
	playerHitboxHeight = 1.8
)

// shortcut: fixed unobstructed sector/capsule; replace with swept per-part collision and occlusion when available.
func HitsPlayer(origin Point, yaw float64, target Point, reach float64) bool {
	forward, lateral := planarHit(origin, yaw, target.X, target.Y)
	if forward <= 0 || forward > reach+playerHitboxRadius || lateral > 0.65+playerHitboxRadius {
		return false
	}
	strikeZ := origin.Z + 1
	return strikeZ >= target.Z-0.3 && strikeZ <= target.Z+playerHitboxHeight+0.3
}

// HitsWorldCell approximates contact with one particle cell in front of the player.
func HitsWorldCell(origin Point, yaw float64, x, y, z int, reach float64) bool {
	cell := Point{float64(x), float64(y), float64(z)}
	forward, lateral := planarHit(origin, yaw, cell.X, cell.Y)
	return forward > 0 && forward <= reach+0.5 && lateral <= 0.65 && math.Abs(cell.Z-(origin.Z+1)) <= 1
}

func planarHit(origin Point, yaw, x, y float64) (forward, lateral float64) {
	dx, dy := x-origin.X, y-origin.Y
	fx, fy := -math.Sin(yaw), -math.Cos(yaw)
	return dx*fx + dy*fy, math.Abs(dx*fy - dy*fx)
}
