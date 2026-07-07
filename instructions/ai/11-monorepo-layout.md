---
id: "11"
title: Monorepo — organización de código y archivos
status: cerrado
version: 1
depends_on: ["00", "01", "07"]
---

# Monorepo — organización de código y archivos

**Usar cuando:** crear archivos nuevos, dudar dónde va un módulo, imports, nombres de carpetas, Dockerfile.

**Regla de oro:** un **servicio = un proceso = un `main`**. Código compartido solo en `shared/` y `go/pkg/jd/`. **Nunca** importar `internal/` de otro servicio.

---

## Árbol objetivo (completo)

```text
juego-de-dioses/
│
├── shared/                          # Contratos estáticos (sin lógica de negocio pesada)
│   ├── game-data/
│   │   ├── game/session.json        # Fuente de verdad tuning (Go/Rust/TS)
│   │   └── network/                 # terrain-ws.schema.json
│   └── proto/                       # Protobuf inter-servicio
│       ├── inter_service.proto
│       ├── world_events.proto
│       └── buf.gen.yaml
│
├── go/
│   ├── go.work                      # Workspace: todos los módulos Go
│   ├── pkg/jd/                      # LIB compartida (importable por todos los cmd)
│   │   ├── go.mod
│   │   ├── session/
│   │   ├── chunkcoords/
│   │   ├── cellkey/
│   │   ├── rediskeys/
│   │   └── contracts/               # generado desde proto (M0b)
│   │
│   └── cmd/                         # Un directorio = un binario deployable
│       ├── game-server/
│       │   ├── go.mod               # module .../cmd/game-server
│       │   ├── Dockerfile
│       │   ├── main.go
│       │   └── internal/            # PRIVADO — solo este servicio
│       │       ├── config/
│       │       ├── network/         # ws, state_sender, handlers
│       │       ├── game/            # BlockSession, SolidGrid, registry
│       │       ├── terrainclient/   # Redis + HTTP hacia terrain
│       │       └── ecs/             # sim autoritativa
│       │
│       ├── persistence-api/
│       │   ├── internal/
│       │   │   ├── api/             # REST routers por dominio
│       │   │   ├── database/        # pool, repos
│       │   │   ├── workers/         # swing, events
│       │   │   └── worldgen/        # seeds in-game (Go)
│       │   └── ...
│       │
│       ├── registry/
│       │   └── internal/
│       │       ├── api/
│       │       ├── domain/          # Eco, assignment
│       │       └── store/           # Redis
│       │
│       └── gateway-ws/
│           └── internal/
│               ├── proxy/
│               ├── middleware/      # auth, ratelimit
│               └── config/
│
├── rust/
│   └── terrain-service/             # Un crate = un servicio
│       ├── Cargo.toml
│       ├── Dockerfile
│       ├── src/
│       │   ├── main.rs              # axum, lifespan, router
│       │   ├── lib.rs               # re-export módulos testeables
│       │   ├── config.rs
│       │   ├── api/                 # routes HTTP internal
│       │   ├── domain/              # ChunkAuthority, solid_extractor
│       │   ├── infrastructure/      # postgres, redis_cache
│       │   ├── workers/             # consumer, chunk_worker, publisher
│       │   ├── wire/                # JSON terrain_* (schema WS)
│       │   ├── subscribers/         # invalidate, block_seeded
│       │   ├── chunkcoords.rs       # paridad go/pkg/jd (golden tests)
│       │   └── session.rs           # lee session.json
│       └── tests/                   # integration + golden
│
├── frontend-v2/                     # Cliente TS — estructura actual
│   └── src/
│       ├── game/network/            # WS, parse terrain
│       ├── game/terrain/            # terrain-store, cache
│       └── ecs/                     # cliente
│
├── database/                        # SQL migrations / init Postgres
│   └── init/
│
├── backend/                         # LEGACY Python — solo referencia
│   └── src/                         # no deploy; ver python_ref en docs
│
├── docker-compose.yml
└── instructions/ai/               # Diseño para IA (use-index)
```

---

## Capas internas por servicio

**Fuente de verdad:** [12-clean-architecture.md](./12-clean-architecture.md) — domain → usecase → delivery + infrastructure (ports/adapters).

Resumen del árbol `internal/` (Go) o `src/` (Rust):

```text
go/cmd/<servicio>/internal/
├── domain/           # entities + ports (interfaces)
├── usecase/          # casos de uso (Join, Tick, LoadChunk…)
├── delivery/         # http/, ws/ — handlers delgados
└── infrastructure/   # postgres/, redis/, httpclient/

rust/terrain-service/src/
├── domain/           # ChunkAuthority + traits (ports)
├── application/      # use cases
└── adapters/         # inbound (http, redis) + outbound (pg, redis, wire)
```

| Capa | Responsabilidad | Prohibido |
|------|-----------------|-----------|
| **delivery** | Parse DTO, status codes, routing WS/HTTP | SQL, merge terreno, lógica de negocio |
| **usecase** | Orquesta domain + ports | Importar pgx/redis concretos |
| **domain** | Entidades, reglas, **interfaces** | Importar delivery o infrastructure |
| **infrastructure** | Implementa ports | Importar delivery |

**`main.go` / `main.rs`:** solo wiring (DI) — sin lógica de negocio.

Detalle por servicio (game-server, terrain, persistence, registry, gateway): ver **12 § 1–5**.

---

## Dependencias entre capas

```text
delivery (WS/HTTP)
    → usecase
        → domain (entities + ports)
            ↑ implementado por
    infrastructure (postgres, redis, clients)
```

- **Nunca** `domain` importa `delivery` ni `infrastructure`.
- **Nunca** handler llama pgx/redis directo — delega al use case.

---

## Tamaño de archivo (guía)

| Tipo | Líneas orientativas | Si crece mucho |
|------|---------------------|----------------|
| Handler WS/HTTP | &lt; 150 | extraer parse a `messages.go` |
| Use case | &lt; 200 | split por acción |
| BlockSession / ChunkAuthority | &lt; 300 | split por responsabilidad |
| ECS system | &lt; 200 | un archivo por system |
| Repo SQL | &lt; 250 | split por tabla |

---

## Tests por servicio

| Servicio | Unit | Integration |
|----------|------|-------------|
| game-server | `domain/*`, `usecase/*` (mocks ports) | WS + mock terrain Redis |
| terrain-service | `domain/*`, `application/*` | testcontainers PG+Redis |
| persistence-api | `domain/*`, `usecase/*` | swing pipeline |
| registry | `domain/*`, `usecase/*` | Redis mini |
| gateway-ws | `usecase/*` | mock registry |

Ver también **12 § Tests por capa**.

---

## `go/pkg/jd` — qué puede vivir aquí

| Sí | No |
|----|-----|
| chunkcoords, cellkey, session loader | Lógica ECS |
| rediskeys builders | Repos Postgres |
| contracts protobuf generados | Handlers WS |
| Pure functions sin estado de servicio | BlockSession |

Si un paquete necesita Redis client o pgx → va en el **`internal/infrastructure/`** del servicio, no en `pkg/jd`.

---

## `shared/` — qué puede vivir aquí

| Sí | No |
|----|-----|
| session.json, JSON schemas | Código Go/Rust |
| .proto | Tests |
| Registries JSON estáticos (tipos partícula) | Secrets |

Cambio en `session.json` → actualizar loaders Go (`session/`), Rust (`session.rs`), TS (`game-config`).

---

## Árbol de decisión: ¿dónde creo el archivo?

```text
¿Es contrato estático JSON/schema/proto?
  → shared/

¿Lo usan 2+ servicios Go y es puro/util sin I/O?
  → go/pkg/jd/

¿Es el binario de un servicio Go?
  → go/cmd/<servicio>/main.go
  → go/cmd/<servicio>/internal/...

¿Es terrain (Postgres chunks, wire, cache)?
  → rust/terrain-service/src/...

¿Es UI o predicción cliente?
  → frontend-v2/src/...

¿Es SQL migration?
  → database/

¿Es referencia del monolito viejo?
  → backend/ (no copiar a producción)
```

---

## Convenciones de nombres

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Servicio | kebab-case carpeta | `game-server`, `terrain-service` |
| Go package | lowercase una palabra | `package usecase`, `package port` |
| Go archivos | snake en nombre archivo | `solid_grid.go`, `state_sender.go` |
| Rust módulos | snake_case | `chunk_authority.rs` |
| Rust types | PascalCase | `ChunkAuthority` |
| Redis streams | `domain:action` | `terrain:requests` |
| HTTP internal | `/internal/...` | terrain, no público |
| HTTP REST | `/api/...` | persistence, público |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL` |
| Proto package | `jd` | `ChunkRequest` — sin versión en URL |

---

## Módulos Go (`go.mod`)

Cada `cmd/<servicio>` tiene **su propio `go.mod`**:

```text
github.com/juego-de-dioses/jd/pkg/jd          ← lib compartida
github.com/juego-de-dioses/jd/cmd/game-server  ← binario
github.com/juego-de-dioses/jd/cmd/persistence-api
...
```

`go.work` en `go/` los une para desarrollo local.

**Imports permitidos:**

```go
import "github.com/juego-de-dioses/jd/pkg/jd/chunkcoords"  // ✅
import "github.com/juego-de-dioses/jd/cmd/game-server/internal/game"  // ❌ desde otro cmd
```

---

## Tests

| Tipo | Ubicación |
|------|-----------|
| Golden chunkcoords Go↔Rust | `go/pkg/jd/chunkcoords/*_test.go` + `rust/.../tests/` |
| Unit servicio Go | `go/cmd/<svc>/internal/<pkg>/*_test.go` |
| Unit Rust | `rust/terrain-service/src/**` + `tests/` |
| Integration (Redis/Postgres) | `tests/` o `*_integration_test.go` con build tag |
| Frontend | `frontend-v2` vitest/jest existente |

Correr desde raíz repo (paths relativos a `session.json`).

---

## Docker

| Servicio | Dockerfile |
|----------|------------|
| game-server | `go/cmd/game-server/Dockerfile` |
| persistence-api | `go/cmd/persistence-api/Dockerfile` |
| registry | `go/cmd/registry/Dockerfile` |
| gateway-ws | `go/cmd/gateway-ws/Dockerfile` |
| terrain-service | `rust/terrain-service/Dockerfile` |

Build context: **raíz monorepo** (para acceder a `shared/`).

```dockerfile
# ejemplo game-server
COPY shared/ /shared/
COPY go/ /go/
WORKDIR /go/cmd/game-server
RUN go build -o /app .
```

---

## Referencia Python (`backend/`)

| Greenfield | Referencia legacy |
|------------|-----------------|
| `go/cmd/game-server/internal/ecs` | `backend/src/ecs/` |
| `rust/.../domain/chunk_authority` | `backend/src/game/world/terrain_store.py` |
| `rust/.../wire` | `backend/src/game/network/terrain_ws_messages.py` |
| `go/cmd/persistence-api/internal/worldgen` | `backend/src/world_creation_engine/` |

**No** importar Python desde Go/Rust. **No** añadir features nuevas en `backend/` salvo prototipo temporal.

---

## Orden de aparición en el repo (M0→M6)

| Fase | Carpetas que aparecen |
|------|------------------------|
| M0 | `shared/proto`, `go/pkg/jd`, `rust/terrain-service` (stub) |
| M1 | `rust/terrain-service/src/**` completo |
| M2 | `go/cmd/game-server/**` |
| M3 | `go/cmd/persistence-api/internal/workers` |
| M4 | `go/cmd/registry/**` |
| M5 | `go/cmd/gateway-ws/**` |
| — | `go/pkg/jd/contracts` tras `buf generate` |

---

## Anti-patrones (prohibido)

| Anti-patrón | Por qué |
|-------------|---------|
| `pkg/jd` importa pgx/redis | Acopla lib a infra |
| game-server con `internal/database` | Rompe aislamiento sim |
| terrain en Go | Decisión: Rust |
| Lógica sim en persistence-api | Fuera de rol |
| Un solo `go.mod` gigante sin `cmd/` | Deploy acoplado |
| Copiar `backend/` entero a `go/` | Reimplementar con diseño nuevo |
| Proto en wire al browser | JSON WS al cliente |

---

## Docs relacionados

| Tema | Doc |
|------|-----|
| Servicios y flujos | [01-architecture-overview.md](./01-architecture-overview.md) |
| terrain-service detalle | [services/terrain-service/03-implementation.md](./services/terrain-service/03-implementation.md) |
| Roadmap | [07-implementation-roadmap.md](./07-implementation-roadmap.md) |
| pkg/jd | [shared/go-pkg-jd.md](./shared/go-pkg-jd.md) |
| Docker | [infra/docker-compose.md](./infra/docker-compose.md) |
| Docs inline (TSDoc / godoc / rustdoc) | `.cursor/rules/inline-documentation.mdc` |
| Regenerar docs masivos | `scripts/add-inline-docs.py`, `add-export-docs.py`, `add-ts-export-docs.py` |
