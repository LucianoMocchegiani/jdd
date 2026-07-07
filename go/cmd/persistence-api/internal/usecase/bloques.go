// Package usecase — Casos de uso REST y combate.
package usecase

import (
	"context"
	"math"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

// BloqueService representa bloque service.
type BloqueService struct {
	repo port.BloqueRepository
}

// NewBloqueService construye bloque service.
func NewBloqueService(repo port.BloqueRepository) *BloqueService {
	return &BloqueService{repo: repo}
}

// ListBloques implementa list bloques.
func (s *BloqueService) ListBloques(ctx context.Context) ([]domain.Bloque, error) {
	return s.repo.ListAll(ctx)
}

// GetBloque implementa get bloque.
func (s *BloqueService) GetBloque(ctx context.Context, bloqueID string) (*domain.Bloque, error) {
	return s.repo.GetByID(ctx, bloqueID)
}

// GetWorldSize implementa get world size.
func (s *BloqueService) GetWorldSize(ctx context.Context) (domain.WorldSize, error) {
	rows, err := s.repo.WorldBounds(ctx)
	if err != nil {
		return domain.WorldSize{}, err
	}
	return computeWorldSize(rows), nil
}

func computeWorldSize(rows []domain.BloqueBounds) domain.WorldSize {
	if len(rows) == 0 {
		return domain.WorldSize{
			AnchoTotal: 1000,
			AltoTotal:  1000,
			RadioMundo: math.Sqrt(500*500 + 500*500),
			MinX:       0,
			MaxX:       1000,
			MinY:       0,
			MaxY:       1000,
			CentroX:    500,
			CentroY:    500,
		}
	}

	minX := math.MaxFloat64
	maxX := -math.MaxFloat64
	minY := math.MaxFloat64
	maxY := -math.MaxFloat64

	for _, row := range rows {
		bloqueMinX := row.OrigenX
		bloqueMaxX := row.OrigenX + row.AnchoMetros
		bloqueMinY := row.OrigenY
		bloqueMaxY := row.OrigenY + row.AltoMetros
		if bloqueMinX < minX {
			minX = bloqueMinX
		}
		if bloqueMaxX > maxX {
			maxX = bloqueMaxX
		}
		if bloqueMinY < minY {
			minY = bloqueMinY
		}
		if bloqueMaxY > maxY {
			maxY = bloqueMaxY
		}
	}

	anchoTotal := maxX - minX
	altoTotal := maxY - minY
	centroX := (minX + maxX) / 2
	centroY := (minY + maxY) / 2
	halfW := anchoTotal / 2
	halfH := altoTotal / 2

	return domain.WorldSize{
		AnchoTotal: anchoTotal,
		AltoTotal:  altoTotal,
		RadioMundo: math.Sqrt(halfW*halfW + halfH*halfH),
		MinX:       minX,
		MaxX:       maxX,
		MinY:       minY,
		MaxY:       maxY,
		CentroX:    centroX,
		CentroY:    centroY,
	}
}
