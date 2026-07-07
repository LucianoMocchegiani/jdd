//! Carga de `shared/game-data/game/session.json` (chunk size, rango Z).

use std::fs;
use std::path::Path;
use std::sync::OnceLock;

use anyhow::{Context, Result};
use serde::Deserialize;

/// Parámetros de sesión compartidos con Go/TS (`session.json`).
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfig {
    pub chunk_size_cells: i32,
    pub terrain_z_min: i32,
    pub terrain_z_max: i32,
    #[serde(default = "default_version")]
    pub version: i32,
}

fn default_version() -> i32 {
    1
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            chunk_size_cells: 40,
            terrain_z_min: -10,
            terrain_z_max: 32,
            version: 1,
        }
    }
}

static SESSION: OnceLock<SessionConfig> = OnceLock::new();

/// Lee y cachea `session.json` (singleton por proceso).
pub fn load(path: &str) -> Result<SessionConfig> {
    if let Some(cfg) = SESSION.get() {
        return Ok(cfg.clone());
    }

    let data = fs::read_to_string(path)
        .with_context(|| format!("read session.json at {path}"))?;
    let mut cfg: SessionConfig = serde_json::from_str(&data).context("parse session.json")?;
    if cfg.chunk_size_cells == 0 {
        cfg.chunk_size_cells = 40;
    }
    let _ = SESSION.set(cfg.clone());
    Ok(cfg)
}

/// Tamaño de chunk en celdas desde la config de sesión.
pub fn chunk_size(cfg: &SessionConfig) -> i32 {
    cfg.chunk_size_cells
}

/// Resuelve ruta relativa al cwd o un nivel arriba (Docker vs local).
pub fn resolve_path(path: &str) -> Result<String> {
    if Path::new(path).exists() {
        return Ok(path.to_string());
    }
    let alt = format!("../{path}");
    if Path::new(&alt).exists() {
        return Ok(alt);
    }
    Ok(path.to_string())
}
