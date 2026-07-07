---
id: IF-1
title: Docker Compose
status: cerrado
version: 1
depends_on: ["01", "07"]
---

# Docker Compose

**Usar cuando:** deploy local, servicios, puertos, scale game-server.

---

## Servicios objetivo

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  persistence-api:
    build: ./go/cmd/persistence-api
    ports: ["8000:8000"]
    depends_on: [postgres, redis]

  terrain-service:
    build: ./rust/terrain-service
    ports: ["8002:8002"]  # internal only in prod
    depends_on: [postgres, redis]

  game-server:
    build: ./go/cmd/game-server
    ports: ["8001:8001"]
    depends_on: [redis, terrain-service]
    deploy:
      replicas: 1  # scale N en prod

  registry:
    build: ./go/cmd/registry
    ports: ["8003:8003"]
    depends_on: [redis]

  gateway-ws:
    build: ./go/cmd/gateway-ws
    ports: ["8082:8082"]
    depends_on: [registry]

  frontend-v2:
    # proxy API → 8000, WS → 8082 o 8001 dev
```

---

## Dev mínimo M1

Solo: `postgres`, `redis`, `terrain-service`

---

## Dev M2

Añadir: `game-server` — cliente WS directo :8001

---

## Prod M5

Añadir: `registry`, `gateway-ws` — cliente solo :8082

**Archivo listo:** `docker-compose.greenfield.yml` en la raíz del repo.

```bash
docker compose -f docker-compose.greenfield.yml up --build
```

Servicios: postgres, redis, persistence-api, terrain-service, registry, game-server, gateway-ws.

---

## Networks

- `internal`: terrain, game, persistence, registry
- `public`: gateway, frontend

Terrain **no** expuesto públicamente en prod.
