---
id: SH-1
title: shared/game-data — session.json
status: cerrado
version: 1
---

# session.json

**Usar cuando:** radios terreno, Z, límites eco, config compartida Go/Rust/TS.

**Path:** `shared/game-data/game/session.json`

---

## Campos actuales

| Campo | Valor | Uso |
|-------|-------|-----|
| `chunkSizeCells` | 40 | Tile XY chunk |
| `viewportRadiusCells` | 28 | Render cliente |
| `terrainCollisionLoadRadiusCells` | 48 | Colisión + carga server |
| `terrainRecenterTriggerCells` | 12 | Refresh ventana |
| `terrainRefreshMinIntervalSec` | 0.5 | Throttle refresh |
| `terrainZMin` | -10 | SELECT Z / wire |
| `terrainZMax` | 32 | SELECT Z / wire |
| `terrainWsMaxChunksPerTick` | 2 | Fanout WS por tick |
| `playerMoveSpeedCells` | 6 | Sim |
| `gravityCells` | 18 | Sim |

---

## Campos a añadir (greenfield)

```json
{
  "maxPlayersPerEco": 50,
  "ecoSpawnThreshold": 50,
  "maxActiveNpcsPerEco": 20,
  "maxDestroyPerBlockPerSec": 50
}
```

Actualizar **Go, Rust y TS** al cambiar. Single source: este JSON.

---

## Loaders

| Lang | Módulo |
|------|--------|
| Go | `go/pkg/jd/session` |
| Rust | `terrain-service/src/session.rs` |
| TS | `frontend-v2` game-config (existente) |

---

## Schema WS

`shared/game-data/network/terrain-ws.schema.json` — validar wire JSON terrain.
