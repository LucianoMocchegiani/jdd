// Package port — Puertos de repositorios y workers.
package port

import (
	"context"
	"errors"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
)

var ErrBloqueNotFound = errors.New("bloque no encontrado")

// BloqueRepository representa bloque repository.
type BloqueRepository interface {
	ListAll(ctx context.Context) ([]domain.Bloque, error)
	GetByID(ctx context.Context, bloqueID string) (*domain.Bloque, error)
	WorldBounds(ctx context.Context) ([]domain.BloqueBounds, error)
}
