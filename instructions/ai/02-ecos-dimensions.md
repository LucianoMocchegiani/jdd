---
id: "02"
title: Ecos y dimensiones paralelas
status: cerrado
version: 1
depends_on: ["00", "GLOSSARY"]
---

# Ecos (dimensiones paralelas)

**Usar cuando:** registry, >50 jugadores mismo mapa, sync party, dimensión de guerra, asignación de shard.

**Diseño narrativo:** [25-Dimensiones-Dinamicas-Mecanica.md](../../../Juego%20de%20Dioses/Ideas/ingenieria/25-Dimensiones-Dinamicas-Mecanica.md)

---

## Tres conceptos

| Término | Código | Qué es |
|---------|--------|--------|
| **Bloque** | `bloque_id` | Mundo persistente Postgres (puede ser enorme) |
| **Eco** | `eco_id` | Dimensión paralela = shard = game-server (máx 50 jugadores) |
| **Zona visible** | radio ~48 celdas | Disco alrededor del jugador (chunks + presencia local) |

```text
bloque_id "Bosque Sombrío"
  ├── Eco 1  (game-server A, 47 jugadores)
  ├── Eco 2  (game-server B, 50 jugadores)
  └── Eco Guerra #1  (type=war, v3)
```

---

## Reglas v1

| Regla | Detalle |
|-------|---------|
| Cupo | **50 jugadores/eco** |
| Entrada | `join_block(bloque_id)` → registry elige eco con cupo o crea `eco_id++` |
| Sim | Aislada por eco — no hay combate cross-eco en tiempo real |
| DB | **Compartida** — todos los ecos del mismo bloque escriben al mismo `bloque_id` |
| Terreno cache | Compartida vía terrain-service (Redis por chunk) |

---

## Interacción cross-eco

**No hay sim compartida.** Reunirse = **sync eco** (v2):

```text
Cliente → POST /sync-eco { party_id | eco_id destino }
  → registry: ws_url del eco destino
  → disconnect WS actual
  → join_block mismo bloque_id, nuevo eco
```

HUD / portales / cristales — mismo flujo.

---

## Asignación (v2)

Prioridad ([doc diseño](../../../Juego%20de%20Dioses/Ideas/ingenieria/25-Dimensiones-Dinamicas-Mecanica.md)):

1. Party completa → mismo eco
2. Clan
3. Alianza
4. Solo → eco menos lleno

---

## Dimensión de Guerra (v3)

Clanes hostiles → eco `type=war`:

- Registry crea/habilita eco dedicado
- Solo miembros involucrados
- Narrativa: colapso de ecos en un plano de batalla

---

## Redis registry (modelo)

```text
registry:eco:{bloque_id}:{eco_id}  → players, max=50, type, game_instance_id
registry:player:{player_id}          → eco_key (TTL)
registry:party:{party_id}            → eco_key (v2)
```

Ver [services/registry/02-contracts.md](./services/registry/02-contracts.md) (pendiente implementación).

---

## WS: join_ok (v2)

```json
{
  "type": "join_ok",
  "bloque_id": "...",
  "eco_id": 2,
  "eco_label": "Bosque Sombrío — Eco 2",
  "player_id": "...",
  "players": []
}
```

---

## Escenarios de escala

| Escenario | Estrategia |
|-----------|------------|
| 1000 jugadores, varios bloques | ~50/eco, DB repartida por bloque |
| 1000 en **un** bloque | ~20 ecos + **rate limit writes** por bloque_id |
| Guerra masiva | Eco war dedicado |

**Ecos no shardean DB** — ver [03-database-postgres.md](./03-database-postgres.md).
