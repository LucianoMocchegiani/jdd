//! Serialización JSON del chunk hacia game-server.

use serde::Serialize;

/// Estructura `TerrainChunkWire`.
#[derive(Debug, Clone, Serialize)]
pub struct TerrainChunkWire {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub bloque_id: String,
    pub chunk_cx: i32,
    pub chunk_cy: i32,
    pub z_min: i32,
    pub z_max: i32,
    pub seq: i32,
    pub particles: Vec<crate::domain::particle::WireParticle>,
}

/// `build_terrain_chunk_json` — operación pública del módulo.
pub fn build_terrain_chunk_json(
    bloque_id: &str,
    chunk_cx: i32,
    chunk_cy: i32,
    z_min: i32,
    z_max: i32,
    seq: i32,
    particles: Vec<crate::domain::particle::WireParticle>,
) -> Result<String, serde_json::Error> {
    let msg = TerrainChunkWire {
        msg_type: "terrain_chunk".into(),
        bloque_id: bloque_id.to_string(),
        chunk_cx,
        chunk_cy,
        z_min,
        z_max,
        seq,
        particles,
    };
    serde_json::to_string(&msg)
}

/// Estructura `TerrainTypesWire`.
#[derive(Debug, Clone, Serialize)]
pub struct TerrainTypesWire {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub bloque_id: String,
    pub types: Vec<crate::domain::particle::WireTypeEntry>,
}

/// `build_terrain_types_json` — operación pública del módulo.
pub fn build_terrain_types_json(
    bloque_id: &str,
    types: Vec<crate::domain::particle::WireTypeEntry>,
) -> Result<String, serde_json::Error> {
    let msg = TerrainTypesWire {
        msg_type: "terrain_types".into(),
        bloque_id: bloque_id.to_string(),
        types,
    };
    serde_json::to_string(&msg)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::particle::{PhysicsType, WireParticle};

    #[test]
    fn terrain_chunk_has_type_discriminator() {
        let json = build_terrain_chunk_json(
            "bloque-1",
            0,
            0,
            -10,
            32,
            1,
            vec![WireParticle {
                id: "p1".into(),
                x: 0,
                y: 0,
                z: 0,
                tipo_nombre: "tierra".into(),
                tipo_fisico: PhysicsType::Solido,
            }],
        )
        .unwrap();
        assert!(json.contains("\"type\":\"terrain_chunk\""));
        assert!(json.contains("\"tipo_fisico\":\"solido\""));
    }
}
