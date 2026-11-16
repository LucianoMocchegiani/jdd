package domain

type ParticleNear struct {
	ID string
	BloqueID string
	CeldaX int
	CeldaY int
	CeldaZ int
	TipoFisico string
	Extraida bool
}
type ParticleWithDureza struct {
	ID string
	BloqueID string
	CeldaX int
	CeldaY int
	CeldaZ int
	TipoParticulaID string
	Integridad float64
	Dureza float64
}
type IntegrityTransition struct { Condicion string; Valor float64 }
type DamageResult struct { ParticleID string; NuevaIntegridad float64; Destroyed bool; Position *CellPos; ConsumedDamage float64 }
type CellPos struct { X, Y, Z int }
type ImpactProfile struct { Reach float64 `json:"reach"`; Width float64 `json:"width"`; Damage float64 `json:"damage"` }
type AreaProfile struct { Radius float64 `json:"radius"`; Damage float64 `json:"damage"` }
type CombatProfile struct { ActionID string; Impact *ImpactProfile; Area *AreaProfile; ProjectileDamage float64 }
