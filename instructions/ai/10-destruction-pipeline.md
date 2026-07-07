---
id: "10"
title: Pipeline de destrucción (jugador + NPC)
status: cerrado
version: 1
depends_on: ["00", "03", "04"]
---

# Pipeline de destrucción

Flujo **único** para jugadores y NPCs. Mismas reglas de integridad y DELETE.

**Usar cuando:** swing, daño a partículas, NPC rompe terreno, rate limit, `particle_destroyed`, invalidación terrain.

**Sim (game-server):** ver presupuesto NPC en [services/game-server/01-overview.md](./services/game-server/01-overview.md).

---

## Reglas cerradas

| Regla | Valor |
|-------|-------|
| Daño / integridad / transiciones | Igual jugador y NPC |
| NPC destruye | **Siempre** simulado (todos los ecos), por ahora |
| Rate limit | **50 destrucciones/s por `bloque_id`** — suma jugadores + NPCs |
| Persistencia | **Nunca** en tick 30 Hz |

---

## Flujo

```text
1. game-server: swing (jugador) o acción NPC → encola SwingCommand / NpcSwingCommand
2. Redis swing:commands
3. persistence-api: apply_particle_damage (Go, ref: apply_swing.py)
4. Postgres: UPDATE integridad | DELETE celda
5. Redis: terrain:invalidate (CellDestroyed) + game:destroyed (ParticleDestroyed)
6. terrain-service: bump cache chunk, ChunkAuthority.apply_destroyed
7. game-server: SolidGridCache.remove_cell + WS particle_destroyed
8. cliente: predict local + confirm server
```

---

## Rate limiter (persistence-api)

- Clave: `ratelimit:destroy:{bloque_id}`
- Ventana: 1 s sliding o token bucket 50/s
- Si excede: encolar para siguiente ventana o rechazar con métrica (no bloquear sim)

---

## Eventos Redis

| Stream | Payload |
|--------|---------|
| `swing:commands` | `SwingCommand` (entity_id, npc flag opcional) |
| `terrain:invalidate` | `CellDestroyed` |
| `game:destroyed` | `ParticleDestroyedEvent` |

---

## Referencia Python

| Go (nuevo) | Python (ref) |
|------------|--------------|
| swing consumer | `impact_handler.py`, `apply_swing.py` |
| damage | `apply_particle_damage.py` |
| MAX hits/swing | 64 (`MAX_WORLD_HITS_PER_SWING`) |

---

## Prohibido

- `apply_swing` await en game-server tick
- Merge `TerrainStore` en game-server
- Rate limit **solo por eco** (debe ser por bloque)
