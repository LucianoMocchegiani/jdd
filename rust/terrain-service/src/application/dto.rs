//! Mensajes Redis/HTTP deserializados hacia la capa de aplicación.

use serde::{Deserialize, Serialize};

/// Solicitud de chunk entrante (stream `terrain:requests` o HTTP).
/// Estructura `ChunkRequest`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChunkRequest {
    pub bloque_id: String,
    pub chunk_cx: i32,
    pub chunk_cy: i32,
    #[serde(default)]
    pub priority: i32,
    pub requester_id: String,
    #[serde(default)]
    pub player_id: Option<String>,
}

/// Celda destruida en juego; dispara invalidación de cache.
/// Estructura `CellDestroyed`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CellDestroyed {
    pub bloque_id: String,
    pub x: i32,
    pub y: i32,
    pub z: i32,
    #[serde(default)]
    pub particle_id: Option<String>,
}

/// Bloque recién sembrado o regenerado (worldgen → invalidación total).
/// Estructura `BlockSeeded`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BlockSeeded {
    pub bloque_id: String,
    #[serde(default)]
    pub is_new_block: bool,
    #[serde(default)]
    pub block_version: u64,
}

/// Trabajo interno encolado hacia el pool de workers.
/// Estructura `ChunkJob`.
#[derive(Debug, Clone)]
pub struct ChunkJob {
    pub bloque_id: String,
    pub chunk_cx: i32,
    pub chunk_cy: i32,
    pub requester_id: String,
}
