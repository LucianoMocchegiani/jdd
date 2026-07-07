//! Rate limit por requester para solicitudes de chunk.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::Mutex;

/// Token bucket per bloque_id — CHUNK_RATE_LIMIT chunks/s.
pub struct ChunkRateLimiter {
    limit: u32,
    buckets: Mutex<HashMap<String, (u32, Instant)>>,
}

impl ChunkRateLimiter {
    /// `new` — operación pública del módulo.
    pub fn new(limit: u32) -> Self {
        Self {
            limit: limit.max(1),
            buckets: Mutex::new(HashMap::new()),
        }
    }

    /// `acquire` — operación pública del módulo.
    pub async fn acquire(&self, bloque_id: &str) -> bool {
        let mut buckets = self.buckets.lock().await;
        let now = Instant::now();
        let window = Duration::from_secs(1);

        let entry = buckets.entry(bloque_id.to_string()).or_insert((0, now));
        if now.duration_since(entry.1) >= window {
            *entry = (0, now);
        }
        if entry.0 >= self.limit {
            return false;
        }
        entry.0 += 1;
        true
    }

    /// Espera hasta obtener token (reintentos con backoff corto en ráfagas de join).
    pub async fn acquire_with_retry(
        &self,
        bloque_id: &str,
        max_attempts: u32,
        delay: Duration,
    ) -> bool {
        for attempt in 0..max_attempts {
            if self.acquire(bloque_id).await {
                return true;
            }
            if attempt + 1 < max_attempts {
                tokio::time::sleep(delay).await;
            }
        }
        false
    }
}

/// `SharedRateLimiter`.
pub type SharedRateLimiter = Arc<ChunkRateLimiter>;
