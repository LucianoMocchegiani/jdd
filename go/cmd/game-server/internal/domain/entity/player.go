// Package entity — Entidades de dominio (sesión, jugador, terreno).
package entity

import (
	"math"
	"time"

	jdconditions "github.com/juego-de-dioses/jd/pkg/jd/conditions"
)

const baseManaReserve = 100

type Player struct {
	ID                    string
	EntityID              uint32
	X, Y, Z               float64
	VX, VY, VZ            float64
	Yaw, Pitch            float64
	Medium                string
	DominantParticleName  string
	InputSeq              int
	Intents               map[string]bool
	ActionID              string
	ActionSeq             int
	Health                float64
	MaxHealth             float64
	Mana                  float64
	MaxMana               float64
	InCombatUntil         time.Time
	Conditions            []jdconditions.Instance
	ConditionLastTickAt   map[string]time.Time
	ConditionDamageTotal  float64
	GroundCellDebugLogged bool
	lastSwingSeq          int
	lastSwingAt           time.Time
}

func NewPlayer(playerID string, entityID uint32, x, y, z, yaw, pitch float64) *Player {
	return &Player{
		ID: playerID, EntityID: entityID, X: x, Y: y, Z: z, Yaw: yaw, Pitch: pitch,
		Medium: "ground", Intents: make(map[string]bool), Health: 100, MaxHealth: 100,
		Mana: baseManaReserve, MaxMana: baseManaReserve, ConditionLastTickAt: make(map[string]time.Time),
	}
}

func (p *Player) InCombat(now time.Time) bool { return now.Before(p.InCombatUntil) }

func (p *Player) RegenerateMana(deltaSec float64, now time.Time) {
	if deltaSec <= 0 || p.Mana >= p.MaxMana {
		return
	}
	rate := 3.0
	if p.InCombat(now) {
		rate = 1.5
	}
	p.Mana = math.Min(p.MaxMana, p.Mana+rate*deltaSec)
}
