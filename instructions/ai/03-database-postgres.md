---
id: "03"
title: Postgres — schema, writes, sharding
status: cerrado
version: 1
depends_on: ["00", "10-D", "10-WG"]
---

# Postgres — schema, escrituras, sharding

**Usar cuando:** queries partículas, migrations, rate limit writes, partition por bloque, escalado DB.

**Schema actual:** `database/init/01-init-schema.sql`

---

## Tabla crítica: `particulas`

```sql
UNIQUE(bloque_id, celda_x, celda_y, celda_z)
```

Índices clave:

- `idx_particulas_bloque`
- `idx_particulas_posicion (bloque_id, celda_x, celda_y, celda_z)`
- `idx_particulas_z (bloque_id, celda_z)`

**Regla:** toda query lleva **`bloque_id`**. Prohibido scan global en runtime.

---

## Quién lee / escribe

| Operación | Servicio | Cuándo |
|-----------|----------|--------|
| SELECT chunk XY+Z | terrain-service (Rust) | ChunkRequest |
| SELECT tipos viewport | terrain-service | join / terrain_types |
| UPDATE integridad | persistence-api | swing |
| DELETE celda | persistence-api | destrucción |
| INSERT masivo | persistence-api (worldgen) | seed in-game |
| REST CRUD | persistence-api | admin, editor |

**game-server:** **nunca** Postgres en tick.

---

## Escrituras y ecos

Varios ecos del mismo `bloque_id` → **mismas filas** → writes se **suman**.

| Carga | Orden de magnitud |
|-------|-------------------|
| 50 jugadores/eco, 1 eco | ~50–200 writes/s |
| 20 ecos, mismo bloque, activos | ~500–2500 writes/s pico |

**Mitigación obligatoria:**

- Rate limit **50 destrucciones/s por `bloque_id`** ([10-destruction-pipeline.md](./10-destruction-pipeline.md))
- Cola + batch en persistence-api
- NPCs cuentan al mismo límite

---

## Camino de sharding (por `bloque_id`)

| Nivel | Qué | Migración |
|-------|-----|-----------|
| **1** | Partition LIST/HASH `bloque_id` en una DB | Baja — greenfield recomendado |
| **2** | Bloque hot → Postgres dedicado (config URL por bloque) | Media — routing en persistence + terrain |
| **3** | Citus / cluster shard key = `bloque_id` | Media-alta |

**Ecos ≠ sharding DB.** Particionar sim no reduce writes al mismo bloque.

### Greenfield día 1

- Diseñar repos con `bloque_id` obligatorio
- Pool por bloque configurable (env `DATABASE_URL_{bloque}` futuro)
- Opcional: `PARTITION BY LIST (bloque_id)` al crear tabla en migración greenfield

---

## Destrucción (write path)

```text
SwingCommand → persistence-api
  → SELECT particle + dureza (por id)
  → UPDATE integridad | DELETE
  → publish Redis invalidate
```

Ref Python: `apply_particle_damage.py`, `apply_swing.py`  
Max hits/swing: **64**

---

## Worldgen (write path)

```text
worldgen Go → INSERT batches por bloque_id
  → COMMIT
  → BlockSeeded event
```

Ver [10-worldgen-seeds.md](./10-worldgen-seeds.md). Seeds **no** en tick ni join.

---

## Lecturas terrain (read path)

Por chunk (tile 40×40 XY, rango Z de session.json):

```sql
-- Pseudocódigo — ref terrain_store.py
SELECT ... FROM particulas
WHERE bloque_id = $1
  AND celda_x BETWEEN $xmin AND $xmax
  AND celda_y BETWEEN $ymin AND $ymax
  AND celda_z BETWEEN $zmin AND $zmax
```

Cache Redis después del merge — ver terrain-service.

---

## session.json (Z y chunks)

| Campo | Valor actual | Uso |
|-------|--------------|-----|
| `terrainZMin` | -10 | SELECT Z |
| `terrainZMax` | 32 | SELECT Z |
| `chunkSizeCells` | 40 | tile XY |

Ver [shared/game-data-session.md](./shared/game-data-session.md).

---

## Prohibido

- game-server query Postgres en loop 30 Hz
- Transacciones cross-`bloque_id`
- Rate limit destrucción solo por eco (debe ser por bloque)
