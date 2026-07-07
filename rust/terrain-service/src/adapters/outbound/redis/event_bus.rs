//! Adaptador outbound: publica `ChunkReady` en Redis Streams.

use async_trait::async_trait;
use redis::aio::ConnectionManager;
use serde::Serialize;

use crate::adapters::rediskeys;
use crate::domain::port::{EventBus, PortError, PortResult};

#[derive(Serialize)]
struct ChunkReadyPayload<'a> {
    bloque_id: &'a str,
    chunk_cx: i32,
    chunk_cy: i32,
    wire_json: &'a str,
    solid_cells: &'a [String],
    version: u64,
    requester_id: &'a str,
}

/// Event bus Redis (`XADD` en `terrain:ready`).
pub struct RedisEventBus {
    conn: ConnectionManager,
}

impl RedisEventBus {
    /// `connect` — operación pública del módulo.
    pub async fn connect(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }
}

#[async_trait]
impl EventBus for RedisEventBus {
    async fn publish_chunk_ready(
        &self,
        bloque_id: &str,
        chunk_cx: i32,
        chunk_cy: i32,
        wire_json: &str,
        solid_cells: &[String],
        version: u64,
        requester_id: &str,
    ) -> PortResult<()> {
        let payload = ChunkReadyPayload {
            bloque_id,
            chunk_cx,
            chunk_cy,
            wire_json,
            solid_cells,
            version,
            requester_id,
        };
        let json = serde_json::to_string(&payload)
            .map_err(|e| PortError::Other(e.to_string()))?;

        let mut conn = self.conn.clone();
        redis::cmd("XADD")
            .arg(rediskeys::STREAM_TERRAIN_READY)
            .arg("*")
            .arg("payload")
            .arg(json.as_str())
            .query_async::<String>(&mut conn)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(())
    }
}
