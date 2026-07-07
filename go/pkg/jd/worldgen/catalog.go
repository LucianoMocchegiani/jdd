// Package worldgen — generación de bloques y partículas (seeds in-game / CLI).
package worldgen

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Catalog resuelve IDs de tipos y estados por nombre.
type Catalog struct {
	Hierba  string
	Tierra  string
	Piedra  string
	Agua    string
	Madera  string
	Hojas   string
	Limite  string
	Solido  string
	Liquido string
}

func loadTipoID(ctx context.Context, pool *pgxpool.Pool, nombre string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		SELECT id::text FROM juego_dioses.tipos_particulas WHERE nombre = $1
	`, nombre).Scan(&id)
	return id, err
}

func loadEstadoID(ctx context.Context, pool *pgxpool.Pool, nombre string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		SELECT id::text FROM juego_dioses.estados_materia WHERE nombre = $1
	`, nombre).Scan(&id)
	return id, err
}

// LoadCatalog carga nombres requeridos desde Postgres.
func LoadCatalog(ctx context.Context, pool *pgxpool.Pool) (*Catalog, error) {
	c := &Catalog{}
	var err error
	if c.Hierba, err = loadTipoID(ctx, pool, "hierba"); err != nil {
		return nil, fmt.Errorf("tipo hierba: %w", err)
	}
	if c.Tierra, err = loadTipoID(ctx, pool, "tierra"); err != nil {
		return nil, fmt.Errorf("tipo tierra: %w", err)
	}
	if c.Piedra, err = loadTipoID(ctx, pool, "piedra"); err != nil {
		return nil, fmt.Errorf("tipo piedra: %w", err)
	}
	if c.Agua, err = loadTipoID(ctx, pool, "agua"); err != nil {
		return nil, fmt.Errorf("tipo agua: %w", err)
	}
	if c.Madera, err = loadTipoID(ctx, pool, "madera"); err != nil {
		return nil, fmt.Errorf("tipo madera: %w", err)
	}
	if c.Hojas, err = loadTipoID(ctx, pool, "hojas"); err != nil {
		return nil, fmt.Errorf("tipo hojas: %w", err)
	}
	if c.Limite, err = loadTipoID(ctx, pool, "límite"); err != nil {
		return nil, fmt.Errorf("tipo límite: %w", err)
	}
	if c.Solido, err = loadEstadoID(ctx, pool, "solido"); err != nil {
		return nil, fmt.Errorf("estado solido: %w", err)
	}
	if c.Liquido, err = loadEstadoID(ctx, pool, "liquido"); err != nil {
		return nil, fmt.Errorf("estado liquido: %w", err)
	}
	return c, nil
}
