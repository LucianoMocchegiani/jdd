# Datos de juego compartidos (cliente + servidor)

**Fuente de verdad** para fichas, condiciones, medio, partículas y tuning de movimiento.

## Estructura (espejo de `frontend-v2/src/game-data/`)

```
game-data/
├── actions/           body-actions, constant-displacements (+ impulse)
├── conditions/        elemental, status-effects, environment-triggers
├── medium/            rules + lista de medios
├── particles/         registry (overrides + physics defaults)
├── movement/          constants.json, profiles.json
├── appearance/        duraciones de clips (latch one_shot)
├── input/             intents registrados
└── game/              session (radios viewport, gravedad, etc.)
```

## Backend

- Loaders + `registry` + `validate` por dominio en `backend/src/game_data/`
- `bootstrap.initialize_registries(strict=True)` en arranque (falla si JSON inválido)
- Simulación ECS: `backend/src/ecs/domains/{action,contact,condition,movement}/`
- Realtime (WS, loop 30 Hz): `backend/src/game/`

## Frontend

- `game-data/*/*.ts` importan JSON vía alias `@shared/...`
- `registry.ts` y `validate.ts` siguen en TS (índices en memoria + integridad referencial)

## Docker

`GAME_DATA_DIR=/shared/game-data` y volumen `./shared:/shared`

## Combate

`attack` vive en `actions/body-actions.json` (`impact.worldDamage`).  
`combat-catalog.json` queda legado; el servidor usa el action registry unificado.
