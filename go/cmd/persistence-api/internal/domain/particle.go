// Package domain — Modelos de dominio persistence-api.
package domain

// ParticleNear representa particle near.
type ParticleNear struct {
	ID          string
	BloqueID    string
	CeldaX      int
	CeldaY      int
	CeldaZ      int
	TipoFisico  string
	Extraida    bool
}

// ParticleWithDureza representa particle with dureza.
type ParticleWithDureza struct {
	ID               string
	BloqueID         string
	CeldaX           int
	CeldaY           int
	CeldaZ           int
	TipoParticulaID  string
	Integridad       float64
	Dureza           float64
}

// IntegrityTransition representa integrity transition.
type IntegrityTransition struct {
	Condicion string
	Valor     float64
}

// DamageResult representa damage result.
type DamageResult struct {
	ParticleID      string
	NuevaIntegridad float64
	Destroyed       bool
	Position        *CellPos
}

// CellPos representa cell pos.
type CellPos struct {
	X, Y, Z int
}

// WorldDamageProfile representa world damage profile.
type WorldDamageProfile struct {
	Reach  int
	Damage float64
}

// CombatProfile representa combat profile.
type CombatProfile struct {
	ActionID    string
	WorldDamage *WorldDamageProfile
}
