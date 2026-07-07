//! Implementación ChunkRepository con sqlx.

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::chunkcoords;
use crate::domain::particle::{ParticleRow, PhysicsType, WireTypeEntry};
use crate::domain::port::{ChunkRepository, PortError, PortResult};

/// Estructura `PostgresChunkRepository`.
#[derive(Clone)]
pub struct PostgresChunkRepository {
    pool: PgPool,
}

impl PostgresChunkRepository {
    /// `new` — operación pública del módulo.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct RowParticle {
    id: Uuid,
    celda_x: i32,
    celda_y: i32,
    celda_z: i32,
    tipo_nombre: String,
    tipo_fisico: String,
    color: Option<String>,
    viscosidad: Option<f64>,
    opacidad: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct RowType {
    nombre: String,
    tipo_fisico: String,
    color: Option<String>,
    viscosidad: Option<f64>,
    opacidad: Option<f64>,
}

#[async_trait]
impl ChunkRepository for PostgresChunkRepository {
    async fn fetch_chunk(
        &self,
        bloque_id: &str,
        chunk_cx: i32,
        chunk_cy: i32,
        z_min: i32,
        z_max: i32,
        chunk_size: i32,
    ) -> PortResult<Vec<ParticleRow>> {
        let bloque_uuid = Uuid::parse_str(bloque_id)
            .map_err(|e| PortError::Other(format!("invalid bloque_id: {e}")))?;
        let (x_min, x_max, y_min, y_max) =
            chunkcoords::cell_bounds(chunk_cx, chunk_cy, chunk_size);

        let rows: Vec<RowParticle> = sqlx::query_as(
            r#"
            SELECT p.id, p.celda_x, p.celda_y, p.celda_z,
                   tp.nombre AS tipo_nombre, tp.tipo_fisico, tp.color,
                   tp.viscosidad::float8 AS viscosidad, tp.opacidad::float8 AS opacidad
            FROM juego_dioses.particulas p
            JOIN juego_dioses.tipos_particulas tp ON p.tipo_particula_id = tp.id
            WHERE p.bloque_id = $1
              AND p.extraida = false
              AND p.celda_x BETWEEN $2 AND $3
              AND p.celda_y BETWEEN $4 AND $5
              AND p.celda_z BETWEEN $6 AND $7
            "#,
        )
        .bind(bloque_uuid)
        .bind(x_min)
        .bind(x_max)
        .bind(y_min)
        .bind(y_max)
        .bind(z_min)
        .bind(z_max)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| PortError::Other(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| ParticleRow {
                id: r.id.to_string(),
                celda_x: r.celda_x,
                celda_y: r.celda_y,
                celda_z: r.celda_z,
                tipo_nombre: r.tipo_nombre,
                tipo_fisico: PhysicsType::parse(&r.tipo_fisico),
                color: r.color,
                viscosidad: r.viscosidad,
                opacidad: r.opacidad,
            })
            .collect())
    }

    async fn fetch_types_viewport(
        &self,
        bloque_id: &str,
        center_x: i32,
        center_y: i32,
        radius: i32,
        z_min: i32,
        z_max: i32,
    ) -> PortResult<Vec<WireTypeEntry>> {
        let bloque_uuid = Uuid::parse_str(bloque_id)
            .map_err(|e| PortError::Other(format!("invalid bloque_id: {e}")))?;
        let x_min = (center_x - radius).max(0);
        let x_max = center_x + radius;
        let y_min = (center_y - radius).max(0);
        let y_max = center_y + radius;

        let rows: Vec<RowType> = sqlx::query_as(
            r#"
            SELECT DISTINCT tp.nombre, tp.tipo_fisico, tp.color,
                   tp.viscosidad::float8 AS viscosidad, tp.opacidad::float8 AS opacidad
            FROM juego_dioses.particulas p
            JOIN juego_dioses.tipos_particulas tp ON p.tipo_particula_id = tp.id
            WHERE p.bloque_id = $1
              AND p.extraida = false
              AND p.celda_x BETWEEN $2 AND $3
              AND p.celda_y BETWEEN $4 AND $5
              AND p.celda_z BETWEEN $6 AND $7
            "#,
        )
        .bind(bloque_uuid)
        .bind(x_min)
        .bind(x_max)
        .bind(y_min)
        .bind(y_max)
        .bind(z_min)
        .bind(z_max)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| PortError::Other(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| WireTypeEntry {
                nombre: r.nombre,
                tipo_fisico: PhysicsType::parse(&r.tipo_fisico),
                color: r.color,
                viscosidad: r.viscosidad,
                opacidad: r.opacidad,
            })
            .collect())
    }
}

#[async_trait]
impl crate::domain::port::HealthCheck for PostgresChunkRepository {
    async fn ping(&self) -> PortResult<()> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(())
    }
}
