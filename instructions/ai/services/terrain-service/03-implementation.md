---
id: TS-3
title: terrain-service — implementación
status: cerrado
version: 1
depends_on: ["TS-1", "TS-2", "SH-2"]
service: terrain-service
lang: rust
---

# terrain-service — implementación

**Usar cuando:** crear crate Rust, módulos, tests, Dockerfile.

---

## Árbol (Clean Architecture — ver [12-clean-architecture.md](../../12-clean-architecture.md))

```text
rust/terrain-service/
├── Cargo.toml
├── Dockerfile
└── src/
    ├── main.rs                 # wiring + spawn consumers
    ├── lib.rs
    ├── config.rs
    ├── session.rs              # session.json loader
    ├── chunkcoords.rs
    ├── domain/
    │   ├── particle.rs
    │   ├── chunk_authority.rs  # merge + wire + solid (inline en mod)
    │   └── port/               # traits ChunkRepository, ChunkCache, EventBus
    ├── application/
    │   ├── load_chunk.rs
    │   ├── invalidate.rs
    │   ├── dto.rs
    │   └── rate_limit.rs
    └── adapters/
        ├── inbound/
        │   ├── http/           # /health, /internal/*
        │   └── redis/          # stream consumers
        └── outbound/
            ├── postgres/
            ├── redis/
            └── wire/           # terrain_* JSON builders
```

---

## Módulos clave

### `ChunkAuthority` (REF: `terrain_store.py`)

```rust
// Pseudocódigo
struct ChunkAuthority {
    // bloque_id -> cell_key -> particle compact
}
impl ChunkAuthority {
    fn merge_rows(&mut self, rows: &[ParticleRow]);
    fn apply_destroyed(&mut self, x: i32, y: i32, z: i32);
    fn wire_particles(&self, cx: i32, cy: i32) -> Vec<WireParticle>;
}
```

### `chunk_worker::process`

1. `mark_pending` — skip si ya en cola
2. `rate_limit.acquire(bloque_id)`
3. `spawn_blocking`: fetch_chunk → merge → build wire + solid
4. `redis_cache.put`
5. `publisher.publish_ready`

### `wire/terrain_messages.rs`

Builders JSON idénticos al schema WS. Tests contra golden files desde Python si existen.

### `postgres.rs`

```sql
-- fetch_chunk: bounds from chunkcoords + session z_min/z_max
-- fetch_types_viewport: DISTINCT tipos en disco radius
```

---

## Config (env)

| Var | Default |
|-----|---------|
| `DATABASE_URL` | required |
| `REDIS_URL` | `redis://redis:6379` |
| `WORKER_COUNT` | 8 |
| `CHUNK_RATE_LIMIT` | 10 |
| `HTTP_PORT` | 8002 |

Ver [infra/env-and-ports.md](../../infra/env-and-ports.md)

---

## Tests

| Test | Qué |
|------|-----|
| `chunkcoords_golden.rs` | Paridad con `go/pkg/jd/chunkcoords` |
| `wire_snapshot.rs` | JSON terrain_chunk vs schema |
| integration | Redis + Postgres testcontainers (opcional M1b) |

---

## Dockerfile

Multi-stage: `rust:1-bookworm` build → `debian:bookworm-slim` runtime.  
Expose 8002. Depends: postgres, redis.

---

## Catálogo numerado (legacy)

Ítems **100–150** en [notes/microservicios-catalogo-nombres.md](../../../notes/microservicios-catalogo-nombres.md) — referencia detallada por símbolo.

---

## Orden implementación M1

1. config + health + postgres ping
2. chunkcoords + session loader
3. redis_cache keys
4. postgres fetch_chunk
5. ChunkAuthority + wire builder
6. consumer + worker + publisher
7. HTTP routes
8. invalidate + block_seeded subscribers
