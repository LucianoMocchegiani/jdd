//! HTTP: health, invalidate y enqueue manual de chunks.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::application::{
    dto::{CellDestroyed, ChunkRequest},
    invalidate, load_chunk, ChunkService, EnqueueResult, WorkerPool,
};
use crate::domain::port::{HealthCheck, PortError};

/// Estructura `AppState`.
#[derive(Clone)]
pub struct AppState {
    pub service: Arc<ChunkService>,
    pub pool: Arc<WorkerPool>,
    pub postgres: Arc<dyn HealthCheck>,
    pub redis: Arc<dyn HealthCheck>,
}

/// `router` — operación pública del módulo.
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/internal/chunks/request", post(post_chunk_request))
        .route(
            "/internal/chunks/:bloque_id/:cx/:cy/wire",
            get(get_chunk_wire),
        )
        .route("/internal/chunks/invalidate-cell", post(post_invalidate_cell))
        .route("/internal/types/viewport", get(get_types_viewport))
        .with_state(state)
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    postgres: &'static str,
    redis: &'static str,
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    let pg = match state.postgres.ping().await {
        Ok(()) => "ok",
        Err(_) => "error",
    };
    let rd = match state.redis.ping().await {
        Ok(()) => "ok",
        Err(_) => "error",
    };
    let status = if pg == "ok" && rd == "ok" {
        "ok"
    } else {
        "degraded"
    };
    Json(HealthResponse {
        status,
        postgres: pg,
        redis: rd,
    })
}

async fn post_chunk_request(
    State(state): State<AppState>,
    Json(req): Json<ChunkRequest>,
) -> Result<Response, ApiError> {
    let result = load_chunk::enqueue_if_needed(
        &state.service,
        &state.pool,
        &req.bloque_id,
        req.chunk_cx,
        req.chunk_cy,
        &req.requester_id,
    )
    .await?;

    match result {
        EnqueueResult::CacheHit(cached) => {
            let body: Value = serde_json::from_str(&cached.wire_json)
                .unwrap_or_else(|_| json!({ "wire": cached.wire_json }));
            Ok((StatusCode::OK, Json(body)).into_response())
        }
        EnqueueResult::Enqueued | EnqueueResult::AlreadyPending => {
            Ok(StatusCode::ACCEPTED.into_response())
        }
    }
}

async fn get_chunk_wire(
    State(state): State<AppState>,
    Path((bloque_id, cx, cy)): Path<(String, i32, i32)>,
    Query(q): Query<WireQuery>,
) -> Result<Response, ApiError> {
    let requester = q
        .requester_id
        .unwrap_or_else(|| "http".into());

    if let Some(cached) = state
        .service
        .cache
        .get(&bloque_id, cx, cy)
        .await?
    {
        let body: Value = serde_json::from_str(&cached.wire_json)
            .unwrap_or_else(|_| json!({ "wire": cached.wire_json }));
        return Ok((StatusCode::OK, Json(body)).into_response());
    }

    let result = load_chunk::enqueue_if_needed(
        &state.service,
        &state.pool,
        &bloque_id,
        cx,
        cy,
        &requester,
    )
    .await?;

    match result {
        EnqueueResult::CacheHit(cached) => {
            let body: Value = serde_json::from_str(&cached.wire_json)
                .unwrap_or_else(|_| json!({ "wire": cached.wire_json }));
            Ok((StatusCode::OK, Json(body)).into_response())
        }
        EnqueueResult::Enqueued | EnqueueResult::AlreadyPending => {
            Ok(StatusCode::ACCEPTED.into_response())
        }
    }
}

#[derive(Deserialize)]
struct WireQuery {
    requester_id: Option<String>,
}

async fn post_invalidate_cell(
    State(state): State<AppState>,
    Json(body): Json<CellDestroyed>,
) -> Result<StatusCode, ApiError> {
    invalidate::invalidate_cell(&state.service, &body.bloque_id, body.x, body.y, body.z).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct TypesViewportQuery {
    bloque_id: String,
    x: i32,
    y: i32,
    radius: i32,
    #[serde(default)]
    z_min: Option<i32>,
    #[serde(default)]
    z_max: Option<i32>,
}

async fn get_types_viewport(
    State(state): State<AppState>,
    Query(q): Query<TypesViewportQuery>,
) -> Result<Response, ApiError> {
    let _ = (q.z_min, q.z_max);
    let json = invalidate::get_types_viewport(
        &state.service,
        &q.bloque_id,
        q.x,
        q.y,
        q.radius,
    )
    .await?;
    let body: Value = serde_json::from_str(&json)
        .unwrap_or_else(|_| json!({ "raw": json }));
    Ok((StatusCode::OK, Json(body)).into_response())
}

struct ApiError(PortError);

impl From<PortError> for ApiError {
    fn from(value: PortError) -> Self {
        Self(value)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let code = match self.0 {
            PortError::NotFound => StatusCode::NOT_FOUND,
            PortError::RateLimited => StatusCode::TOO_MANY_REQUESTS,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (code, self.0.to_string()).into_response()
    }
}
