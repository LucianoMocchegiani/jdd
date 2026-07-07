// Package entity — Entidades de dominio (sesión, jugador, terreno).
package entity

// Player — entidad jugador en una BlockSession (componentes embebidos M2).
type Player struct {
	ID         string
	EntityID   uint32
	X, Y, Z    float64
	VX, VY, VZ float64
	Yaw, Pitch float64
	Medium     string
	InputSeq   int
	Intents    map[string]bool
	ActionID   string
}

// NewPlayer construye player.
func NewPlayer(playerID string, entityID uint32, x, y, z, yaw, pitch float64) *Player {
	return &Player{
		ID:       playerID,
		EntityID: entityID,
		X:        x,
		Y:        y,
		Z:        z,
		Yaw:      yaw,
		Pitch:    pitch,
		Medium:   "ground",
		Intents:  make(map[string]bool),
	}
}
