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

export type TerrainWsPhysicsType = 'solido' | 'liquido' | 'gas' | 'energia';

export interface TerrainWsParticle {
  id: string;
  x: number;
  y: number;
  z: number;
  tipo_nombre: string;
  tipo_fisico: TerrainWsPhysicsType;
}

export interface TerrainWsTypeEntry {
  nombre: string;
  tipo_fisico: TerrainWsPhysicsType;
  color?: string | null;
  viscosidad?: number | null;
  opacidad?: number | null;
}

export interface TerrainTypesEvent {
  type: 'terrain_types';
  bloque_id: string;
  types: TerrainWsTypeEntry[];
}

export interface TerrainChunkEvent {
  type: 'terrain_chunk';
  bloque_id: string;
  chunk_cx: number;
  chunk_cy: number;
  z_min: number;
  z_max: number;
  seq: number;
  particles: TerrainWsParticle[];
}

export interface TerrainChunkDoneEvent {
  type: 'terrain_chunk_done';
  bloque_id: string;
  seq: number;
  chunks_sent?: number;
}

export type TerrainWsEvent = TerrainTypesEvent | TerrainChunkEvent | TerrainChunkDoneEvent;

// --- Presencia ---

export interface JoinBlockCommand {
  type: 'join_block';
  bloque_id: string;
  player_id: string;
  position: CellPosition;
  yaw?: number;
  pitch?: number;
  entity_id?: number;
  wire_format?: 'json' | 'msgpack';
}

export interface JoinOkEvent {
  type: 'join_ok';
  bloque_id: string;
  player_id: string;
  players: string[];
  eco_id?: number;
  eco_label?: string;
  wire_format?: 'json' | 'msgpack';
}

export interface JoinErrorEvent {
  type: 'join_error';
  error: string;
}

export interface PlayerJoinedEvent {
  type: 'player_joined';
  bloque_id: string;
  player_id: string;
  position: CellPosition;
}

export interface PlayerLeftEvent {
  type: 'player_left';
  bloque_id: string;
  player_id: string;
}

/** Snapshot autoritativo de un jugador (~30 Hz desde servidor). */
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
  intents?: Record<string, true>;
  input_seq?: number;
  /** Salud autoritativa; el estado se conserva en memoria del servidor. */
  health?: number;
  max_health?: number;
  receivedAtMs?: number;
}

export type PresenceEvent =
  | JoinOkEvent
  | JoinErrorEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerStateEvent;

// --- Locomoción ---

export interface InputCommand {
  type: 'input';
  bloque_id: string;
  player_id: string;
  seq: number;
  intents?: Record<string, true>;
  yaw: number;
  pitch?: number;
}

export interface InputErrorEvent {
  type: 'input_error';
  error: string;
}

// --- Combate ---

export interface SwingCommand {
  type: 'swing';
  seq: number;
  action_id: string;
  entity_id: number;
  player_id: string;
  bloque_id: string;
  position: CellPosition;
  yaw?: number;
}

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

export interface SwingErrorEvent {
  type: 'swing_error';
  error: string;
  action_id?: string;
  seq?: number;
}

export type CombatServerEvent = SwingResultEvent | SwingErrorEvent;
export type WorldEvent = ParticleDestroyedEvent | TerrainWsEvent;
export type SessionEvent = PresenceEvent | CombatServerEvent | InputErrorEvent;
export type RealtimeInboundMessage = WorldEvent | SessionEvent;
export type WorldCommand = JoinBlockCommand | InputCommand | SwingCommand;
