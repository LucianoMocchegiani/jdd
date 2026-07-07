---
id: INDEX
title: Índice documentación IA — Juego de Dioses
status: cerrado
version: 1
---

# Índice — arquitectura greenfield

**Skill:** `use-index` — leer este archivo primero, luego solo los docs de la columna *Usar cuando*.

**Decisiones:** [00-decisions-closed.md](./00-decisions-closed.md) · **Términos:** [GLOSSARY.md](./GLOSSARY.md)

**Estado:** `cerrado` = diseño acordado · `borrador` = esqueleto · `pendiente` = aún no creado

---

## Cómo usar (IA)

1. Identificar tema de la tarea del usuario.
2. Buscar fila en tablas abajo por *Usar cuando*.
3. Leer **00** si hay duda de stack/límites.
4. Leer máximo **2–4 docs** por tarea (no cargar todo el árbol).
5. **No** usar `instructions/notes/` — ver [ARCHIVED](../notes/ARCHIVED.md).

---

## Transversales

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **00** | [00-decisions-closed.md](./00-decisions-closed.md) | Stack, límites, auth stub, ecos, destrucción, worldgen | Cualquier decisión arquitectura; duda "¿está permitido?" | cerrado |
| **G** | [GLOSSARY.md](./GLOSSARY.md) | bloque_id, eco, sim, shard, ES/EN | Terminología; naming en código | cerrado |
| **01** | [01-architecture-overview.md](./01-architecture-overview.md) | 5 servicios, flujos join/tick/destrucción, diagramas | Visión global; onboarding; dónde va cada cosa | cerrado |
| **02** | [02-ecos-dimensions.md](./02-ecos-dimensions.md) | Bloque vs eco, sync, guerra v3, link Dimensiones Dinámicas | Registry, matchmaking, >50 jugadores mismo mapa | cerrado |
| **03** | [03-database-postgres.md](./03-database-postgres.md) | Schema particulas, writes, partition bloque_id, sharding | DB, migrations, rate limit writes, escalado Postgres | cerrado |
| **04** | [04-redis-streams.md](./04-redis-streams.md) | Streams, keys cache, BlockSeeded | Colas, Redis, invalidación | cerrado |
| **05** | [05-proto-inter-service.md](./05-proto-inter-service.md) | Protobuf ChunkRequest, ChunkReady, Swing, etc. | Generar/cambiar contratos inter-servicio | cerrado |
| **06** | [06-ws-client-json.md](./06-ws-client-json.md) | join_block, terrain_*, player_state, JWT stub | Cliente TS, wire browser, gateway | pendiente |
| **07** | [07-implementation-roadmap.md](./07-implementation-roadmap.md) | M0–M6, orden, definition of done | Planificar sprints; qué implementar primero | cerrado |
| **11** | [11-monorepo-layout.md](./11-monorepo-layout.md) | Árbol repo, Docker, naming | Crear archivos; dónde va un módulo | cerrado |
| **12** | [12-clean-architecture.md](./12-clean-architecture.md) | Capas domain/usecase/delivery/infra, sin /v1 | Estructura interna servicios; ports | cerrado |
| **08** | [08-sla-observability.md](./08-sla-observability.md) | tick p99, métricas, health, alertas | Performance, debug player_state gaps | pendiente |
| **09** | [09-frontend-v2.md](./09-frontend-v2.md) | ECS cliente, terrain-store, quality tiers, predict | Frontend, render, móvil vs PC | pendiente |
| **10-D** | [10-destruction-pipeline.md](./10-destruction-pipeline.md) | Jugador+NPC destrucción async, rate limit bloque | Swing, NPC rompe, particle_destroyed | cerrado |
| **10-WG** | [10-worldgen-seeds.md](./10-worldgen-seeds.md) | Seeds in-game Go, BlockSeeded, cache invalidation | Crear bloque, dioses, expandir mundo | cerrado |

---

## Shared

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **SH-1** | [shared/game-data-session.md](./shared/game-data-session.md) | session.json, maxPlayersPerEco, radios | Config compartida Go/Rust/TS | cerrado |
| **SH-2** | [shared/go-pkg-jd.md](./shared/go-pkg-jd.md) | pkg/jd: chunkcoords, session, rediskeys | Código Go compartido | cerrado |
| **SH-3** | [shared/proto-generation.md](./shared/proto-generation.md) | buf, go generate, layout proto | Añadir mensajes Protobuf | cerrado |

---

## terrain-service (Rust)

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **TS-1** | [services/terrain-service/01-overview.md](./services/terrain-service/01-overview.md) | Rol Rust, pipeline chunk, prohibiciones | Implementar terrain M1 | cerrado |
| **TS-2** | [services/terrain-service/02-contracts.md](./services/terrain-service/02-contracts.md) | HTTP internal, Redis in/out, BlockSeeded | API terrain, eventos | cerrado |
| **TS-3** | [services/terrain-service/03-implementation.md](./services/terrain-service/03-implementation.md) | Árbol crate, ChunkAuthority, workers | Código Rust concreto | cerrado |

---

## game-server (Go)

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **GS-1** | [services/game-server/01-overview.md](./services/game-server/01-overview.md) | Sim 30Hz, SolidGrid, NPCs ~20 activos | Implementar game M2, ECS | pendiente |
| **GS-2** | [services/game-server/02-contracts.md](./services/game-server/02-contracts.md) | WS gameplay, Redis terrain, HTTP types | Handlers WS, terrain client | pendiente |
| **GS-3** | [services/game-server/03-implementation.md](./services/game-server/03-implementation.md) | cmd/game-server, terrainclient, ECS | Código Go concreto | pendiente |

---

## persistence-api (Go)

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **PA-1** | [services/persistence-api/01-overview.md](./services/persistence-api/01-overview.md) | REST, swing worker, worldgen | REST `/api`, admin | pendiente |
| **PA-2** | [services/persistence-api/02-contracts.md](./services/persistence-api/02-contracts.md) | REST routes, Redis publish | API HTTP, eventos daño/seed | pendiente |
| **PA-3** | [services/persistence-api/03-implementation.md](./services/persistence-api/03-implementation.md) | DB repos, worldgen/, workers | Código Go persistence | pendiente |

---

## registry (Go)

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **RG-1** | [services/registry/01-overview.md](./services/registry/01-overview.md) | Ecos, cupo 50, assign party v2 | Routing, shards, ecos | pendiente |
| **RG-2** | [services/registry/02-contracts.md](./services/registry/02-contracts.md) | /v1/resolve, /v1/sync-eco, register | API registry | pendiente |
| **RG-3** | [services/registry/03-implementation.md](./services/registry/03-implementation.md) | Redis eco model, assignment | Código Go registry | pendiente |

---

## gateway-ws (Go)

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **GW-1** | [services/gateway-ws/01-overview.md](./services/gateway-ws/01-overview.md) | Proxy WSS, JWT stub M1 | Gateway M5, dev proxy | pendiente |
| **GW-2** | [services/gateway-ws/02-contracts.md](./services/gateway-ws/02-contracts.md) | JWT claims, rate limit, upstream | Auth, headers | pendiente |
| **GW-3** | [services/gateway-ws/03-implementation.md](./services/gateway-ws/03-implementation.md) | ws proxy, resolve | Código Go gateway | pendiente |

---

## Infra

| ID | Doc | Resumen | Usar cuando | Estado |
|----|-----|---------|-------------|--------|
| **IF-1** | [infra/docker-compose.md](./infra/docker-compose.md) | Servicios, puertos, scale | Docker, deploy local | cerrado |
| **IF-2** | [infra/env-and-ports.md](./infra/env-and-ports.md) | Env vars por servicio | Configuración, .env | cerrado |

---

## Diseño de producto (externo)

| Doc | Usar cuando |
|-----|-------------|
| [25-Dimensiones-Dinamicas-Mecanica.md](../../../Juego%20de%20Dioses/Ideas/ingenieria/25-Dimensiones-Dinamicas-Mecanica.md) | Narrativa ecos, guerra, sync dimensión |
| Ideas/ingenieria/ (otros) | Mecánicas MMO, límites jugadores — enlazar, no duplicar |

---

## Mapa rápido por tarea

| Tarea usuario | Leer |
|---------------|------|
| Implementar terrain Rust | 00, TS-1, TS-2, TS-3, 05, 04 |
| Implementar game-server Go | 00, GS-1, GS-2, GS-3, 06, 10-D |
| Swing / romper suelo | 10-D, PA-2, TS-2, 03 |
| Crear bloque / seed in-game | 10-WG, PA-3, TS-2, 03 |
| Ecos / 50 jugadores | 00, 02, RG-1, RG-2 |
| JWT / auth | 00, GW-2, 06 |
| Cliente Three.js | 06, 09, GLOSSARY |
| DB sharding | 00, 03, 10-WG |
| Plan sprint | 07, INDEX |
| Crear archivo / carpeta nueva | **11**, **12**, INDEX |
| Capas clean / usecase / ports | **12** |

---

## Migración desde notes/

Contenido legacy en `instructions/notes/` **reescrito** progresivamente en `instructions/ai/`. Hasta completar migración, contrastar con notes solo si el doc ai está `pendiente`.

| notes/ (legacy) | Reemplazo ai/ |
|-----------------|---------------|
| microservicios-estructura.md | 01 + services/*/01 |
| microservicios-catalogo-nombres.md | services/*/03 + SH-* |
| terreno-ws.md | 06 |
| arquitectura-escala-microservicios.md | 01, 02, 03 |
