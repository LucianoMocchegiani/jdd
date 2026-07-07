//! Puertos del dominio (hexagonal): Postgres, Redis cache y event bus.

use async_trait::async_trait;
use thiserror::Error;

use super::particle::{CachedChunk, ParticleRow, WireTypeEntry};

/// Error de adaptador o regla de aplicación expuesta al borde.
#[derive(Debug, Error)]
pub enum PortError {
    #[error("not found")]
    NotFound,
    #[error("already pending")]
    AlreadyPending,
    #[error("rate limited")]
    RateLimited,
    #[error("{0}")]
    Other(String),
}

/// Resultado estándar de puertos del dominio.
pub type PortResult<T> = Result<T, PortError>;

/// Lectura de partículas desde Postgres por tile de chunk.
#[async_trait]
pub trait ChunkRepository: Send + Sync {
    async fn fetch_chunk(
        &self,
        bloque_id: &str,
        chunk_cx: i32,
        chunk_cy: i32,
        z_min: i32,
        z_max: i32,
        chunk_size: i32,
    ) -> PortResult<Vec<ParticleRow>>;

    async fn fetch_types_viewport(
        &self,
        bloque_id: &str,
        center_x: i32,
        center_y: i32,
        radius: i32,
        z_min: i32,
        z_max: i32,
    ) -> PortResult<Vec<WireTypeEntry>>;
}

/// Cache Redis de chunks (wire JSON, sólidos, pending, versiones).
#[async_trait]
pub trait ChunkCache: Send + Sync {
    async fn get(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<Option<CachedChunk>>;
    async fn put(
        &self,
        bloque_id: &str,
        cx: i32,
        cy: i32,
        wire_json: &str,
        solid_cells: &[String],
        version: u64,
    ) -> PortResult<()>;
    async fn try_mark_pending(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<bool>;
    async fn clear_pending(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<()>;
    async fn invalidate_chunk(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<u64>;
    async fn invalidate_block(&self, bloque_id: &str) -> PortResult<()>;
    async fn next_chunk_version(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<u64>;
    async fn ping(&self) -> PortResult<()>;
}

/// Publicación de eventos hacia otros servicios (stream `terrain:ready`).
#[async_trait]
pub trait EventBus: Send + Sync {
    async fn publish_chunk_ready(
        &self,
        bloque_id: &str,
        chunk_cx: i32,
        chunk_cy: i32,
        wire_json: &str,
        solid_cells: &[String],
        version: u64,
        requester_id: &str,
    ) -> PortResult<()>;
}

/// Ping de dependencias para health HTTP.
#[async_trait]
pub trait HealthCheck: Send + Sync {
    async fn ping(&self) -> PortResult<()>;
}
