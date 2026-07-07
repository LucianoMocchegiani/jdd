---
id: SH-3
title: Generación Protobuf
status: cerrado
version: 1
depends_on: ["05"]
---

# Generación Protobuf

**Usar cuando:** añadir mensajes, generar Go, (futuro) Rust prost.

---

## Layout

```text
shared/proto/
├── inter_service.proto
├── world_events.proto
└── buf.gen.yaml
```

---

## Go (M0)

Opción A — `buf`:

```yaml
# buf.gen.yaml
version: v2
plugins:
  - remote: buf.build/protocolbuffers/go
    out: go/pkg/jd/contracts
    opt: paths=source_relative
```

Opción B — `protoc`:

```bash
protoc --go_out=go/pkg/jd/contracts --go_opt=paths=source_relative \
  shared/proto/*.proto
```

---

## Rust (M1+)

`prost` + `tonic-build` en `build.rs` o migración manual de structs hasta M2.

Dev M1: JSON en Redis streams aceptable; proto obligatorio antes de M2 multi-réplica.

---

## Convenciones

- Package proto: `jd.v1`
- Go import path: `github.com/juego-de-dioses/jd/pkg/jd/contracts`
- Breaking change → `jd.v2` o bump `schema_version` en stream metadata

---

## Checklist nuevo mensaje

1. Editar `.proto`
2. Regenerar Go
3. Actualizar [04-redis-streams.md](../04-redis-streams.md)
4. Actualizar consumer/producer en servicio afectado
5. Actualizar [05-proto-inter-service.md](../05-proto-inter-service.md)
