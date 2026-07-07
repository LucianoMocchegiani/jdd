//! Cache Redis de chunks (wire JSON, pending, versiones).

use async_trait::async_trait;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use crate::adapters::rediskeys;
use crate::domain::particle::CachedChunk;
use crate::domain::port::{ChunkCache, PortError, PortResult};

const WIRE_TTL_SECS: u64 = 3600;
const PENDING_TTL_SECS: u64 = 120;

/// Estructura `RedisChunkCache`.
#[derive(Clone)]
pub struct RedisChunkCache {
    conn: ConnectionManager,
}

impl RedisChunkCache {
    /// `connect` — operación pública del módulo.
    pub async fn connect(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }
}

#[async_trait]
impl ChunkCache for RedisChunkCache {
    async fn get(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<Option<CachedChunk>> {
        let mut conn = self.conn.clone();
        let wire_key = rediskeys::chunk_wire_key(bloque_id, cx, cy);
        let solid_key = rediskeys::chunk_solid_key(bloque_id, cx, cy);
        let ver_key = rediskeys::chunk_ver_key(bloque_id, cx, cy);

        let wire: Option<String> = conn
            .get(&wire_key)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        let Some(wire_json) = wire else {
            return Ok(None);
        };

        let solid_raw: Option<String> = conn
            .get(&solid_key)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        let solid_cells: Vec<String> = solid_raw
            .map(|s| {
                if s.is_empty() {
                    vec![]
                } else {
                    s.split('\n').map(str::to_string).collect()
                }
            })
            .unwrap_or_default();

        let version: u64 = conn
            .get(&ver_key)
            .await
            .unwrap_or(0);

        Ok(Some(CachedChunk {
            wire_json,
            solid_cells,
            version,
        }))
    }

    async fn put(
        &self,
        bloque_id: &str,
        cx: i32,
        cy: i32,
        wire_json: &str,
        solid_cells: &[String],
        version: u64,
    ) -> PortResult<()> {
        let mut conn = self.conn.clone();
        let wire_key = rediskeys::chunk_wire_key(bloque_id, cx, cy);
        let solid_key = rediskeys::chunk_solid_key(bloque_id, cx, cy);
        let ver_key = rediskeys::chunk_ver_key(bloque_id, cx, cy);
        let solid_payload = solid_cells.join("\n");

        conn.set_ex::<_, _, ()>(&wire_key, wire_json, WIRE_TTL_SECS)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        conn.set_ex::<_, _, ()>(&solid_key, solid_payload, WIRE_TTL_SECS)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        conn.set::<_, _, ()>(&ver_key, version)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(())
    }

    async fn try_mark_pending(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<bool> {
        let mut conn = self.conn.clone();
        let key = rediskeys::chunk_pending_key(bloque_id, cx, cy);
        let set: bool = redis::cmd("SET")
            .arg(&key)
            .arg("1")
            .arg("NX")
            .arg("EX")
            .arg(PENDING_TTL_SECS)
            .query_async(&mut conn)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(set)
    }

    async fn clear_pending(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<()> {
        let mut conn = self.conn.clone();
        let key = rediskeys::chunk_pending_key(bloque_id, cx, cy);
        conn.del::<_, ()>(key)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(())
    }

    async fn invalidate_chunk(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<u64> {
        let mut conn = self.conn.clone();
        let wire_key = rediskeys::chunk_wire_key(bloque_id, cx, cy);
        let solid_key = rediskeys::chunk_solid_key(bloque_id, cx, cy);
        let ver_key = rediskeys::chunk_ver_key(bloque_id, cx, cy);
        let pending_key = rediskeys::chunk_pending_key(bloque_id, cx, cy);

        let _: () = conn.del((wire_key, solid_key, pending_key))
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;

        let version: u64 = conn.incr(ver_key, 1_u64)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(version)
    }

    async fn invalidate_block(&self, bloque_id: &str) -> PortResult<()> {
        let mut conn = self.conn.clone();
        let patterns = [
            format!("chunk:wire:{bloque_id}:*"),
            format!("chunk:solid:{bloque_id}:*"),
            format!("chunk:pending:{bloque_id}:*"),
            format!("chunk:ver:{bloque_id}:*"),
        ];

        for pattern in patterns {
            let keys: Vec<String> = conn.keys(&pattern)
                .await
                .map_err(|e| PortError::Other(e.to_string()))?;
            if !keys.is_empty() {
                let _: () = conn.del(keys)
                    .await
                    .map_err(|e| PortError::Other(e.to_string()))?;
            }
        }

        let block_ver = rediskeys::block_ver_key(bloque_id);
        let _: u64 = conn.incr(block_ver, 1_u64)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(())
    }

    async fn next_chunk_version(&self, bloque_id: &str, cx: i32, cy: i32) -> PortResult<u64> {
        let mut conn = self.conn.clone();
        let ver_key = rediskeys::chunk_ver_key(bloque_id, cx, cy);
        let version: u64 = conn.incr(ver_key, 1_u64)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(version)
    }

    async fn ping(&self) -> PortResult<()> {
        let mut conn = self.conn.clone();
        redis::cmd("PING")
            .query_async::<()>(&mut conn)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(())
    }
}

#[async_trait]
impl crate::domain::port::HealthCheck for RedisChunkCache {
    async fn ping(&self) -> PortResult<()> {
        let mut conn = self.conn.clone();
        redis::cmd("PING")
            .query_async::<()>(&mut conn)
            .await
            .map_err(|e| PortError::Other(e.to_string()))?;
        Ok(())
    }
}
