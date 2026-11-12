// Package domain — Modelos de dominio persistence-api.
package domain

type ParticleNear struct { ID string; BloqueID string; CeldaX, CeldaY, CeldaZ int; TipoFisico string; Extraida bool }
type ParticleWithDureza struct { ID string; BloqueID string; CeldaX, CeldaY, CeldaZ int; TipoParticulaID string; Integridad, Dureza float64 }
type IntegrityTransition struct { Condicion string; Valor float64 }
type DamageResult struct { ParticleID string; NuevaIntegridad float64; Destroyed bool; Position *CellPos; ConsumedDamage float64 }
type CellPos struct { X, Y, Z int }
type ImpactProfile struct { Reach float64 `json:"reach"`; Damage float64 `json:"damage"` }
type CombatProfile struct { ActionID string; Impact *ImpactProfile; ProjectileDamage float64 }
