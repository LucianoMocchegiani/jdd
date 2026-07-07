---
id: "10-WG"
title: Worldgen y seeds in-game
status: cerrado
version: 1
depends_on: ["00", "03", "04"]
---

# Worldgen y seeds

Creación y expansión de **bloques** in-game (jugadores / dioses). **Rewrite Go** en persistence-api.

**Usar cuando:** crear bloque, expandir mundo, seeds, invalidar cache post-seed, `BlockSeeded`.

**Implementación código:** [services/persistence-api/03-implementation.md](./services/persistence-api/03-implementation.md) (carpeta `worldgen/`).

---

## Reglas cerradas

| Regla | Valor |
|-------|-------|
| Runtime | persistence-api (Go) — **no** game-server, **no** terrain workers inline |
| In-game | Sí — dioses/jugadores pueden disparar creación (API/evento interno) |
| Lenguaje | Go greenfield (no port Python a largo plazo) |
| Post-seed | Evento **`BlockSeeded`** → terrain-service |

---

## Evento `BlockSeeded`

```protobuf
message BlockSeeded {
  string bloque_id = 1;
  bool is_new_block = 2;           // true = bloque recién creado
  optional Region region = 3;      // v2: seed parcial XY; v1 omitir = bloque entero
  uint64 block_version = 4;        // monotonic per bloque
}
```

Stream sugerido: `world:block_seeded`

**Consumidor:** terrain-service

| Caso | Acción |
|------|--------|
| `is_new_block=true` | No hay cache; opcional warm-up chunks spawn |
| Re-seed / expansión v1 | **Invalidar cache completo** del `bloque_id` (wire + solid + pending) |
| Re-seed parcial v2 | Invalidar solo chunks en `region` |

Decisión v1: ante duda, **invalidación bloque completo** (simple, correcto).

---

## Flujo in-game (ejemplo)

```text
1. Cliente / dios → persistence-api: POST crear o expandir bloque
2. worldgen (Go): INSERT particulas en transacciones por lote
3. COMMIT
4. XADD world:block_seeded
5. terrain-service: invalida cache + bump block_version
6. Jugadores online: próximo ChunkRequest trae wire fresco
```

**No** requiere restart de terrain-service.

---

## DB

- INSERT masivo particionado por `bloque_id`
- Ver [03-database-postgres.md](./03-database-postgres.md) — batch size, índices
- Seeds largos: job async + progreso WS opcional (fuera tick sim)

---

## Referencia Python

| Go (nuevo) | Python (ref) |
|------------|--------------|
| `worldgen/` | `backend/src/world_creation_engine/` |
| seeds scripts | `backend/src/database/seed_*.py` |

---

## Ideas de diseño (producto)

Enlazar reglas narrativas de creación de mundos desde Ideas/ cuando existan; no duplicar lore aquí.

---

## Prohibido

- Seed síncrono en path de join o tick
- game-server escribiendo partículas masivas directo a Postgres
- Asumir cache válido tras seed sin procesar `BlockSeeded`
