---
id: "00"
title: Decisiones cerradas
status: cerrado
version: 1
---

# Decisiones cerradas — no renegociar sin actualizar este doc

Documento fuente de verdad para la IA. Si el código contradice esto, el código está mal (o falta actualizar aquí).

---

## Stack greenfield

| Capa | Tech |
|------|------|
| terrain-service | **Rust** |
| game-server, gateway-ws, registry, persistence-api | **Go** |
| Cliente | **TypeScript** (frontend-v2) |
| Inter-servicio | **Protobuf** + Redis Streams |
| Wire al browser | **JSON** (`terrain_*`, `player_state`) |
| Organización interna | **Clean Architecture** (domain → usecase → delivery + infrastructure) |
| HTTP | **Sin versionado** en URLs (`/api/...`, `/internal/...`) |

Monolito Python `backend/` = **referencia inline** por módulo, no destino de deploy.

---

## Límites de producto

| Parámetro | Valor |
|-----------|-------|
| Jugadores por eco | **50** |
| NPCs IA activos por eco | **~20** (resto LOD; ver game-server) |
| Destrucciones / s por **bloque_id** | **50** (jugadores + NPCs) |
| Tick sim p99 | **< 10 ms** |
| 1000 jugadores total (referencia) | **~20 ecos** |

**Bloque ≠ eco.** Varios ecos comparten el mismo `bloque_id` en Postgres. Ecos parten **sim**, no **writes DB**.

---

## Auth (M1 stub → M5 completo)

| Fase | Comportamiento |
|------|----------------|
| **M1–M4** | Gateway + game-server aceptan **JWT stub** (`Authorization: Bearer`). Dev: bypass si `ENV=dev` y body trae `player_id`. |
| **M5** | JWT obligatorio en prod; `sub` = cuenta; registry asigna por personaje/sesión según claims. |

**Contrato stub (claims mínimos):**

```json
{ "sub": "user-uuid", "player_id": "character-session-uuid", "exp": 0 }
```

- `player_id` en WS debe alinearse con JWT en prod (no confiar en body solo).
- Documentar en: `services/gateway-ws/02-contracts.md`, `06-ws-client-json.md`.

---

## HTTP — sin versionado

| Tipo | Patrón |
|------|--------|
| REST público | `/api/bloques`, `/api/particles`, … |
| terrain internal | `/internal/chunks/...`, `/internal/types/...` |
| registry | `/resolve`, `/register`, `/sync-eco` |
| WS gameplay | `/ws` |

No usar `/api/v1`, `/internal/v1`, `/v1/resolve`.

---

## Ecos (Dimensiones Dinámicas)

- v1: `join_block(bloque_id)` → registry elige eco con cupo o crea `eco_id++`.
- v2: party → clan → alianza → eco menos lleno; `POST /sync-eco`.
- v3: eco `type=war` para clanes hostiles.

Diseño narrativo: [25-Dimensiones-Dinamicas-Mecanica.md](../../../Juego%20de%20Dioses/Ideas/ingenieria/25-Dimensiones-Dinamicas-Mecanica.md)

---

## Destrucción (jugador y NPC)

| Regla | Valor |
|-------|-------|
| Reglas de daño | **Iguales** jugador y NPC (integridad → DELETE) |
| NPC sim destrucción | **Siempre** por ahora (todos los ecos) |
| Rate limit | Cuenta al **bloque_id** global (50/s), no por eco |
| Pipeline | game → Redis swing → persistence → DB → invalidate → game broadcast |
| Hot path | **Prohibido** merge terreno en tick sim |

Doc detallada: [10-destruction-pipeline.md](./10-destruction-pipeline.md)

---

## Worldgen / seeds (Go greenfield)

| Regla | Valor |
|-------|-------|
| Quién crea bloques | **In-game** (jugadores/dioses), no solo admin |
| Implementación | **Rewrite Go** en persistence-api (`worldgen/`) |
| Post-seed | Evento **`BlockSeeded`** en Redis (no restart terrain) |

### Cache Redis tras seed (cerrado v1)

| Caso | Acción terrain-service |
|------|------------------------|
| **Bloque nuevo** (`bloque_id` nuevo) | Sin cache previo; primer `ChunkRequest` carga DB |
| **Re-seed / expansión** bloque existente | `BlockSeeded` → **invalidar todo** `chunk:wire:{bloque}:*` + `chunk:solid:*` + bump `block:ver:{bloque}` |
| **Seed parcial** (solo región XY) | v2: invalidar chunks intersectados; v1: invalidación **bloque completo** (más simple) |

Doc detallada: [10-worldgen-seeds.md](./10-worldgen-seeds.md)

---

## Base de datos

- Toda query a `particulas` lleva **`bloque_id`**.
- Partition key futuro = **`bloque_id`** (ver [03-database-postgres.md](./03-database-postgres.md)).
- Ecos **no** shardean DB; sharding DB es independiente del sharding de sim.

---

## Orden de implementación

M0 proto → M1 terrain (Rust) → M2 game-server (Go) → M3 persistence workers → M4 registry → M5 gateway+JWT → M6 wire binario opcional.

Ver [07-implementation-roadmap.md](./07-implementation-roadmap.md).
