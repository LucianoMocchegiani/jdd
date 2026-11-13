/**
 * @file Contratos WebSocket tiempo real (mundo + presencia + combate).
 */

/** Posición en celdas del mundo. */
export interface CellPosition { x: number; y: number; z: number; }

// --- Mundo (terreno) ---
export interface ParticleDestroyedEvent {
  type: 'particle_destroyed';
  particle_id: string;
  bloque_id: string;
  position?: CellPosition;
}
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
/** Prepara la carga de terreno antes de crear/activar al jugador. */
export interface PrepareJoinCommand {
  type: 'prepare_join';
  bloque_id: string;
  player_id: string;
  position: CellPosition;
  yaw?: number;
  pitch?: number;
  entity_id?: number;
  wire_format?: 'json' | 'msgpack';
}
/** Activa al jugador después de cargar el terreno y resolver el spawn. */
export interface ActivatePlayerCommand { type: 'activate_player'; position: CellPosition; }
/** Cliente entra a la sala (flujo legacy). */
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
export interface JoinErrorEvent { type: 'join_error'; error: string; }
export interface PlayerJoinedEvent { type: 'player_joined'; bloque_id: string; player_id: string; position: CellPosition; }
export interface PlayerLeftEvent { type: 'player_left'; bloque_id: string; player_id: string; }
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
  health?: number;
  max_health?: number;
  mana?: number;
  max_mana?: number;
  in_combat?: boolean;
  receivedAtMs?: number;
}
export type PresenceEvent = JoinOkEvent | JoinErrorEvent | PlayerJoinedEvent | PlayerLeftEvent | PlayerStateEvent;

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
export interface InputErrorEvent { type: 'input_error'; error: string; }

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
  hits: Array<{ particle_id: string; destroyed: boolean; integridad?: number }>;
}
export interface SwingErrorEvent { type: 'swing_error'; error: string; action_id?: string; seq?: number; }
export interface ProjectileStateEvent {
  type: 'projectile_state';
  id: string;
  owner_id: string;
  action_id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
}
export type CombatServerEvent = SwingResultEvent | SwingErrorEvent | ProjectileStateEvent;
export type WorldEvent = ParticleDestroyedEvent | TerrainWsEvent;
export type SessionEvent = PresenceEvent | CombatServerEvent | InputErrorEvent;
export type RealtimeInboundMessage = WorldEvent | SessionEvent;
export type WorldCommand = JoinBlockCommand | PrepareJoinCommand | ActivatePlayerCommand | InputCommand | SwingCommand;
