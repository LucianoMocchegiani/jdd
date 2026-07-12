# Frontend — JDD

Cliente **TypeScript** (Vite + Three.js + ECS). Predicción local + reconciliación con el servidor.

## Docker

Desde la raíz de `jdd`:

```bash
docker compose up --build
```

→ http://localhost:8080

## Desarrollo local

```bash
npm install
npm run dev
```

→ http://localhost:5173 (proxy a backend en Docker)

## Debug URL

| Flag | Efecto |
|------|--------|
| `?poc=character-studio` | Editor + animador de personajes (huesos + elementos v2) |
| `?debug=pos-sync` | HUD local vs servidor |
| `?debug=reconcile-off` | Sin reconciliación |
| `?bloque=` | Filtra bloque por nombre |

## Docs

Arquitectura: `../instructions/ai/INDEX.md`
