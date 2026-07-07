---
id: TS-1
title: terrain-service — overview
status: cerrado
version: 1
depends_on: ["00", "01", "03", "04"]
service: terrain-service
lang: rust
---

# terrain-service — overview

**Rust** · puerto **8002** · **solo red interna** · dueño del terreno pesado.

**Usar cuando:** implementar M1, chunks, cache, invalidación, BlockSeeded.

---

## Rol

| Sí | No |
|----|-----|
| SELECT Postgres por chunk | Simular jugadores |
| Merge por celda (ChunkAuthority) | `player_state` |
| Serializar JSON `terrain_*` wire | Input / swing |
| Cache Redis wire + solid | Query en tick ajeno |
| Consumir ChunkRequest, publish ChunkReady | |
| Invalidar por CellDestroyed, BlockSeeded | |

---

## Pipeline

```text
ChunkRequest (Redis)
  → dedupe pending
  → spawn_blocking / rayon
      → postgres SELECT chunk
      → ChunkAuthority.merge
      → wire JSON + solid_cells
      → redis SET cache
  → XADD terrain:ready
  → rate limit por bloque_id (~10 chunks/s)
```

---

## Escala

- Réplicas horizontales; cache Redis compartida
- Workers CPU fuera del runtime async principal (tokio + rayon)
- Latencia cold 50–500 ms **aceptable** — nunca bloquear game-server

---

## Referencia Python

| Rust | Python |
|------|--------|
| ChunkAuthority | `backend/src/game/world/terrain_store.py` |
| chunk worker | `backend/src/game/terrain/chunk_service.py` |
| wire builders | `backend/src/game/network/terrain_ws_messages.py` |

---

## Docs

- Contratos: [02-contracts.md](./02-contracts.md)
- Implementación: [03-implementation.md](./03-implementation.md)

---

## Prohibido

- Emitir WS al cliente directo (v1 — game fanout)
- Merge global sin `bloque_id` scope
