//! DTOs y casos de uso: carga de chunks, invalidación y rate limit.

pub mod dto;
pub mod invalidate;
pub mod load_chunk;
pub mod rate_limit;

pub use dto::*;
pub use load_chunk::EnqueueResult;
pub use rate_limit::{ChunkRateLimiter, SharedRateLimiter};

use std::sync::Arc;

use tokio::sync::{mpsc, Mutex};

use crate::domain::port::{ChunkCache, ChunkRepository, EventBus, PortError};
use crate::session::SessionConfig;

/// Cola async de jobs de chunk hacia workers Tokio.
pub struct WorkerPool {
    tx: mpsc::Sender<ChunkJob>,
}

impl WorkerPool {
    /// `spawn` — operación pública del módulo.
    pub fn spawn(worker_count: usize, service: Arc<ChunkService>) -> Self {
        let (tx, rx) = mpsc::channel::<ChunkJob>(4096);
        let rx = Arc::new(Mutex::new(rx));

        for id in 0..worker_count {
            let service = Arc::clone(&service);
            let rx = Arc::clone(&rx);
            tokio::spawn(async move {
                tracing::debug!(worker = id, "chunk worker started");
                loop {
                    let job = {
                        let mut guard = rx.lock().await;
                        guard.recv().await
                    };
                    match job {
                        Some(job) => {
                            if let Err(e) = service.process_job(job).await {
                                tracing::warn!(error = %e, "chunk job failed");
                            }
                        }
                        None => break,
                    }
                }
            });
        }

        Self { tx }
    }

    /// `enqueue` — operación pública del módulo.
    pub async fn enqueue(&self, job: ChunkJob) -> Result<(), PortError> {
        self.tx
            .send(job)
            .await
            .map_err(|e| PortError::Other(e.to_string()))
    }
}

/// Orquestador: repo + cache + bus + rate limit + session tuning.
pub struct ChunkService {
    pub repo: Arc<dyn ChunkRepository>,
    pub cache: Arc<dyn ChunkCache>,
    pub bus: Arc<dyn EventBus>,
    pub session: SessionConfig,
    pub rate_limit: SharedRateLimiter,
}

impl ChunkService {
    /// `new` — operación pública del módulo.
    pub fn new(
        repo: Arc<dyn ChunkRepository>,
        cache: Arc<dyn ChunkCache>,
        bus: Arc<dyn EventBus>,
        session: SessionConfig,
        rate_limit: SharedRateLimiter,
    ) -> Self {
        Self {
            repo,
            cache,
            bus,
            session,
            rate_limit,
        }
    }

    /// `process_job` — operación pública del módulo.
    pub async fn process_job(&self, job: ChunkJob) -> Result<(), PortError> {
        load_chunk::execute(self, &job).await
    }
}
