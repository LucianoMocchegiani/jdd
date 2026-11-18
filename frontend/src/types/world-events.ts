import type { CellPosition } from '@/types/world-events';

/** Contratos de mensajes WebSocket intercambiados por cliente y servidor. */
export interface ParticleDestroyedEvent { type: 'particle_destroyed'; particle_id: string; bloque_id: string; position?: CellPosition; }
export type TerrainWsPhysicsType = 'solido' | 'liquido' | 'gas' | 'energia';
export interface TerrainWsParticle { id: string; x: number; y: number; z: number; tipo_nombre: string; tipo_fisico: TerrainWsPhysicsType; }
export interface TerrainWsTypeEntry { nombre: string; tipo_fisico: TerrainWsPhysicsType; color?: string | null; opacidad?: number | null; viscosidad?: number | null; }
export interface TerrainTypesEvent { type: 'terrain_types'; bloque_id: string; types: TerrainWsTypeEntry[]; }
export interface TerrainChunkEvent { type: 'terrain_chunk'; bloque_id: string; chunk_cx: number; chunk_cy: number; z_min: number; z_max: number; seq: number; particles: TerrainWsParticle[]; }
export interface TerrainChunkDoneEvent { type: 'terrain_chunk_done'; bloque_id: string; seq: number; chunks_sent?: number; }
export type TerrainWsEvent = TerrainTypesEvent | TerrainChunkEvent | TerrainChunkDoneEvent;
export interface PrepareJoinCommand { type: 'prepare_join'; bloque_id: string; player_id: string; position: CellPosition; yaw?: number; pitch?: number; entity_id?: number; wire_format?: 'json' | 'msgpack'; }
export interface ActivatePlayerCommand { type: 'activate_player'; position: CellPosition; }
export interface JoinBlockCommand { type: 'join_block'; bloque_id: string; player_id: string; position: CellPosition; yaw?: number; pitch?: number; entity_id?: number; wire_format?: 'json' | 'msgpack'; }
export interface JoinOkEvent { type: 'join_ok'; bloque_id: string; player_id: string; players: string[]; eco_id?: number; eco_label?: string; wire_format?: 'json' | 'msgpack'; }
export interface JoinErrorEvent { type: 'join_error'; error: string; }
export interface PlayerJoinedEvent { type: 'player_joined'; bloque_id: string; player_id: string; position: CellPosition; }
export interface PlayerLeftEvent { type: 'player_left'; bloque_id: string; player_id: string; }
/** Snapshot autoritativo de movimiento, estado de combate y recursos de un jugador. */
export interface PlayerStateEvent {
  type: 'player_state'; server_tick: number; player_id: string; bloque_id: string;
  x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number;
  pitch?: number; medium: string; dominant_particle?: string; conditions?: string[]; condition_damage_total?: number;
  action_id?: string; action_seq?: number; action_t0_ms?: number; entity_id?: number;
  intents?: Record<string, true>; input_seq?: number; health?: number; max_health?: number;
  mana?: number; max_mana?: number; in_combat?: boolean; continuous_attack_active?: boolean;
  continuous_action_id?: string; receivedAtMs?: number;
}
export type PresenceEvent = JoinOkEvent | JoinErrorEvent | PlayerJoinedEvent | PlayerLeftEvent | PlayerStateEvent;
export interface InputCommand { type: 'input'; bloque_id: string; player_id: string; seq: number; intents?: Record<string, true>; yaw: number; pitch?: number; }
export interface InputErrorEvent { type: 'input_error'; error: string; }
export interface SwingCommand { type: 'swing'; seq: number; action_id: string; entity_id: number; player_id: string; bloque_id: string; position: CellPosition; yaw?: number; }
/** Solicitud de cast de área; el servidor resuelve perfil, límites y aceptación. */
export interface AreaSpellCommand { type: 'area_spell_cast'; seq: number; action_id: string; target_position: CellPosition; }
/** Acuse de acción aceptada: seq identifica la solicitud y action_seq la acción autoritativa. */
export interface SwingQueuedEvent { type: 'swing_queued'; seq: number; action_seq: number; entity_id: number; action_id: string; }
export interface SwingResultPlayerHit { player_id: string; entity_id: number; damage: number; }
export interface SwingResultEvent { type: 'swing_result'; seq: number; entity_id: number; action_id: string; player_id?: string; beam_length?: number; hits: Array<{ particle_id: string; destroyed: boolean; integridad?: number }>; player_hits?: SwingResultPlayerHit[]; }
export interface SwingErrorEvent { type: 'swing_error'; error: string; action_id?: string; seq?: number; }
/** Efecto replicado de un cast aceptado; no representa por sí mismo un resultado de daño. */
export interface AreaSpellEvent { type: 'area_spell'; action_id: string; player_id: string; effect: 'orb' | 'thunder'; x: number; y: number; z: number; radius: number; }
export interface ProjectileStateEvent { type: 'projectile_state'; id: string; owner_id: string; action_id: string; x: number; y: number; z: number; active: boolean; }
export type CombatServerEvent = SwingQueuedEvent | SwingResultEvent | SwingErrorEvent | AreaSpellEvent | ProjectileStateEvent;
export type WorldEvent = ParticleDestroyedEvent | TerrainWsEvent;
export type SessionEvent = PresenceEvent | CombatServerEvent | InputErrorEvent;
export type RealtimeInboundMessage = WorldEvent | SessionEvent;
export type WorldCommand = JoinBlockCommand | PrepareJoinCommand | ActivatePlayerCommand | InputCommand | SwingCommand | AreaSpellCommand;
