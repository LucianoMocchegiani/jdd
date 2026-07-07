---
id: GLOSSARY
title: Glosario ES / EN
status: cerrado
version: 1
---

# Glosario

Términos usados en toda la documentación IA. En código y Protobuf preferir **inglés**; en docs y UI **español** donde aplique.

| Español | English (código) | Definición |
|---------|------------------|------------|
| **Bloque** | `bloque_id` | Mundo persistente en Postgres (partículas, topología). Puede ser enorme. |
| **Eco** | `eco_id` / shard | Dimensión paralela del mismo bloque. Instancia game-server, máx ~50 jugadores. |
| **Dimensión de Guerra** | `eco type=war` | Eco especial para clanes en conflicto (v3). |
| **Sim / simulación** | sim | Tick ~30 Hz: movimiento, input, colisión, NPCs activos. Solo game-server. |
| **Terreno** | terrain | Partículas, chunks, wire JSON. terrain-service (Rust). |
| **Shard (técnico)** | shard | Sinónimo de **eco** en infra/registry. |
| **Sync eco** | `sync_eco` | Cambiar de dimensión: disconnect + join a otro eco (v2). |
| **SolidGrid** | `SolidGridCache` | Subset de celdas sólidas en game-server para colisión O(1). |
| **Destrucción** | destruction | UPDATE integridad / DELETE celda. Siempre async vía persistence-api. |
| **Rate limit bloque** | `block_destroy_rate` | Máx destrucciones/s por `bloque_id` (jugadores + NPCs). |
| **Seed / worldgen** | seed / worldgen | Creación o expansión de bloque in-game (dioses/jugadores). Go, persistence-api. |
| **BlockSeeded** | `BlockSeeded` | Evento Redis: bloque nuevo o re-seed → terrain invalida cache. |

**Diseño de producto (Ecos):** [25-Dimensiones-Dinamicas-Mecanica.md](../../../Juego%20de%20Dioses/Ideas/ingenieria/25-Dimensiones-Dinamicas-Mecanica.md)
