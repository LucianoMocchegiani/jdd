# M0 — pkg/jd

Shared Go libraries for Juego de Dioses microservices.

## Modules

- `session` — load `shared/game-data/game/session.json`
- `chunkcoords` — chunk tile math (golden parity with Rust/Python)
- `cellkey` — `"x,y,z"` format
- `rediskeys` — stream names and cache key builders

## Test

From repo root `juego-de-dioses/`:

```bash
cd go/pkg/jd
go test ./...
```

## Proto

Generate Go from `shared/proto/` (requires buf or protoc):

```bash
cd shared/proto
buf generate
```

See `instructions/ai/shared/proto-generation.md`.
