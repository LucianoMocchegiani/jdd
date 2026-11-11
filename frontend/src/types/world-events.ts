// --- Presencia (Sprint B) ---

/** Inicia la carga de terreno sin incorporar aún al jugador a la sesión. */
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

/** Activa al jugador una vez conectado y con terreno/spawn listos. */
export interface ActivatePlayerCommand {
  type: 'activate_player';
  position: CellPosition;
}

/** Cliente entra a la sala de un bloque (flujo legacy). */
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

/** Confirmación de activación del jugador. */
export interface JoinOkEvent {
  type: 'join_ok';
  bloque_id: string;
  player_id: string;
  players: string[];
  eco_id?: number;
  eco_label?: string;
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
  intents?: Record<string, true>;
  input_seq?: number;
  health?: number;
  max_health?: number;
  receivedAtMs?: number;
}

/** Export `PresenceEvent` — presence event. */
export type PresenceEvent = JoinOkEvent | JoinErrorEvent | PlayerJoinedEvent | PlayerLeftEvent | PlayerStateEvent;

// --- Locomoción (Sprint C) ---

/** Intents de locomoción hacia el servidor (~30 Hz). */
export interface InputCommand {
  type: 'input';
  bloque_id: string;
  player_id: string;
  seq: number;
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
  player_id: string;
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
  hits: Array<{ particle_id: string; destroyed: boolean; integridad?: number }>;
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
export type WorldCommand = JoinBlockCommand | PrepareJoinCommand | ActivatePlayerCommand | InputCommand | SwingCommand;
