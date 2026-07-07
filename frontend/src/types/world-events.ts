/**
 * @file Contratos WebSocket tiempo real (mundo + presencia + combate).
 *
 * Mantener alineado con:
 * - `backend/src/game/network/ws_dispatcher.py` (join, input, swing)
 * - `backend/src/game/network/terrain_ws_messages.py` (terrain_types, terrain_chunk)
 * - `backend/src/game/network/presence_handler.py`
 * - `shared/game-data/network/terrain-ws.schema.json`
 * - `shared/game-data/` (stats de combate; movimiento en registries JSON)
 *
 * @see `instructions/notes/terreno-ws.md`
 */

/** Posición en celdas del mundo (misma convención que `PositionComponent`). */
export interface CellPosition {
  x: number;
  y: number;
  z: number;
}

// --- Mundo (terreno) ---

/** Partícula destruida por el servidor (autoritativo). */
export interface ParticleDestroyedEvent {
  type: 'particle_destroyed';
  particle_id: string;
  bloque_id: string;
  position?: CellPosition;
}

// --- Terreno WS (Fase 0 — server → cliente) ---
//
// Sustituyen GET /particles en gameplay. Ver terreno-ws.md.
// Flujo: terrain_types → terrain_chunk × N → terrain_chunk_done

/**
 * Familia física en wire terreno.
 * Subconjunto de {@link PhysicsType} en `particle.ts` (sin valores legacy de BD).
 */
export type TerrainWsPhysicsType = 'solido' | 'liquido' | 'gas' | 'energia';

/**
 * Partícula compacta dentro de {@link TerrainChunkEvent}.
 *
 * Sin campos pesados del API HTTP (`propiedades`, estados, etc.).
 * El cliente mergea por celda `(x,y,z)` en `TerrainStore`.
 */
export interface TerrainWsParticle {
  /** UUID en BD; correlaciona con {@link ParticleDestroyedEvent.particle_id}. */
  id: string;
  /** `celda_x` entera. */
  x: number;
  /** `celda_y` entera. */
  y: number;
  /** `celda_z` entera — capas apiladas (suelo destruible multicapa). */
  z: number;
  /** Lookup en catálogo {@link TerrainTypesEvent.types}. */
  tipo_nombre: string;
  /** `solido` → índice de colisión; otros → muestreo de `medium`. */
  tipo_fisico: TerrainWsPhysicsType;
}

/**
 * Entrada de catálogo en {@link TerrainTypesEvent}.
 * Subconjunto de {@link ParticleType} para render y locomoción.
 */
export interface TerrainWsTypeEntry {
  nombre: string;
  tipo_fisico: TerrainWsPhysicsType;
  color?: string | null;
  viscosidad?: number | null;
  opacidad?: number | null;
}

/**
 * Catálogo de tipos del bloque (server → cliente).
 *
 * **Cuándo:** al `join_block`, antes del primer `terrain_chunk`.
 * **Uso cliente:** poblar `TerrainStore.typesByNombre` antes del merge de partículas.
 */
export interface TerrainTypesEvent {
  type: 'terrain_types';
  /** UUID del bloque/dimensión (mismo que `join_block.bloque_id`). */
  bloque_id: string;
  types: TerrainWsTypeEntry[];
}

/**
 * Un chunk XY de terreno: tile 40×40 en planta + columna Z completa.
 *
 * **Chunk vs bloque:** `bloque_id` = mapa entero. `chunk_cx`/`chunk_cy` = tile dentro del mapa.
 * No hay `chunk_cz`; `z_min`..`z_max` cubren toda la altura relevante (-10..32).
 *
 * **Uso cliente:** merge incremental por celda; no reemplaza viewport entero.
 */
export interface TerrainChunkEvent {
  type: 'terrain_chunk';
  bloque_id: string;
  /** Índice de chunk X: `floor(celda_x / CHUNK_SIZE_CELLS)`. */
  chunk_cx: number;
  /** Índice de chunk Y. */
  chunk_cy: number;
  /** Límite Z inferior inclusivo ({@link TERRAIN_Z_MIN}). */
  z_min: number;
  /** Límite Z superior inclusivo ({@link TERRAIN_Z_MAX}). */
  z_max: number;
  /** Generación de ronda de carga; emparejar con {@link TerrainChunkDoneEvent.seq}. */
  seq: number;
  particles: TerrainWsParticle[];
}

/**
 * Fin de ronda de envío de chunks (join o refresh por movimiento).
 *
 * **Uso cliente:** marca fin de carga → rebuild índices async → `isSimulationStable`.
 */
export interface TerrainChunkDoneEvent {
  type: 'terrain_chunk_done';
  bloque_id: string;
  /** Misma generación que los `terrain_chunk` de esta ronda. */
  seq: number;
  /** Conteo enviado (debug HUD; opcional). */
  chunks_sent?: number;
}

/** Mensajes server → cliente que cargan o actualizan terreno local. */
export type TerrainWsEvent = TerrainTypesEvent | TerrainChunkEvent | TerrainChunkDoneEvent;

// --- Presencia (Sprint B) ---

/** Cliente entra a la sala de un bloque. */
export interface JoinBlockCommand {
  type: 'join_block';
  bloque_id: string;
  /** UUID estable por pestaña (ver `getOrCreatePlayerId`). */
  player_id: string;
  position: CellPosition;
  yaw?: number;
  pitch?: number;
  /** Id ECS local para correlacionar `swing`. */
  entity_id?: number;
  /** M6: preferencia de wire (`msgpack` si servidor lo soporta). */
  wire_format?: 'json' | 'msgpack';
}

/** Confirmación de join al cliente que envió `join_block`. */
export interface JoinOkEvent {
  type: 'join_ok';
  bloque_id: string;
  player_id: string;
  players: string[];
  eco_id?: number;
  eco_label?: string;
  /** M6: `msgpack` → `player_state` en frames binarios MsgPack. */
  wire_format?: 'json' | 'msgpack';
}

/** Export `JoinErrorEvent` — join error event. */
export interface JoinErrorEvent {
  type: 'join_error';
  error: string;
}

/** Otro jugador entró a la sala. */
export interface PlayerJoinedEvent {
  type: 'player_joined';
  bloque_id: string;
  player_id: string;
  position: CellPosition;
}

/** Otro jugador salió de la sala. */
export interface PlayerLeftEvent {
  type: 'player_left';
  bloque_id: string;
  player_id: string;
}

/**
 * Snapshot autoritativo de un jugador (~30 Hz desde servidor).
 *
 * Sprint D: el cliente reconcilia posición local con `input_seq` + snap/replay.
 */
export interface PlayerStateEvent {
  type: 'player_state';
  server_tick: number;
  player_id: string;
  bloque_id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch?: number;
  medium: string;
  action_id?: string;
  action_t0_ms?: number;
  entity_id?: number;
  /** Intents autoritativos en el tick (debug / observador). */
  intents?: Record<string, true>;
  /** Último ``seq`` de ``input`` WS aplicado. */
  input_seq?: number;
  /** Marca de llegada WS (solo cliente, debug). */
  receivedAtMs?: number;
}

/** Export `PresenceEvent` — presence event. */
export type PresenceEvent =
  | JoinOkEvent
  | JoinErrorEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerStateEvent;

// --- Locomoción (Sprint C) ---

/**
 * Intents de locomoción hacia el servidor (~30 Hz).
 *
 * Espejo de `handle_input` en `ws_room_handler.py`.
 */
export interface InputCommand {
  type: 'input';
  bloque_id: string;
  player_id: string;
  seq: number;
  /**
   * Intents activos (`true`). Omitir si el mensaje es solo cámara (no pisar locomoción).
   * Enviar `{}` explícito al soltar todas las teclas de movimiento.
   */
  intents?: Record<string, true>;
  yaw: number;
  pitch?: number;
}

/** Export `InputErrorEvent` — input error event. */
export interface InputErrorEvent {
  type: 'input_error';
  error: string;
}

// --- Combate ---

/** Export `SwingCommand` — swing command. */
export interface SwingCommand {
  type: 'swing';
  seq: number;
  action_id: string;
  entity_id: number;
  bloque_id: string;
  position: CellPosition;
  yaw?: number;
}

/** Export `SwingResultEvent` — swing result event. */
export interface SwingResultEvent {
  type: 'swing_result';
  seq: number;
  entity_id: number;
  action_id: string;
  hits: Array<{
    particle_id: string;
    destroyed: boolean;
    integridad?: number;
  }>;
}

/** Export `SwingErrorEvent` — swing error event. */
export interface SwingErrorEvent {
  type: 'swing_error';
  error: string;
  action_id?: string;
  seq?: number;
}

/** Export `CombatServerEvent` — combat server event. */
export type CombatServerEvent = SwingResultEvent | SwingErrorEvent;

/** Eventos servidor → cliente que mutan terreno local (destrucción + carga WS). */
export type WorldEvent = ParticleDestroyedEvent | TerrainWsEvent;

/** Eventos servidor → cliente de presencia y combate (no terreno). */
export type SessionEvent = PresenceEvent | CombatServerEvent | InputErrorEvent;

/** Export `RealtimeInboundMessage` — realtime inbound message. */
export type RealtimeInboundMessage = WorldEvent | SessionEvent;

/** Comandos cliente → servidor. */
export type WorldCommand = JoinBlockCommand | InputCommand | SwingCommand;
