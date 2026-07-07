//! Modelo de partícula y tipos físicos para el wire hacia game-server.

use serde::Serialize;

/// Tipo físico de una partícula (solido, liquido, gas, energia).
/// Enum `PhysicsType`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PhysicsType {
    Solido,
    Liquido,
    Gas,
    Energia,
}

impl PhysicsType {
    /// `parse` — operación pública del módulo.
    pub fn parse(s: &str) -> Self {
        match s {
            "liquido" => Self::Liquido,
            "gas" => Self::Gas,
            "energia" => Self::Energia,
            _ => Self::Solido,
        }
    }
}

impl Serialize for PhysicsType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let s = match self {
            PhysicsType::Solido => "solido",
            PhysicsType::Liquido => "liquido",
            PhysicsType::Gas => "gas",
            PhysicsType::Energia => "energia",
        };
        serializer.serialize_str(s)
    }
}

/// Estructura `ParticleRow`.
#[derive(Clone, Debug)]
pub struct ParticleRow {
    pub id: String,
    pub celda_x: i32,
    pub celda_y: i32,
    pub celda_z: i32,
    pub tipo_nombre: String,
    pub tipo_fisico: PhysicsType,
    pub color: Option<String>,
    pub viscosidad: Option<f64>,
    pub opacidad: Option<f64>,
}

/// Estructura `WireParticle`.
#[derive(Clone, Debug, Serialize)]
pub struct WireParticle {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub tipo_nombre: String,
    pub tipo_fisico: PhysicsType,
}

/// Estructura `WireTypeEntry`.
#[derive(Clone, Debug, Serialize)]
pub struct WireTypeEntry {
    pub nombre: String,
    pub tipo_fisico: PhysicsType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub viscosidad: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacidad: Option<f64>,
}

/// Estructura `CachedChunk`.
#[derive(Clone, Debug)]
pub struct CachedChunk {
    pub wire_json: String,
    pub solid_cells: Vec<String>,
    pub version: u64,
}
