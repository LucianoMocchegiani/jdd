---
id: "07"
title: Roadmap de implementación M0–M6
status: cerrado
version: 1
depends_on: ["00", "01"]
---

# Roadmap M0–M6

**Usar cuando:** planificar sprint, definition of done, orden de extracción.

---

## Fases

| Fase | Entregable | Tech | DoD (resumen) |
|------|------------|------|---------------|
| **M0** | `shared/proto/`, `go/pkg/jd/`, golden chunkcoords | Proto, Go | Tests golden Go↔Rust pasan |
| **M1** | `rust/terrain-service` proceso + Redis + HTTP | Rust | Chunk cold &lt;500ms; cache hit sin DB |
| **M2** | `go/cmd/game-server` WS + tick + SolidGrid + terrain client | Go | player_state 30/s sin gaps durante carga |
| **M3** | persistence swing worker + rate limit bloque | Go | swing no bloquea tick; destroy async |
| **M4** | registry ecos + N game-servers | Go | join → eco con cupo 50 |
| **M5** | gateway-ws + JWT prod | Go | WSS público; auth obligatorio prod |
| **M6** | Wire binario opcional (MsgPack) | — | CPU red reducida |

---

## Orden de carpetas (repo)

```text
1. shared/proto + go/pkg/jd
2. rust/terrain-service
3. go/cmd/game-server
4. go/cmd/persistence-api (+ workers M3)
5. go/cmd/registry
6. go/cmd/gateway-ws
7. docker-compose multi-service
```

---

## M0 — checklist

- [x] `inter_service.proto`, `world_events.proto`
- [x] `go/pkg/jd/session`, `chunkcoords`, `cellkey`, `rediskeys`
- [x] `chunkcoords` golden tests Go + Rust
- [x] `session.json` campos eco/destrucción
- [ ] `go/pkg/jd/contracts` generado (requiere `buf generate` o protoc)

---

## M1 — checklist

- [ ] Axum `/health`, `/internal/*`
- [ ] XREAD `terrain:requests`, XADD `terrain:ready`
- [ ] sqlx fetch chunk + ChunkAuthority merge
- [ ] wire JSON `terrain_chunk` (schema terreno-ws)
- [ ] Redis cache + dedupe pending
- [ ] Consumer `terrain:invalidate`, `world:block_seeded`
- [ ] Dockerfile :8002

---

## M2 — checklist

- [x] `/ws` join_block, input, player_state 30 Hz
- [x] SolidGridCache
- [x] terrainclient publish/subscribe/fanout (Redis)
- [x] Sin Postgres en proceso
- [x] JWT stub dev bypass (`ENV=dev`)

---

## M2b — checklist (paridad terreno WS)

- [x] `terrain_types` vía HTTP terrain-service al join
- [x] `terrain_chunk_done` por ronda y conexión
- [x] Fanout terreno **por conexión** (no broadcast a toda la sala)
- [x] Refresh al alejarse (`terrainRecenterTriggerCells` + intervalo mínimo)
- [x] `typesByName` en BlockSession para sim futura

---

## M3 — checklist

- [x] `persistence-api` consumer `swing:commands`
- [x] `apply_swing` + `apply_particle_damage` (Go, ref Python)
- [x] Rate limit `ratelimit:destroy:{bloque_id}` 50/s
- [x] Publish `terrain:invalidate` + `game:destroyed`
- [x] game-server: `SolidGrid.remove` + WS `particle_destroyed`
- [x] `game:swing_results` → `swing_result` al atacante
- [x] REST `/api/bloques` (stub mínimo — M3b)

---

## M4 — checklist

- [x] `go/cmd/registry` — `/resolve`, `/register`, `/heartbeat`, `/release`, `/sync-eco`
- [x] Redis: `registry:eco:*`, `registry:player:*`, `registry:game:*`
- [x] Cupo 50 jugadores/eco (`MAX_PLAYERS_PER_ECO`)
- [x] game-server: register + heartbeat al startup
- [x] game-server: resolve en `join_block`, release en disconnect
- [x] `join_ok` incluye `eco_id` + `eco_label`
- [x] Salas aisladas por `bloque_id` + `eco_id`

---

## M5 — checklist

- [x] `go/cmd/gateway-ws` — proxy WS `:8082`
- [x] JWT HS256 compartido (`go/pkg/jd/auth`)
- [x] Prod: JWT obligatorio; dev: `ENV=dev` bypass
- [x] `join_block` → registry `/resolve` → upstream game-server
- [x] `player_id` forzado desde JWT en prod (gateway + game-server)
- [x] Rate limit conexiones por IP
- [ ] WSS/TLS terminado en LB (deploy; gateway escucha HTTP)

---

## M6 — checklist

- [x] `go/pkg/jd/wire` — MsgPack para `player_state`
- [x] Negociación `wire_format` en `join_block` / `join_ok`
- [x] game-server: `WIRE_FORMAT=msgpack` → frames binarios en tick
- [x] frontend-v2: `@msgpack/msgpack` + decode frames binarios
- [x] gateway: pipe transparente (texto + binario)
- [ ] `terrain_chunk` en MsgPack (fase 2 — payload grande)

---

## Criterios de éxito global

| Métrica | Target |
|---------|--------|
| game-server tick p99 | &lt; 10 ms |
| player_state gap p99 | &lt; 50 ms |
| terrain chunk cold | &lt; 500 ms ok |
| CPU game durante carga terrain | plano |

---

## Dev vs prod

| | Dev M1–M2 | Prod M5 |
|---|-----------|---------|
| WS | Directo game-server:8001 | gateway-ws:8082 |
| Auth | Bypass + player_id body | JWT obligatorio |
| Registry | Opcional / in-memory | Redis :8003 |

---

## Docs por fase

| Fase | Leer |
|------|------|
| M0 | SH-1, SH-2, SH-3, 05 |
| M1 | TS-1, TS-2, TS-3, 04, 03 |
| M2 | GS-1, GS-2, GS-3, 06, 10-D |
| M3 | PA-*, 10-D |
| M4 | RG-*, 02 |
| M5 | GW-*, 00 auth |
