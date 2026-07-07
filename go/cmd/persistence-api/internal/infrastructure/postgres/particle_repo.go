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

// ParticleRepository representa particle repository.
type ParticleRepository struct {
	pool *pgxpool.Pool
}

// NewParticleRepository construye particle repository.
func NewParticleRepository(pool *pgxpool.Pool) *ParticleRepository {
	return &ParticleRepository{pool: pool}
}

// GetParticlesNear implementa get particles near.
func (r *ParticleRepository) GetParticlesNear(ctx context.Context, bloqueID string, cx, cy, cz float64, radius int) ([]domain.ParticleNear, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.id, p.bloque_id, p.celda_x, p.celda_y, p.celda_z, tp.tipo_fisico, p.extraida
		FROM juego_dioses.particulas p
		JOIN juego_dioses.tipos_particulas tp ON p.tipo_particula_id = tp.id
		WHERE p.bloque_id = $1
		  AND p.extraida = false
		  AND ABS(p.celda_x - $2) <= $5 AND ABS(p.celda_y - $3) <= $5 AND ABS(p.celda_z - $4) <= $5
		  AND (POWER(p.celda_x - $2, 2) + POWER(p.celda_y - $3, 2) + POWER(p.celda_z - $4, 2)) <= POWER($5, 2)
		ORDER BY POWER(p.celda_x - $2, 2) + POWER(p.celda_y - $3, 2) + POWER(p.celda_z - $4, 2)
	`, bloqueID, cx, cy, cz, radius)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.ParticleNear
	for rows.Next() {
		var p domain.ParticleNear
		if err := rows.Scan(&p.ID, &p.BloqueID, &p.CeldaX, &p.CeldaY, &p.CeldaZ, &p.TipoFisico, &p.Extraida); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetWithDureza implementa get with dureza.
func (r *ParticleRepository) GetWithDureza(ctx context.Context, bloqueID, particleID string) (*domain.ParticleWithDureza, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT p.id, p.bloque_id, p.celda_x, p.celda_y, p.celda_z,
		       p.tipo_particula_id, COALESCE(p.integridad, 1.0), COALESCE(tp.dureza, 1.0)
		FROM juego_dioses.particulas p
		JOIN juego_dioses.tipos_particulas tp ON p.tipo_particula_id = tp.id
		WHERE p.id = $1 AND p.bloque_id = $2 AND p.extraida = false
	`, particleID, bloqueID)

	var p domain.ParticleWithDureza
	err := row.Scan(&p.ID, &p.BloqueID, &p.CeldaX, &p.CeldaY, &p.CeldaZ, &p.TipoParticulaID, &p.Integridad, &p.Dureza)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// GetIntegrityTransitions implementa get integrity transitions.
func (r *ParticleRepository) GetIntegrityTransitions(ctx context.Context, tipoParticulaID string) ([]domain.IntegrityTransition, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT condicion_integridad, valor_integridad
		FROM juego_dioses.transiciones_particulas
		WHERE tipo_origen_id = $1 AND activa = true AND condicion_integridad IS NOT NULL
		ORDER BY prioridad DESC
	`, tipoParticulaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.IntegrityTransition
	for rows.Next() {
		var t domain.IntegrityTransition
		if err := rows.Scan(&t.Condicion, &t.Valor); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// ApplyDamage implementa apply damage.
func (r *ParticleRepository) ApplyDamage(ctx context.Context, particleID string, nuevaIntegridad float64) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE juego_dioses.particulas SET integridad = $1, modificado_en = NOW() WHERE id = $2`,
		nuevaIntegridad, particleID,
	)
	return err
}

// DeleteParticle implementa delete particle.
func (r *ParticleRepository) DeleteParticle(ctx context.Context, particleID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM juego_dioses.particulas WHERE id = $1`, particleID)
	return err
}

var _ port.ParticleRepository = (*ParticleRepository)(nil)
