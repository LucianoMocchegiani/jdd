---
id: IF-2
title: Variables de entorno y puertos
status: cerrado
version: 1
depends_on: ["01"]
---

# Env y puertos

**Usar cuando:** configurar servicios, .env, docker-compose.

---

## Puertos

| Servicio | Puerto | Público |
|----------|--------|---------|
| persistence-api | 8000 | Sí (REST) |
| game-server | 8001 | Dev WS; prod vía gateway |
| terrain-service | 8002 | No (internal) |
| registry | 8003 | No |
| gateway-ws | 8082 | Sí (WSS) |
| postgres | 5432 | No |
| redis | 6379 | No |
| frontend-v2 | 5173 | Dev |

---

## game-server

```env
HTTP_PORT=8001
REDIS_URL=redis://redis:6379
TERRAIN_SERVICE_URL=http://terrain-service:8002
REGISTRY_URL=http://registry:8003
GAME_INSTANCE_ID=game-1
ENV=dev
JWT_SECRET=dev-secret
```

---

## terrain-service

```env
HTTP_PORT=8002
DATABASE_URL=postgres://user:pass@postgres:5432/juego
REDIS_URL=redis://redis:6379
WORKER_COUNT=8
CHUNK_RATE_LIMIT=10
RUST_LOG=info
```

---

## persistence-api

```env
HTTP_PORT=8000
DATABASE_URL=postgres://...
REDIS_URL=redis://redis:6379
MAX_DESTROY_PER_BLOCK_PER_SEC=50
```

---

## registry

```env
HTTP_PORT=8003
REDIS_URL=redis://redis:6379
MAX_PLAYERS_PER_ECO=50
```

---

## gateway-ws

```env
HTTP_PORT=8082
REGISTRY_URL=http://registry:8003
JWT_SECRET=...
ENV=dev
```

---

## frontend-v2

```env
VITE_API_BASE=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8001/ws    # dev direct
# VITE_WS_URL=ws://localhost:8082/ws  # prod gateway
```

---

## Session path (todos los servicios)

`SESSION_JSON_PATH=../shared/game-data/game/session.json` o mount Docker volume.
