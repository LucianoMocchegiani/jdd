// Package systems — Traslación relativa a cámara (espejo movement-relative.ts / movement_relative.py).
package systems

import "math"

const jumpImpulseZ = 7.0
const runSpeedMultiplier = 1.6

// UsesCameraRelative3D indica si W/S usan pitch además de yaw.
func UsesCameraRelative3D(medium string) bool {
	return medium == "air" || medium == "submerged_partial" || medium == "submerged_full"
}

func cameraPlanarForwardUnit(yaw float64) (x, y float64) {
	return -math.Sin(yaw), -math.Cos(yaw)
}

func cameraPlanarRightUnit(yaw float64) (x, y float64) {
	fx, fy := cameraPlanarForwardUnit(yaw)
	return -fy, fx
}

func cameraForwardUnit(yaw, pitch, defaultPitch float64) (x, y, z float64) {
	fx, fy := cameraPlanarForwardUnit(yaw)
	relativePitch := pitch - defaultPitch
	cp := math.Cos(relativePitch)
	sp := math.Sin(relativePitch)
	return fx * cp, fy * cp, -sp
}

func computePlanarVelocityFromIntents(intents map[string]bool, speed, yaw float64) (vx, vy float64) {
	fx, fy := 0.0, 0.0
	ffx, ffy := cameraPlanarForwardUnit(yaw)
	rfx, rfy := cameraPlanarRightUnit(yaw)

	if intents["move_forward"] {
		fx += ffx
		fy += ffy
	}
	if intents["move_backward"] {
		fx -= ffx
		fy -= ffy
	}
	if intents["move_left"] {
		fx -= rfx
		fy -= rfy
	}
	if intents["move_right"] {
		fx += rfx
		fy += rfy
	}

	length := math.Hypot(fx, fy)
	if length < 1e-6 || speed <= 0 {
		return 0, 0
	}
	scale := speed / length
	return fx * scale, fy * scale
}

func computeVelocity3DFromIntents(intents map[string]bool, speed, yaw, pitch, defaultPitch float64) (vx, vy, vz float64) {
	forward := intents["move_forward"]
	backward := intents["move_backward"]

	if forward || backward {
		fx, fy, fz := cameraForwardUnit(yaw, pitch, defaultPitch)
		if forward {
			vx += fx * speed
			vy += fy * speed
			vz += fz * speed
		}
		if backward {
			vx -= fx * speed
			vy -= fy * speed
			vz -= fz * speed
		}
	}

	svx, svy := computePlanarVelocityFromIntents(map[string]bool{
		"move_left":  intents["move_left"],
		"move_right": intents["move_right"],
	}, speed, yaw)
	vx += svx
	vy += svy
	return vx, vy, vz
}
