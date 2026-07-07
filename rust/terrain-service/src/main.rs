//! Punto de entrada: axum, workers Redis/HTTP y lifespan.

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use terrain_service::adapters::inbound::http;
use terrain_service::adapters::inbound::redis as redis_inbound;
use terrain_service::adapters::outbound::postgres::chunk_repository::PostgresChunkRepository;
use terrain_service::adapters::outbound::redis::chunk_cache::RedisChunkCache;
use terrain_service::adapters::outbound::redis::event_bus::RedisEventBus;
use terrain_service::application::{ChunkRateLimiter, ChunkService, WorkerPool};
use terrain_service::config::Config;
use terrain_service::domain::port::{ChunkCache, ChunkRepository, EventBus, HealthCheck};
use terrain_service::session;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cfg = Config::from_env()?;
    let session_path = session::resolve_path(&cfg.session_json_path)?;
    let session_cfg = session::load(&session_path)?;

    let pg_pool = PgPoolOptions::new()
        .max_connections(16)
        .connect(&cfg.database_url)
        .await
        .context("postgres connect")?;

    let pg_repo = Arc::new(PostgresChunkRepository::new(pg_pool));
    let repo: Arc<dyn ChunkRepository> = Arc::clone(&pg_repo) as Arc<dyn ChunkRepository>;

    let redis_cache = Arc::new(
        RedisChunkCache::connect(&cfg.redis_url)
            .await
            .context("redis cache connect")?,
    );
    let cache: Arc<dyn ChunkCache> = Arc::clone(&redis_cache) as Arc<dyn ChunkCache>;

    let redis_bus = RedisEventBus::connect(&cfg.redis_url)
        .await
        .context("redis event bus connect")?;
    let bus: Arc<dyn EventBus> = Arc::new(redis_bus);

    let rate_limit = Arc::new(ChunkRateLimiter::new(cfg.chunk_rate_limit));
    let service = Arc::new(ChunkService::new(
        repo,
        Arc::clone(&cache),
        bus,
        session_cfg,
        Arc::clone(&rate_limit),
    ));

    let pool = Arc::new(WorkerPool::spawn(cfg.worker_count, Arc::clone(&service)));

    let postgres_health: Arc<dyn HealthCheck> = pg_repo;
    let redis_health: Arc<dyn HealthCheck> = redis_cache;

    let app_state = http::AppState {
        service: Arc::clone(&service),
        pool,
        postgres: postgres_health,
        redis: redis_health,
    };

    let redis_url = cfg.redis_url.clone();
    tokio::spawn({
        let service = Arc::clone(&service);
        let pool = Arc::clone(&app_state.pool);
        async move {
            if let Err(e) = redis_inbound::run_requests_consumer(&redis_url, service, pool).await {
                tracing::error!(error = %e, "terrain:requests consumer stopped");
            }
        }
    });
    tokio::spawn({
        let service = Arc::clone(&service);
        let url = cfg.redis_url.clone();
        async move {
            if let Err(e) = redis_inbound::run_invalidate_consumer(&url, service).await {
                tracing::error!(error = %e, "terrain:invalidate consumer stopped");
            }
        }
    });
    tokio::spawn({
        let service = Arc::clone(&service);
        let url = cfg.redis_url.clone();
        async move {
            if let Err(e) = redis_inbound::run_block_seeded_consumer(&url, service).await {
                tracing::error!(error = %e, "world:block_seeded consumer stopped");
            }
        }
    });

    let app = http::router(app_state).layer(TraceLayer::new_for_http());
    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.http_port));
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(%addr, "terrain-service listening");
    axum::serve(listener, app).await?;
    Ok(())
}
