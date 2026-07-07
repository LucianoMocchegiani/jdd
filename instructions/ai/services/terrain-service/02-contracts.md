---
id: TS-2
title: terrain-service — contratos
status: cerrado
version: 1
depends_on: ["05", "04", "10-WG", "10-D"]
service: terrain-service
---

# terrain-service — contratos

**Usar cuando:** HTTP internal, Redis consume/publish, invalidación, integración game-server.

---

## HTTP internal (`/internal`)

Base: `http://terrain-service:8002` (Docker only)

### Chunks

```http
POST /internal/chunks/request
Content-Type: application/json
Body: ChunkRequest (JSON dev | Protobuf futuro)
→ 202 Accepted (encolado) | 200 (cache hit, wire incluido)

GET /internal/chunks/{bloque_id}/{cx}/{cy}/wire
→ 200 JSON terrain_chunk | 404 | 202 encolado

POST /internal/chunks/invalidate-cell
Body: CellDestroyed
→ 204
```

### Types (join)

```http
GET /internal/types/viewport?bloque_id=&x=&y=&radius=&z_min=&z_max=
→ 200 JSON terrain_types wire
```

---

## Redis — consume

| Stream | Group | Acción |
|--------|-------|--------|
| `terrain:requests` | `terrain-workers` | Encolar process chunk |
| `terrain:invalidate` | `terrain-invalidate` | apply_destroyed + cache bump |
| `world:block_seeded` | `terrain-seed` | Invalidar bloque completo v1 |

---

## Redis — publish

| Stream | Mensaje |
|--------|---------|
| `terrain:ready` | `ChunkReady` — filtrar por `requester_id` en consumer game |

---

## ChunkReady (campos)

| Campo | Tipo | Notas |
|-------|------|-------|
| `bloque_id` | string | |
| `chunk_cx`, `chunk_cy` | int | tile 40×40 |
| `wire_json` | string | mensaje `terrain_chunk` completo |
| `solid_cells` | string[] | `"x,y,z"` sólidos |
| `version` | uint64 | chunk ver |
| `requester_id` | string | game instance |

---

## Wire JSON (cliente)

Mismos tipos que schema `shared/game-data/network/terrain-ws.schema.json`:

- `terrain_types`
- `terrain_chunk`
- `terrain_chunk_done`

Ref implementación Python: `terrain_ws_messages.py`  
Doc cliente: [06-ws-client-json.md](../../06-ws-client-json.md) (pendiente)

---

## Health

```http
GET /health
→ { "status": "ok", "postgres": "ok", "redis": "ok" }
```

---

## Rate limits (interno)

| Límite | Valor |
|--------|-------|
| Chunks/s por `bloque_id` | 10 (config `CHUNK_RATE_LIMIT`) |
| Workers | `WORKER_COUNT` (default 8) |

Destrucción rate limit (50/s) vive en **persistence-api**, no aquí.
