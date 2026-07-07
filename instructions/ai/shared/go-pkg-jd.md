---
id: SH-2
title: go/pkg/jd — librería compartida Go
status: cerrado
version: 1
depends_on: ["05", "SH-1"]
---

# go/pkg/jd

**Usar cuando:** implementar M0, chunkcoords, redis keys, session en servicios Go.

---

## Layout

```text
go/
├── go.work
└── pkg/jd/
    ├── session/
    │   └── session.go       # Load() desde shared/game-data
    ├── chunkcoords/
    │   ├── chunkcoords.go
    │   └── golden_test.go
    ├── cellkey/
    │   └── cellkey.go
    ├── rediskeys/
    │   └── keys.go
    └── contracts/
        └── ...              # go generate from proto
```

---

## API mínima

### chunkcoords

```go
func CoordFromCell(cell, chunkSize int) int
func Key(cx, cy int) string
func KeyFromCell(x, y, chunkSize int) string
func CellBounds(cx, cy, chunkSize int) (xmin, xmax, ymin, ymax int)
func KeysInRadius(cx, cy, radius, chunkSize int) []string
func UnionForPlayers(positions [][2]int, radius, chunkSize int) map[string]struct{}
```

### cellkey

```go
func Format(x, y, z int) string
func Parse(key string) (x, y, z int, err error)
```

### rediskeys

```go
func StreamTerrainRequests() string
func ChunkWireKey(bloqueID string, cx, cy int) string
// ...
```

### session

```go
type Config struct { ChunkSizeCells int; TerrainZMin int; ... }
func Load(path string) (*Config, error)
```

---

## Golden tests

Mismos inputs/outputs que `rust/terrain-service/tests/chunkcoords_golden.rs`.

---

## Módulos Go que importan jd

- `cmd/game-server`
- `cmd/persistence-api`
- `cmd/registry`
- `cmd/gateway-ws`

Rust duplica algoritmo chunkcoords — no importa paquete Go.
