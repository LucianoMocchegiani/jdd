package worldgen

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultBatchSize = 8000

// ParticleRow fila para INSERT en juego_dioses.particulas.
type ParticleRow struct {
	BloqueID       string
	X, Y, Z        int
	TipoID         string
	EstadoID       string
	Temperatura    float64
	Propiedades    string
	UpsertOnConflict bool
}

// Writer inserta partículas en lotes.
type Writer struct {
	ctx       context.Context
	pool      *pgxpool.Pool
	bloqueID  string
	batch     []ParticleRow
	batchSize int
	inserted  int
}

// NewWriter construye un writer para un bloque.
func NewWriter(ctx context.Context, pool *pgxpool.Pool, bloqueID string) *Writer {
	return &Writer{
		ctx:       ctx,
		pool:      pool,
		bloqueID:  bloqueID,
		batchSize: defaultBatchSize,
	}
}

// Add encola una partícula sólida (conflict: ignore).
func (w *Writer) Add(tipoID, estadoID string, x, y, z int, temp float64) {
	w.batch = append(w.batch, ParticleRow{
		BloqueID: w.bloqueID, X: x, Y: y, Z: z,
		TipoID: tipoID, EstadoID: estadoID, Temperatura: temp,
		Propiedades: "{}",
	})
	if len(w.batch) >= w.batchSize {
		_ = w.Flush()
	}
}

// AddUpsert encola partícula que sobrescribe tipo en conflicto (agua/montaña).
func (w *Writer) AddUpsert(tipoID, estadoID string, x, y, z int, temp float64) {
	w.batch = append(w.batch, ParticleRow{
		BloqueID: w.bloqueID, X: x, Y: y, Z: z,
		TipoID: tipoID, EstadoID: estadoID, Temperatura: temp,
		Propiedades: "{}", UpsertOnConflict: true,
	})
	if len(w.batch) >= w.batchSize {
		_ = w.Flush()
	}
}

// Inserted devuelve total insertado/upserted.
func (w *Writer) Inserted() int { return w.inserted }

// Flush escribe el lote pendiente.
func (w *Writer) Flush() error {
	if len(w.batch) == 0 {
		return nil
	}
	ignore := make([]ParticleRow, 0, len(w.batch))
	upsert := make([]ParticleRow, 0)
	for _, r := range w.batch {
		if r.UpsertOnConflict {
			upsert = append(upsert, r)
		} else {
			ignore = append(ignore, r)
		}
	}
	w.batch = w.batch[:0]
	if len(ignore) > 0 {
		n, err := w.execBatch(w.ctx, ignore, false)
		if err != nil {
			return err
		}
		w.inserted += n
	}
	if len(upsert) > 0 {
		n, err := w.execBatch(w.ctx, upsert, true)
		if err != nil {
			return err
		}
		w.inserted += n
	}
	return nil
}

func (w *Writer) execBatch(ctx context.Context, rows []ParticleRow, upsert bool) (int, error) {
	batch := &pgx.Batch{}
	for _, r := range rows {
		if upsert {
			batch.Queue(`
				INSERT INTO juego_dioses.particulas
				(bloque_id, celda_x, celda_y, celda_z, tipo_particula_id, estado_materia_id,
				 cantidad, temperatura, energia, extraida, agrupacion_id, es_nucleo, propiedades)
				VALUES ($1,$2,$3,$4,$5,$6,1,$7,0,false,NULL,false,$8::jsonb)
				ON CONFLICT (bloque_id, celda_x, celda_y, celda_z) DO UPDATE
				SET tipo_particula_id = EXCLUDED.tipo_particula_id,
				    estado_materia_id = EXCLUDED.estado_materia_id,
				    temperatura = EXCLUDED.temperatura
			`, r.BloqueID, r.X, r.Y, r.Z, r.TipoID, r.EstadoID, r.Temperatura, r.Propiedades)
		} else {
			batch.Queue(`
				INSERT INTO juego_dioses.particulas
				(bloque_id, celda_x, celda_y, celda_z, tipo_particula_id, estado_materia_id,
				 cantidad, temperatura, energia, extraida, agrupacion_id, es_nucleo, propiedades)
				VALUES ($1,$2,$3,$4,$5,$6,1,$7,0,false,NULL,false,$8::jsonb)
				ON CONFLICT (bloque_id, celda_x, celda_y, celda_z) DO NOTHING
			`, r.BloqueID, r.X, r.Y, r.Z, r.TipoID, r.EstadoID, r.Temperatura, r.Propiedades)
		}
	}
	br := w.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range rows {
		if _, err := br.Exec(); err != nil {
			return 0, fmt.Errorf("insert batch: %w", err)
		}
	}
	return len(rows), nil
}

// DeleteBlockByName elimina bloque existente y sus partículas.
func DeleteBlockByName(ctx context.Context, pool *pgxpool.Pool, nombre string) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM juego_dioses.particulas
		WHERE bloque_id IN (SELECT id FROM juego_dioses.bloques WHERE nombre = $1)
	`, nombre)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `DELETE FROM juego_dioses.bloques WHERE nombre = $1`, nombre)
	return err
}

// CreateBlock inserta un bloque y devuelve su ID.
func CreateBlock(ctx context.Context, pool *pgxpool.Pool, nombre string, anchoM, altoM, cellSize float64, profMax int) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO juego_dioses.bloques (
			nombre, ancho_metros, alto_metros, profundidad_maxima, altura_maxima, tamano_celda
		) VALUES ($1, $2, $3, $4, 40, $5)
		RETURNING id::text
	`, nombre, anchoM, altoM, profMax, cellSize).Scan(&id)
	return id, err
}

// CountParticles cuenta partículas activas del bloque.
func CountParticles(ctx context.Context, pool *pgxpool.Pool, bloqueID string) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM juego_dioses.particulas
		WHERE bloque_id = $1 AND extraida = false
	`, bloqueID).Scan(&n)
	return n, err
}
