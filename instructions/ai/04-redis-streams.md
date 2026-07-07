---
id: "04"
title: Redis — streams y cache keys
status: cerrado
version: 1
depends_on: ["00", "05"]
---

# Redis — streams y cache

**Usar cuando:** colas inter-servicio, cache chunks, registry, invalidación, BlockSeeded.

Payload inter-servicio: **Protobuf** serializado en campo stream (ver [05-proto-inter-service.md](./05-proto-inter-service.md)).

---

## Streams

| Stream | Productor | Consumidor | Mensaje |
|--------|-----------|------------|---------|
| `terrain:requests` | game-server | terrain-service | `ChunkRequest` |
| `terrain:ready` | terrain-service | game-server | `ChunkReady` |
| `terrain:invalidate` | persistence-api | terrain-service | `CellDestroyed` |
| `swing:commands` | game-server | persistence-api | `SwingCommand` |
| `game:destroyed` | persistence-api | game-server | `ParticleDestroyedEvent` |
| `game:swing_results` | persistence-api | game-server | `swing_result` JSON al atacante |
| `world:block_seeded` | persistence-api | terrain-service | `BlockSeeded` |

**Consumer groups:** un group por servicio réplica (ej. `terrain-workers`, `game-{instance_id}`).

**Trim:** `MAXLEN ~ 10000` por stream (configurable).

---

## Cache keys (terrain)

| Key pattern | Valor | TTL |
|-------------|-------|-----|
| `chunk:wire:{bloque}:{cx},{cy}` | JSON `terrain_chunk` | 3600s |
| `chunk:solid:{bloque}:{cx},{cy}` | celdas sólidas compactas | 3600s |
| `chunk:ver:{bloque}:{cx},{cy}` | int version | — |
| `chunk:pending:{bloque}:{cx},{cy}` | dedupe flag | corto |
| `block:ver:{bloque}` | version global bloque | — |

### BlockSeeded

Invalidar `chunk:wire:{bloque}:*`, `chunk:solid:{bloque}:*`, bump `block:ver:{bloque}`.  
Bloque nuevo: sin keys previas.

Ver [10-worldgen-seeds.md](./10-worldgen-seeds.md).

### CellDestroyed

Bump `chunk:ver`, delete wire/solid del chunk XY, `ChunkAuthority.apply_destroyed`.

---

## Rate limit (persistence)

| Key | Uso |
|-----|-----|
| `ratelimit:destroy:{bloque_id}` | 50/s destrucciones globales |

---

## Registry (ecos)

| Key | Valor |
|-----|-------|
| `registry:eco:{bloque}:{eco_id}` | HASH players, max, type, game_host |
| `registry:player:{player_id}` | eco_key |
| `registry:game:{instance_id}` | heartbeat game-server |

Ver [02-ecos-dimensions.md](./02-ecos-dimensions.md).

---

## Go helpers

`go/pkg/jd/rediskeys/` — builders centralizados. Ver [shared/go-pkg-jd.md](./shared/go-pkg-jd.md).

---

## Prohibido

- Payload terrain wire en Redis para sim (game usa SolidGrid subset)
- Bloquear tick esperando XREAD
