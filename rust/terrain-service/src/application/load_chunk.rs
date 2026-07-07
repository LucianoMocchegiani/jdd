//! Pipeline: DB → merge → cache → publish terrain:ready.

use crate::adapters::outbound::wire;
use crate::chunkcoords;
use crate::domain::chunk_authority;
use crate::domain::port::PortError;
use crate::session;

use super::dto::ChunkJob;
use super::ChunkService;

/// `execute` — operación pública del módulo.
pub async fn execute(service: &ChunkService, job: &ChunkJob) -> Result<(), PortError> {
    let bloque_id = &job.bloque_id;
    let cx = job.chunk_cx;
    let cy = job.chunk_cy;

    if !service
        .rate_limit
        .acquire_with_retry(bloque_id, 40, std::time::Duration::from_millis(50))
        .await
    {
        tracing::warn!(bloque_id, cx, cy, "rate limited after retries");
        return Err(PortError::RateLimited);
    }

    let chunk_size = session::chunk_size(&service.session);
    let z_min = service.session.terrain_z_min;
    let z_max = service.session.terrain_z_max;

    let rows = service
        .repo
        .fetch_chunk(bloque_id, cx, cy, z_min, z_max, chunk_size)
        .await?;

    let by_cell = chunk_authority::merge_rows_by_cell(&rows);
    let particles =
        chunk_authority::wire_particles_for_chunk(&by_cell, cx, cy, chunk_size);
    let solid_cells = chunk_authority::solid_cells(&by_cell);

    let seq = service.session.version;
    let wire_json = wire::build_terrain_chunk_json(
        bloque_id,
        cx,
        cy,
        z_min,
        z_max,
        seq,
        particles,
    )
    .map_err(|e| PortError::Other(e.to_string()))?;

    let version = service.cache.next_chunk_version(bloque_id, cx, cy).await?;
    service
        .cache
        .put(bloque_id, cx, cy, &wire_json, &solid_cells, version)
        .await?;

    service
        .bus
        .publish_chunk_ready(
            bloque_id,
            cx,
            cy,
            &wire_json,
            &solid_cells,
            version,
            &job.requester_id,
        )
        .await?;

    service.cache.clear_pending(bloque_id, cx, cy).await?;

    tracing::info!(
        bloque_id,
        cx,
        cy,
        particles = by_cell.len(),
        version,
        "chunk ready"
    );
    Ok(())
}

/// `handle_chunk_request` — encola carga o re-publica chunk cacheado al requester.
pub async fn handle_chunk_request(
    service: &ChunkService,
    pool: &super::WorkerPool,
    bloque_id: &str,
    cx: i32,
    cy: i32,
    requester_id: &str,
) -> Result<(), PortError> {
    match enqueue_if_needed(service, pool, bloque_id, cx, cy, requester_id).await? {
        EnqueueResult::CacheHit(cached) => {
            service
                .bus
                .publish_chunk_ready(
                    bloque_id,
                    cx,
                    cy,
                    &cached.wire_json,
                    &cached.solid_cells,
                    cached.version,
                    requester_id,
                )
                .await?;
            tracing::debug!(
                bloque_id,
                cx,
                cy,
                version = cached.version,
                "chunk cache hit — published ready"
            );
        }
        EnqueueResult::Enqueued | EnqueueResult::AlreadyPending => {}
    }
    Ok(())
}

/// `enqueue_if_needed` — operación pública del módulo.
pub async fn enqueue_if_needed(
    service: &ChunkService,
    pool: &super::WorkerPool,
    bloque_id: &str,
    cx: i32,
    cy: i32,
    requester_id: &str,
) -> Result<EnqueueResult, PortError> {
    if let Some(cached) = service.cache.get(bloque_id, cx, cy).await? {
        return Ok(EnqueueResult::CacheHit(cached));
    }

    if !service.cache.try_mark_pending(bloque_id, cx, cy).await? {
        return Ok(EnqueueResult::AlreadyPending);
    }

    pool.enqueue(ChunkJob {
        bloque_id: bloque_id.to_string(),
        chunk_cx: cx,
        chunk_cy: cy,
        requester_id: requester_id.to_string(),
    })
    .await?;

    Ok(EnqueueResult::Enqueued)
}

/// Enum `EnqueueResult`.
pub enum EnqueueResult {
    CacheHit(crate::domain::particle::CachedChunk),
    Enqueued,
    AlreadyPending,
}

/// `chunk_xy_from_cell` — operación pública del módulo.
pub fn chunk_xy_from_cell(x: i32, y: i32, chunk_size: i32) -> (i32, i32) {
    (
        chunkcoords::coord_from_cell(x, chunk_size),
        chunkcoords::coord_from_cell(y, chunk_size),
    )
}

#[cfg(test)]
mod tests {
    use super::chunk_xy_from_cell;

    #[test]
    fn cell_maps_to_chunk() {
        assert_eq!(chunk_xy_from_cell(45, 45, 40), (1, 1));
    }
}
