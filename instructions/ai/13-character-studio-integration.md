---
id: 13-character-studio-integration
title: Character Studio → juego online + combate por contacto
status: borrador
version: 1
date: 2026-05-28
---

# Character Studio → juego online + combate por contacto

Guía de retoma: cómo pasar del POC (`?poc=character-studio`) al juego principal, qué implica el modo online, y cómo implementar daño por contacto del puño.

**Fuentes de verdad actuales del rig:**

| Asset | Ruta |
|-------|------|
| Modelo biped | `frontend/src/poc/biped.json` |    
| Clips | `frontend/src/poc/walk.md`, `attack.md`, `jump.md`, `swim.md`, `fly.md` |
| POC | `frontend/src/poc/character-studio/` |

**No tocar el biped sin pedirlo explícitamente** — está tuneado a mano en el editor; la simetría en datos no coincide con la simetría visual.

---

## 1. Dónde estamos hoy

| Capa | Estado |
|------|--------|
| **Character Studio (POC)** | Rig v2 + clips exportables. FK, renderer instanciado, timeline, export JSON. |
| **Juego principal** | Personaje = **cubo** coloreado según acción activa (`AppearanceSystem`). |
| **Online** | Movimiento sync servidor ↔ cliente OK. **Animación no se sincroniza.** |
| **Ataque actual** | Daña **partículas del terreno** en un radio desde el **centro del jugador**, no por contacto del puño. |

El POC y el juego **no están conectados**.

### Arquitectura actual (resumen)

```
Cliente TS (frontend)          game-server Go (8001)         persistence-api Go (8000)
     │                                │                              │
     ├─ ECS local (predicción)        ├─ tick 30 Hz                  ├─ apply_swing (async)
     ├─ WS: join/input/swing ────────►├─ sesiones por bloque/eco      ├─ daño a partículas Postgres
     └─ REST: bloques/health          └─ Redis: swing:commands ──────►└─ Redis: particle_destroyed
```

Docs relacionados: [01-architecture-overview.md](./01-architecture-overview.md), [10-destruction-pipeline.md](./10-destruction-pipeline.md).

### Archivos clave (juego)

| Qué | Ruta |
|-----|------|
| Mesh placeholder (cubo) | `frontend/src/game/player/player-body-visual.ts` |
| Spawn local | `frontend/src/game/player/spawn-player.ts` |
| Réplicas remotas | `frontend/src/game/client-prediction/remote-presence.ts` |
| Apariencia (tinta por clip) | `frontend/src/ecs/domains/appearance/appearance-system.ts` |
| Catálogo duración clips | `shared/game-data/appearance/catalog.json` |
| Acciones (attack, walk…) | `shared/game-data/actions/body-actions.json` |
| Daño al terreno | `frontend/src/ecs/domains/impact/world-damage-system.ts` |
| WS contratos | `frontend/src/types/world-events.ts` |
| Input ~30 Hz | `frontend/src/game/network/input-sender.ts` |

### Archivos clave (POC)

| Qué | Ruta |
|-----|------|
| Bootstrap POC | `frontend/src/poc/character-studio/bootstrap.ts` |
| Tipos documento v2 | `frontend/src/poc/character-studio/types.ts` |
| FK + pose | `frontend/src/poc/character-studio/rig-math.ts` |
| Sampling clips | `frontend/src/poc/character-studio/studio-clip.ts` → `sampleClip()` |
| Renderer | `frontend/src/poc/character-studio/studio-renderer.ts` |
| Export bundle | `frontend/src/poc/character-studio/studio-export.ts` |

### Formato export JDD v2

```json
{ "type": "character-model", "model": { "version": 2, "bones": [...], "elements": [...] } }
{ "type": "character-clip", "clip": { "version": 2, "id": "attack", "tracks": [...] } }
```

Los clips usan **rotación Euler absoluta por hueso** (`tracks[].keys[].rot`).

---

## 2. Fase 1 — Modelo y animaciones en el juego (solo local)

**Objetivo:** dejar de ver el cubo; ver el biped animado al caminar/atacar/saltar.

### Pasos

1. **Exportar** desde Character Studio (Avanzado → bundle JDD):
   - `bipedo-blocky.json` (modelo)
   - Un `.json` por clip: `walk`, `attack`, `jump`, `swim`, `fly`, `idle`…

2. **Cargar** esos JSON en el runtime del juego (reutilizar `rig-math`, `sampleClip`, `StudioRenderer` — mover o importar desde `poc/` a `game/player/`).

3. **Reemplazar** el cubo en `spawn-player.ts` por el renderer del rig.

4. **Conectar** al sistema de acciones existente:
   - `ActionOrchestratorSystem` ya activa `body_actions` con `appearance.clip`.
   - Cuando `clip === "attack"`, muestrear `attack.json` en lugar de tintar el cubo.

5. **Alinear duraciones:**
   - Hoy `appearance/catalog.json` puede decir 400 ms para `attack`.
   - El clip en `attack.md` tiene ~550 ms.
   - Unificar: o actualizar el catálogo, o acortar el clip en el editor.

### Resultado

Vos ves tu personaje animado en single-player. Otros jugadores siguen viendo cubos.

---

## 3. Fase 2 — Animación visible para otros (online visual)

**Objetivo:** remotos no son cubos que se deslizan; reproducen la misma animación.

### ¿Hace falta un modelo en el servidor?

**No para empezar.** El servidor no renderiza Three.js. Solo necesita saber **qué acción** y **cuándo empezó**.

| Asset | Dónde vive |
|-------|------------|
| Geometría + rig + clips (JSON) | Cliente (bundle estático o CDN) |
| Estado de animación (`action_id`, `t0`) | game-server (memoria por sesión) |
| HP / daño | game-server (autoritativo) |
| Terreno dañado | persistence-api + Postgres (como hoy) |

Todos los clientes cargan el mismo `bipedo-blocky.json`. No va a Postgres ni al game-server como mesh.

### Flujo deseado

```
Jugador ataca (t=0)
  → Cliente: reproduce attack localmente (predicción)
  → Cliente envía al servidor: action_id="attack", action_started_at=...
  → Servidor guarda en Player y reenvía en player_state
  → Otros clientes: samplean el mismo clip desde el mismo t0
```

### Brechas actuales

1. **`attack_light` no se envía al servidor** — `input-sender.ts` solo empaqueta locomoción.
2. **Sim servidor** no resuelve `body_actions` ni escribe `Player.ActionID` en el tick.
3. **`player_state`** tiene campo `action_id` opcional pero el servidor no lo popula.
4. **Remotos** solo interpolan posición + yaw.

### Tareas concretas

- Extender mensaje `input` o `swing` con `action_id` + timestamp de inicio.
- Poblar `action_id` en `player_state` desde `run_tick.go`.
- En `remote-presence.ts`: además de pos/yaw, aplicar `sampleClip(clip, now - t0)`.
- Unificar IDs de clip entre POC, `body-actions.json` y `appearance/catalog.json`.

---

## 4. Fase 3 — Daño por contacto del puño

Objetivo del diseño: el daño sale del **contacto físico del puño** con el objetivo, no de un radio desde el centro del jugador.

### Cómo funciona el combate hoy

```
Input (attack_light / F / Mouse0)
  → ActionOrchestratorSystem (latch body_actions, durationMs)
  → WorldDamageSystem
       → WS swing { position, yaw, action_id, seq }
  → game-server → Redis swing:commands
  → persistence-api ApplySwing
       → GetParticlesNear(pos, reach)   ← radio esférico, NO hitbox de puño
       → ApplyParticleDamage
  → Redis particle_destroyed → cliente
```

- Alcance: `reach` celdas desde **posición del jugador** (root).
- Definido en `body-actions.json` → `impact.worldDamage`.
- **No hay** hitboxes, hurtboxes, HP de jugador, ni PvP.

### A) Hitbox del puño

En el **frame de impacto** del clip `attack` (ej. t ≈ 0.28 s):

1. `sampleClip(attack, t, bones)` → pose FK.
2. Posición mundo de `mano-derecha` o hueso `muneca-derecha`.
3. Radio de la esfera = hitbox de ataque.

Metadata sugerida en game-data:

```json
{
  "attack": {
    "impactFrame": 0.28,
    "hitboxBone": "mano-derecha",
    "hitRadius": 0.2
  }
}
```

(O en el modelo: flag `combatHitbox` por elemento — decisión pendiente.)

### B) Hurtbox del cuerpo (objetivo)

Cajas simplificadas por jugador: torso, cabeza, (opcional) extremidades. 2–3 AABB alcanzan para MVP.

Definir en `shared/game-data` offsets + tamaños relativos al root del personaje, o derivados de elementos `flesh` del rig.

### C) Cliente vs servidor

| Enfoque | Cliente | Servidor |
|---------|---------|----------|
| **MVP (rápido)** | Detecta overlap puño ↔ hurtbox; envía `hit { target, seq }` | Valida distancia, estado attack, ventana temporal; aplica daño |
| **Anti-cheat (después)** | Igual | Recalcula pose del puño desde `action_id` + `t0` con los mismos datos de rig |

Validación mínima servidor:

- Solo aceptar hits durante ventana de impacto del clip.
- Distancia máxima atacante–objetivo.
- Rate limit (1 hit por swing).
- Reutilizar `seq` de swing para deduplicar.

### D) Daño a jugadores vs terreno

| Target | Hoy | Falta |
|--------|-----|-------|
| Partículas terreno | `ApplySwing` + Postgres | Puede seguir igual o migrar a hitbox más adelante |
| Otro jugador | No existe | HP en game-server, evento `player_damaged` |

Nuevo en `world-events.ts` (propuesta): `player_damaged`, `player_died`.

Separar conceptualmente:

- `swing` → terreno (async, persistence)
- `hit` → entidades jugador (sync, game-server in-memory)

### E) Convención espacial del rig

Documento v2 declara `Vec3 = [dx, dz, dy]` → Three `[x, y, z]`, pero `rig-math.ts` hoy mapea `[v0, v1, v2]` directo. **Usar los mismos valores que el POC** al portar; no “corregir” sin probar en runtime.

---

## 5. Roadmap ordenado

Cada fase es entregable sin romper la anterior.

```
Fase 1 — Biped en juego local
  └─ Loader model + clips, reemplazar cubo, conectar body_actions

Fase 2 — Online visual
  └─ action_id + t0 en player_state, remotos samplean clips

Fase 3 — Metadata combate
  └─ impactFrame, hitboxBone, hurtboxes en game-data

Fase 4 — Contacto cliente
  └─ overlap puño ↔ hurtbox en frame de impacto → evento hit

Fase 5 — Daño autoritativo
  └─ HP jugador en game-server, validación, player_damaged

Fase 6 — (Opcional) Servidor recalcula pose
  └─ Anti-cheat, rig data-only en Go
```

---

## 6. Ataque con daño por puño — checklist cuando retomes

1. **Animación:** pulir `attack.md` en Character Studio; anotar frame de contacto exacto (ej. t = 0.28 s).
2. **Game-data:** `impactFrame`, `hitboxBone: "mano-derecha"`, `hitRadius`, duración alineada con `appearance/catalog.json`.
3. **Cliente:** en ese frame, si overlap con hurtbox enemiga → enviar `hit`.
4. **Servidor:** validar y restar HP; broadcast a clientes.
5. **Terreno:** decidir si el puñetazo también rompe partículas por contacto del puño o mantiene el radio actual en paralelo.

---

## 7. Desalineaciones conocidas

| Tema | POC / editor | Juego |
|------|--------------|-------|
| IDs de clip | `idle`, `walk`, `attack`… | Mismos nombres en JSON, sin reproducción |
| Duración attack | ~0.55 s (`attack.md`) | 400 ms en `appearance/catalog.json` |
| Huesos muñeca/tobillo | roles `wrist` / `ankle` en biped | — |
| Remotos | — | Solo pos + yaw |
| Input ataque | — | No llega al servidor |

---

## 8. Qué NO hacer

- No espejar pivotes/pos del biped automáticamente — está tuneado a mano.
- No asumir que el servidor necesita el mesh Three.js.
- No mezclar daño a terreno (async Postgres) con PvP (sync in-memory) en el mismo pipeline sin diseñar contratos distintos.
- No confiar solo en el cliente para hits en producción (MVP ok, Fase 6 para endurecer).

---

## 9. Mapa rápido por tarea

| Quiero… | Leer / tocar |
|---------|--------------|
| Ver biped en juego | Fase 1, `spawn-player.ts`, portar `rig-math` + `StudioRenderer` |
| Otros vean mi animación | Fase 2, `input-sender.ts`, `run_tick.go`, `remote-presence.ts` |
| Puño hace daño | Fase 3–5, `body-actions.json`, nuevo dominio `combat/` |
| Romper suelo | [10-destruction-pipeline.md](./10-destruction-pipeline.md) (ya existe) |
| Editar animaciones | `?poc=character-studio`, export `.md` / JSON |
| Editar rig | `biped.json` — fuente de verdad |

---

## 10. Referencias cruzadas

- [07-implementation-roadmap.md](./07-implementation-roadmap.md) — sprints M0–M6
- [09-frontend-v2.md](./09-frontend-v2.md) — ECS cliente (pendiente, útil para Fase 1–2)
- [06-ws-client-json.md](./06-ws-client-json.md) — wire protocol (pendiente)
- [shared/game-data-session.md](./shared/game-data-session.md) — config compartida

---

*Última actualización: conversación Character Studio + plan integración online/combate, mayo 2026.*
