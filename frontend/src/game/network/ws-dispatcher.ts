import type { RealtimeInboundMessage, SessionEvent, WorldEvent, SwingResultPlayerHit } from '@/types/world-events';
import { parseTerrainWsMessage } from '@/game/network/parse-terrain-ws';

export type WorldEventHandler = (event: WorldEvent) => void;
export type SessionEventHandler = (event: SessionEvent) => void;
export interface WorldRealtimeHandlers { onWorldEvent: WorldEventHandler; onSessionEvent?: SessionEventHandler; onOpen?: () => void; }
interface SwingResultHit { particle_id: string; destroyed: boolean; integridad?: number; }

function parsePlayerStateIntents(raw: unknown): Record<string, true> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, true> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) if (value === true) out[key] = true;
  return Object.keys(out).length > 0 ? out : undefined;
}
function parseSwingPlayerHits(raw: unknown): SwingResultPlayerHit[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const hit = value as Record<string, unknown>;
    return typeof hit.player_id === 'string' && hit.player_id !== '' && finiteNumber(hit.entity_id) && hit.entity_id > 0 && finiteNumber(hit.damage) && hit.damage > 0
      ? [{ player_id: hit.player_id, entity_id: hit.entity_id, damage: hit.damage }]
      : [];
  });
}
function finiteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

/** Valida un mensaje JSON entrante y lo convierte al contrato tipado del cliente. */
export function parseInboundMessage(raw: unknown): RealtimeInboundMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw as Record<string, unknown>;
  const type = msg.type;
  if (typeof type !== 'string') return null;

  if (type === 'swing_queued') {
    if (!finiteNumber(msg.seq) || !finiteNumber(msg.action_seq) || !finiteNumber(msg.entity_id) || typeof msg.action_id !== 'string' || !msg.action_id) return null;
    return { type: 'swing_queued', seq: msg.seq, action_seq: msg.action_seq, entity_id: msg.entity_id, action_id: msg.action_id };
  }
  if (type === 'area_spell') {
    if (typeof msg.action_id !== 'string' || typeof msg.player_id !== 'string' || (msg.effect !== 'orb' && msg.effect !== 'thunder') ||
      !finiteNumber(msg.x) || !finiteNumber(msg.y) || !finiteNumber(msg.z) || !finiteNumber(msg.radius) || msg.radius <= 0 || msg.radius > 10) return null;
    return { type: 'area_spell', action_id: msg.action_id, player_id: msg.player_id, effect: msg.effect, x: msg.x, y: msg.y, z: msg.z, radius: msg.radius };
  }
  if (type === 'projectile_state') {
    if (typeof msg.id !== 'string' || typeof msg.owner_id !== 'string' || typeof msg.action_id !== 'string' || !finiteNumber(msg.x) || !finiteNumber(msg.y) || !finiteNumber(msg.z) || typeof msg.active !== 'boolean') return null;
    return { type: 'projectile_state', id: msg.id, owner_id: msg.owner_id, action_id: msg.action_id, x: msg.x, y: msg.y, z: msg.z, active: msg.active };
  }
  if (type === 'particle_destroyed') {
    if (typeof msg.particle_id !== 'string' || typeof msg.bloque_id !== 'string') return null;
    const rawPos = msg.position;
    let position: { x: number; y: number; z: number } | undefined;
    if (rawPos && typeof rawPos === 'object') {
      const p = rawPos as Record<string, unknown>;
      if (finiteNumber(p.x) && finiteNumber(p.y) && finiteNumber(p.z)) position = { x: p.x, y: p.y, z: p.z };
    }
    return { type: 'particle_destroyed', particle_id: msg.particle_id, bloque_id: msg.bloque_id, position };
  }
  if (type === 'join_ok') {
    const bloqueId = msg.bloque_id, playerId = msg.player_id, players = msg.players;
    if (typeof bloqueId !== 'string' || typeof playerId !== 'string' || !Array.isArray(players)) return null;
    return { type: 'join_ok', bloque_id: bloqueId, player_id: playerId, players: players.filter((p): p is string => typeof p === 'string') };
  }
  if (type === 'join_error') return { type: 'join_error', error: String(msg.error ?? 'unknown') };
  if (type === 'player_joined' || type === 'player_left') {
    const bloqueId = msg.bloque_id, playerId = msg.player_id;
    if (typeof bloqueId !== 'string' || typeof playerId !== 'string') return null;
    if (type === 'player_left') return { type: 'player_left', bloque_id: bloqueId, player_id: playerId };
    if (!msg.position || typeof msg.position !== 'object') return null;
    const p = msg.position as Record<string, unknown>;
    if (!finiteNumber(p.x) || !finiteNumber(p.y) || !finiteNumber(p.z)) return null;
    return { type: 'player_joined', bloque_id: bloqueId, player_id: playerId, position: { x: p.x, y: p.y, z: p.z } };
  }
  if (type === 'player_state') {
    const bloqueId = msg.bloque_id, playerId = msg.player_id;
    if (typeof bloqueId !== 'string' || typeof playerId !== 'string' || !finiteNumber(msg.x) || !finiteNumber(msg.y) || !finiteNumber(msg.z) ||
      !finiteNumber(msg.vx) || !finiteNumber(msg.vy) || !finiteNumber(msg.vz) || !finiteNumber(msg.yaw)) return null;
    const conditions = Array.isArray(msg.conditions) ? msg.conditions.filter((id): id is string => typeof id === 'string') : undefined;
    return {
      type: 'player_state', server_tick: finiteNumber(msg.server_tick) ? msg.server_tick : 0, player_id: playerId, bloque_id: bloqueId,
      x: msg.x, y: msg.y, z: msg.z, vx: msg.vx, vy: msg.vy, vz: msg.vz, yaw: msg.yaw,
      pitch: finiteNumber(msg.pitch) ? msg.pitch : undefined, medium: typeof msg.medium === 'string' ? msg.medium : 'ground',
      dominant_particle: typeof msg.dominant_particle === 'string' ? msg.dominant_particle : undefined, conditions,
      condition_damage_total: finiteNumber(msg.condition_damage_total) ? msg.condition_damage_total : undefined,
      action_id: typeof msg.action_id === 'string' ? msg.action_id : undefined,
      action_seq: finiteNumber(msg.action_seq) ? msg.action_seq : undefined,
      action_t0_ms: finiteNumber(msg.action_t0_ms) ? msg.action_t0_ms : undefined,
      entity_id: finiteNumber(msg.entity_id) ? msg.entity_id : undefined,
      intents: parsePlayerStateIntents(msg.intents), input_seq: finiteNumber(msg.input_seq) ? msg.input_seq : undefined,
      health: finiteNumber(msg.health) ? msg.health : undefined, max_health: finiteNumber(msg.max_health) ? msg.max_health : undefined,
      mana: finiteNumber(msg.mana) ? msg.mana : undefined, max_mana: finiteNumber(msg.max_mana) ? msg.max_mana : undefined,
      in_combat: typeof msg.in_combat === 'boolean' ? msg.in_combat : undefined,
      continuous_attack_active: typeof msg.continuous_attack_active === 'boolean' ? msg.continuous_attack_active : undefined,
      continuous_action_id: typeof msg.continuous_action_id === 'string' ? msg.continuous_action_id : undefined,
      shield_active: typeof msg.shield_active === 'boolean' ? msg.shield_active : undefined,
      shield_remaining: finiteNumber(msg.shield_remaining) && msg.shield_remaining >= 0 ? msg.shield_remaining : undefined,
    };
  }
  if (type === 'swing_result') {
    if (msg.beam_length !== undefined && (!finiteNumber(msg.beam_length) || msg.beam_length < 0)) return null;
    return {
      type: 'swing_result', seq: Number(msg.seq ?? 0), entity_id: Number(msg.entity_id ?? 0), action_id: String(msg.action_id ?? ''),
      player_id: typeof msg.player_id === 'string' ? msg.player_id : undefined,
      beam_length: finiteNumber(msg.beam_length) ? msg.beam_length : undefined,
      hits: Array.isArray(msg.hits) ? msg.hits as SwingResultHit[] : [],
      player_hits: parseSwingPlayerHits(msg.player_hits),
    };
  }
  if (type === 'swing_error') return { type: 'swing_error', error: String(msg.error ?? 'unknown'), action_id: typeof msg.action_id === 'string' ? msg.action_id : undefined, seq: finiteNumber(msg.seq) ? msg.seq : undefined };
  return parseTerrainWsMessage(msg);
}

/** Enruta los mensajes de mundo y sesión al callback correspondiente. */
export function dispatchMessage(msg: RealtimeInboundMessage, handlers: WorldRealtimeHandlers): void {
  if (msg.type === 'particle_destroyed' || msg.type === 'terrain_types' || msg.type === 'terrain_chunk' || msg.type === 'terrain_chunk_done') {
    handlers.onWorldEvent(msg);
    return;
  }
  handlers.onSessionEvent?.(msg);
}
