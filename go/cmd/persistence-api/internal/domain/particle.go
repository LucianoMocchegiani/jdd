// Package domain — Modelos de dominio persistence-api.
package domain

// ParticleNear is a particle's location and physical state from a nearby-particle query.
type ParticleNear struct {
	ID         string
	BloqueID   string
	CeldaX     int
	CeldaY     int
	CeldaZ     int
	TipoFisico string
	Extraida   bool
}

// ParticleWithDureza contains persisted integrity and hardness for damage calculation.
type ParticleWithDureza struct {
	ID              string
	BloqueID        string
	CeldaX          int
	CeldaY          int
	CeldaZ          int
	TipoParticulaID string
	Integridad      float64
	Dureza          float64
}

// IntegrityTransition describes one transition in a particle's integrity state.
type IntegrityTransition struct {
	Condicion string
	Valor     float64
}

// DamageResult reports the integrity change and whether the particle was destroyed.
type DamageResult struct {
	ParticleID      string
	NuevaIntegridad float64
	Destroyed       bool
	Position        *CellPos
	ConsumedDamage  float64
}

// CellPos is an integer cell coordinate in the world grid.
type CellPos struct { X, Y, Z int }

// ImpactProfile defines the geometry, origin, and damage for one combat pulse.
type ImpactProfile struct {
	Shape         string  `json:"shape,omitempty"`
	Origin        string  `json:"origin,omitempty"`
	BlockBySolids bool    `json:"blockBySolids,omitempty"`
	Reach         float64 `json:"reach,omitempty"`
	Width         float64 `json:"width,omitempty"`
	Radius        float64 `json:"radius,omitempty"`
	SweepDegrees  float64 `json:"sweepDegrees,omitempty"`
	Speed         float64 `json:"speed,omitempty"`
	DelayMs       int     `json:"delayMs,omitempty"`
	Damage        float64 `json:"damage"`
}

// CombatProfile is the persistence-side damage configuration for one action.
type CombatProfile struct {
	ActionID string
	Impact   *ImpactProfile
}
