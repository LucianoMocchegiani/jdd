---
id: "05"
title: Protobuf — contratos inter-servicio
status: cerrado
version: 1
depends_on: ["00"]
---

# Protobuf — contratos inter-servicio

**Usar cuando:** añadir/cambiar mensajes Redis, generar Go/Rust, validar payloads.

**Wire al browser:** JSON — **no** Protobuf. Ver [06-ws-client-json.md](./06-ws-client-json.md) (pendiente).

---

## Layout

```text
shared/proto/
├── inter_service.proto    # terrain + swing
├── world_events.proto     # BlockSeeded, ParticleDestroyed
└── buf.gen.yaml           # opcional
```

Generación: [shared/proto-generation.md](./shared/proto-generation.md)

---

## Mensajes (esqueleto)

### `inter_service.proto`

```protobuf
syntax = "proto3";
package jd.v1;

message ChunkRequest {
  string bloque_id = 1;
  int32 chunk_cx = 2;
  int32 chunk_cy = 3;
  int32 priority = 4;
  string requester_id = 5;   // game instance id
  optional string player_id = 6;
}

message ChunkReady {
  string bloque_id = 1;
  int32 chunk_cx = 2;
  int32 chunk_cy = 3;
  string wire_json = 4;      // terrain_chunk JSON
  repeated string solid_cells = 5;  // "x,y,z"
  uint64 version = 6;
  string requester_id = 7;
}

message CellDestroyed {
  string bloque_id = 1;
  int32 x = 2;
  int32 y = 3;
  int32 z = 4;
  string particle_id = 5;
}

message SwingCommand {
  string bloque_id = 1;
  string action_id = 2;
  int32 entity_id = 3;
  int32 seq = 4;
  float pos_x = 5;
  float pos_y = 6;
  float pos_z = 7;
  bool is_npc = 8;
}
```

### `world_events.proto`

```protobuf
message ParticleDestroyedEvent {
  string bloque_id = 1;
  string particle_id = 2;
  int32 x = 3;
  int32 y = 4;
  int32 z = 5;
}

message BlockSeeded {
  string bloque_id = 1;
  bool is_new_block = 2;
  uint64 block_version = 3;
  // optional Region region = 4;  // v2 partial seed
}
```

---

## Serialización en Redis Stream

Campo recomendado: `payload` = bytes protobuf + `type` = nombre mensaje.

Alternativa dev: JSON hasta M1 estable; migrar a proto antes de M2.

---

## Versionado

- Campo `version` en ChunkReady / block_version en BlockSeeded
- Cambios breaking → nuevo package `jd.v2` o campo `schema_version`

---

## Referencia

Contratos JSON legacy en `instructions/notes/terreno-ws.md` — solo **cliente**.
