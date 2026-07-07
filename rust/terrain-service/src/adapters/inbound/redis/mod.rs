//! Consumidor Redis: streams `terrain:requests`, destrucción y block-seeded.

use std::sync::Arc;

use redis::streams::{StreamReadOptions, StreamReadReply};
use redis::{AsyncCommands, FromRedisValue, Value};
use tracing::{info, warn};

use crate::adapters::rediskeys;
use crate::application::dto::{BlockSeeded, CellDestroyed, ChunkJob, ChunkRequest};
use crate::application::{load_chunk, invalidate, ChunkService, WorkerPool};

/// `run_requests_consumer` — operación pública del módulo.
pub async fn run_requests_consumer(
    redis_url: &str,
    service: Arc<ChunkService>,
    pool: Arc<WorkerPool>,
) -> anyhow::Result<()> {
    let client = redis::Client::open(redis_url)?;
    let mut conn = client.get_multiplexed_async_connection().await?;
    ensure_group(&mut conn, rediskeys::STREAM_TERRAIN_REQUESTS, rediskeys::GROUP_TERRAIN_WORKERS).await?;

    let consumer = format!("terrain-{}", std::process::id());
    loop {
        let reply: StreamReadReply = conn
            .xread_options(
                &[rediskeys::STREAM_TERRAIN_REQUESTS],
                &[">"],
                &StreamReadOptions::default()
                    .group(rediskeys::GROUP_TERRAIN_WORKERS, &consumer)
                    .count(10)
                    .block(5000),
            )
            .await?;

        for stream in reply.keys {
            for entry in stream.ids {
                if let Some(payload) = entry.map.get("payload") {
                    if let Ok(req) = parse_payload::<ChunkRequest>(payload) {
                        match load_chunk::handle_chunk_request(
                            &service,
                            &pool,
                            &req.bloque_id,
                            req.chunk_cx,
                            req.chunk_cy,
                            &req.requester_id,
                        )
                        .await
                        {
                            Ok(()) => {}
                            Err(e) => warn!(error = %e, "enqueue from stream failed"),
                        }
                    }
                }
                let _: () = conn
                    .xack(
                        rediskeys::STREAM_TERRAIN_REQUESTS,
                        rediskeys::GROUP_TERRAIN_WORKERS,
                        &[entry.id.as_str()],
                    )
                    .await?;
            }
        }
    }
}

/// `run_invalidate_consumer` — operación pública del módulo.
pub async fn run_invalidate_consumer(
    redis_url: &str,
    service: Arc<ChunkService>,
) -> anyhow::Result<()> {
    let client = redis::Client::open(redis_url)?;
    let mut conn = client.get_multiplexed_async_connection().await?;
    ensure_group(
        &mut conn,
        rediskeys::STREAM_TERRAIN_INVALIDATE,
        rediskeys::GROUP_TERRAIN_INVALIDATE,
    )
    .await?;

    let consumer = format!("invalidate-{}", std::process::id());
    loop {
        let reply: StreamReadReply = conn
            .xread_options(
                &[rediskeys::STREAM_TERRAIN_INVALIDATE],
                &[">"],
                &StreamReadOptions::default()
                    .group(rediskeys::GROUP_TERRAIN_INVALIDATE, &consumer)
                    .count(10)
                    .block(5000),
            )
            .await?;

        for stream in reply.keys {
            for entry in stream.ids {
                if let Some(payload) = entry.map.get("payload") {
                    if let Ok(evt) = parse_payload::<CellDestroyed>(payload) {
                        if let Err(e) = invalidate::invalidate_cell(
                            &service,
                            &evt.bloque_id,
                            evt.x,
                            evt.y,
                            evt.z,
                        )
                        .await
                        {
                            warn!(error = %e, "invalidate cell failed");
                        }
                    }
                }
                let _: () = conn
                    .xack(
                        rediskeys::STREAM_TERRAIN_INVALIDATE,
                        rediskeys::GROUP_TERRAIN_INVALIDATE,
                        &[entry.id.as_str()],
                    )
                    .await?;
            }
        }
    }
}

/// `run_block_seeded_consumer` — operación pública del módulo.
pub async fn run_block_seeded_consumer(
    redis_url: &str,
    service: Arc<ChunkService>,
) -> anyhow::Result<()> {
    let client = redis::Client::open(redis_url)?;
    let mut conn = client.get_multiplexed_async_connection().await?;
    ensure_group(
        &mut conn,
        rediskeys::STREAM_BLOCK_SEEDED,
        rediskeys::GROUP_TERRAIN_SEED,
    )
    .await?;

    let consumer = format!("seed-{}", std::process::id());
    loop {
        let reply: StreamReadReply = conn
            .xread_options(
                &[rediskeys::STREAM_BLOCK_SEEDED],
                &[">"],
                &StreamReadOptions::default()
                    .group(rediskeys::GROUP_TERRAIN_SEED, &consumer)
                    .count(5)
                    .block(5000),
            )
            .await?;

        for stream in reply.keys {
            for entry in stream.ids {
                if let Some(payload) = entry.map.get("payload") {
                    if let Ok(evt) = parse_payload::<BlockSeeded>(payload) {
                        info!(bloque_id = %evt.bloque_id, "BlockSeeded — invalidate block cache");
                        if let Err(e) =
                            invalidate::handle_block_seeded(&service, &evt.bloque_id).await
                        {
                            warn!(error = %e, "block seeded invalidate failed");
                        }
                    }
                }
                let _: () = conn
                    .xack(
                        rediskeys::STREAM_BLOCK_SEEDED,
                        rediskeys::GROUP_TERRAIN_SEED,
                        &[entry.id.as_str()],
                    )
                    .await?;
            }
        }
    }
}

async fn ensure_group(
    conn: &mut redis::aio::MultiplexedConnection,
    stream: &str,
    group: &str,
) -> anyhow::Result<()> {
    let result: redis::RedisResult<String> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg(stream)
        .arg(group)
        .arg("0")
        .arg("MKSTREAM")
        .query_async(conn)
        .await;
    match result {
        Ok(_) => Ok(()),
        Err(e) if e.to_string().contains("BUSYGROUP") => Ok(()),
        Err(e) => Err(e.into()),
    }
}

fn parse_payload<T: serde::de::DeserializeOwned>(value: &Value) -> Result<T, serde_json::Error> {
    match value {
        Value::BulkString(bytes) => serde_json::from_slice(bytes),
        Value::SimpleString(s) => serde_json::from_str(s),
        Value::Array(items) if !items.is_empty() => parse_payload(&items[0]),
        other => {
            let s = String::from_redis_value(other).unwrap_or_default();
            serde_json::from_str(&s)
        }
    }
}

#[allow(dead_code)]
fn chunk_job_from_request(req: ChunkRequest) -> ChunkJob {
    ChunkJob {
        bloque_id: req.bloque_id,
        chunk_cx: req.chunk_cx,
        chunk_cy: req.chunk_cy,
        requester_id: req.requester_id,
    }
}
