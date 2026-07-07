//! Variables de entorno y configuración del proceso.

use std::env;

use anyhow::{Context, Result};

/// Configuración runtime leída desde variables de entorno.
#[derive(Clone, Debug)]
pub struct Config {
    pub http_port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub worker_count: usize,
    pub chunk_rate_limit: u32,
    pub session_json_path: String,
}

impl Config {
    /// `from_env` — operación pública del módulo.
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            http_port: env::var("HTTP_PORT")
                .unwrap_or_else(|_| "8002".into())
                .parse()
                .context("HTTP_PORT")?,
            database_url: env::var("DATABASE_URL").context("DATABASE_URL required")?,
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into()),
            worker_count: env::var("WORKER_COUNT")
                .unwrap_or_else(|_| "8".into())
                .parse()
                .context("WORKER_COUNT")?,
            chunk_rate_limit: env::var("CHUNK_RATE_LIMIT")
                .unwrap_or_else(|_| "10".into())
                .parse()
                .context("CHUNK_RATE_LIMIT")?,
            session_json_path: env::var("SESSION_JSON_PATH")
                .unwrap_or_else(|_| "shared/game-data/game/session.json".into()),
        })
    }
}
