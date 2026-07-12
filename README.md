# JDD — Juego de Dioses

Stack **Go + Rust + TypeScript** (microservicios + cliente Three.js).

Repositorio independiente del monolito legacy [`juego-de-dioses`](https://github.com/LucianoMocchegiani/juego-de-dioses).

## Levantar

```powershell
cd jdd
docker compose up --build
```

| Servicio | URL |
|----------|-----|
| **Juego** | http://localhost:8080 |
| API REST | http://localhost:8000/api/bloques |
| WebSocket (vía nginx) | `ws://localhost:8080/ws` |

Mapa por defecto: **Mundo Inicial** (seed SQL en `database/init/04-seed-greenfield-terrain.sql`).

## Desarrollo local del frontend

```powershell
cd frontend
npm install
npm run dev
```

Proxy dev: `/api`, `/health` → `:8000`; `/ws` → `:8001`.

## Estructura

```text
jdd/
├── docs/              # Documentación general (arquitectura, flujos)
├── frontend/          # Cliente TS (Three.js + ECS)
├── go/cmd/            # game-server, persistence-api, registry, gateway-ws
├── rust/terrain-service/
├── shared/game-data/  # session.json, acciones, combate…
├── database/init/     # Schema + seeds Postgres
└── instructions/ai/   # Docs de arquitectura (detalle para implementación)
```

**Documentación:** [docs/README.md](docs/README.md) — organización, servicios y diagramas de flujo.  
**Character Studio (POC):** `?poc=character-studio` — editor de personajes en `frontend/src/poc/character-studio/`

## Base de datos

Init SQL en `database/init/` (solo corre en volumen Postgres **nuevo**).

Reset completo:

```powershell
docker compose down -v
docker compose up --build
```

Invalidar caché de terreno en Redis tras cambios de partículas:

```powershell
docker exec jdd-redis redis-cli EVAL "local k=redis.call('keys','chunk:*'); for i=1,#k do redis.call('del',k[i]) end return #k" 0
```

## Mapas

| Mapa | Cómo cargarlo |
|------|----------------|
| **Mundo Inicial** (default) | Init SQL automático al crear volumen Postgres |
| **Lago y Montaña** | `.\scripts\seed-lago.ps1` o `docker compose --profile tools run --rm seed-lago` → `?bloque=lago` |

## Pendiente

- Worldgen in-game vía API (`POST` crear bloque) — el motor vive en `go/pkg/jd/worldgen`
