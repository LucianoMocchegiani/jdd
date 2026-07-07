// Package postgres — Repositorios Postgres.
package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
)

// BloqueRepository representa bloque repository.
type BloqueRepository struct {
	pool *pgxpool.Pool
}

// NewBloqueRepository construye bloque repository.
func NewBloqueRepository(pool *pgxpool.Pool) *BloqueRepository {
	return &BloqueRepository{pool: pool}
}

const bloqueSelectCols = `
	id, nombre, ancho_metros, alto_metros, profundidad_maxima, altura_maxima,
	tamano_celda, origen_x, origen_y, origen_z, creado_por, creado_en
`

// ListAll implementa list all.
func (r *BloqueRepository) ListAll(ctx context.Context) ([]domain.Bloque, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+bloqueSelectCols+`
		FROM juego_dioses.bloques
		ORDER BY creado_en DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBloques(rows)
}

// GetByID implementa get by id.
func (r *BloqueRepository) GetByID(ctx context.Context, bloqueID string) (*domain.Bloque, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+bloqueSelectCols+`
		FROM juego_dioses.bloques
		WHERE id = $1
	`, bloqueID)
	b, err := scanBloqueRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, port.ErrBloqueNotFound
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// WorldBounds implementa world bounds.
func (r *BloqueRepository) WorldBounds(ctx context.Context) ([]domain.BloqueBounds, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT origen_x, origen_y, ancho_metros, alto_metros
		FROM juego_dioses.bloques
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.BloqueBounds
	for rows.Next() {
		var b domain.BloqueBounds
		if err := rows.Scan(&b.OrigenX, &b.OrigenY, &b.AnchoMetros, &b.AltoMetros); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanBloqueRow(row rowScanner) (domain.Bloque, error) {
	var b domain.Bloque
	err := row.Scan(
		&b.ID, &b.Nombre, &b.AnchoMetros, &b.AltoMetros,
		&b.ProfundidadMaxima, &b.AlturaMaxima, &b.TamanoCelda,
		&b.OrigenX, &b.OrigenY, &b.OrigenZ, &b.CreadoPor, &b.CreadoEn,
	)
	return b, err
}

func scanBloques(rows pgx.Rows) ([]domain.Bloque, error) {
	var out []domain.Bloque
	for rows.Next() {
		b, err := scanBloqueRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

var _ port.BloqueRepository = (*BloqueRepository)(nil)
