//! Invalidación de cache por celda, chunk o bloque completo.

use crate::domain::port::PortError;
use crate::session;

use super::load_chunk;
use super::ChunkService;

/// `invalidate_cell` — operación pública del módulo.
pub async fn invalidate_cell(
    service: &ChunkService,
    bloque_id: &str,
    x: i32,
    y: i32,
    _z: i32,
) -> Result<u64, PortError> {
    let chunk_size = session::chunk_size(&service.session);
    let (cx, cy) = load_chunk::chunk_xy_from_cell(x, y, chunk_size);
    service.cache.invalidate_chunk(bloque_id, cx, cy).await
}

/// `handle_block_seeded` — operación pública del módulo.
pub async fn handle_block_seeded(service: &ChunkService, bloque_id: &str) -> Result<(), PortError> {
    service.cache.invalidate_block(bloque_id).await
}

/// `get_types_viewport` — operación pública del módulo.
pub async fn get_types_viewport(
    service: &ChunkService,
    bloque_id: &str,
    x: i32,
    y: i32,
    radius: i32,
) -> Result<String, PortError> {
    let z_min = service.session.terrain_z_min;
    let z_max = service.session.terrain_z_max;
    let types = service
        .repo
        .fetch_types_viewport(bloque_id, x, y, radius, z_min, z_max)
        .await?;
    crate::adapters::outbound::wire::build_terrain_types_json(bloque_id, types)
        .map_err(|e| PortError::Other(e.to_string()))
}
