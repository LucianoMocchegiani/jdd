// Package domain — Modelos de dominio persistence-api.
package domain

import "time"

// Bloque representa bloque.
type Bloque struct {
	ID                string
	Nombre            string
	AnchoMetros       float64
	AltoMetros        float64
	ProfundidadMaxima int
	AlturaMaxima      int
	TamanoCelda       float64
	OrigenX           float64
	OrigenY           float64
	OrigenZ           int
	CreadoPor         *string
	CreadoEn          time.Time
}

// BloqueBounds representa bloque bounds.
type BloqueBounds struct {
	OrigenX     float64
	OrigenY     float64
	AnchoMetros float64
	AltoMetros  float64
}

// WorldSize representa world size.
type WorldSize struct {
	AnchoTotal float64
	AltoTotal  float64
	RadioMundo float64
	MinX       float64
	MaxX       float64
	MinY       float64
	MaxY       float64
	CentroX    float64
	CentroY    float64
}
