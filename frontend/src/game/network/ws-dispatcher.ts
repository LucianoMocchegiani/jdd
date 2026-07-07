/**
 * @file Parseo y dispatch de mensajes WS entrantes.
 *
 * Responsabilidades:
 * - Tipos de handlers y la interfaz de callbacks (`WorldRealtimeHandlers`).
 * - `parseInboundMessage` — valida y estrecha JSON crudo a `RealtimeInboundMessage`.
 * - `dispatchMessage` — enruta un mensaje ya validado al handler correcto.
 *
 * No abre ni cierra sockets — eso es responsabilidad de `ws-client.ts`.
 */

import type {
  RealtimeInboundMessage,
  SessionEvent,
  WorldEvent,
} from '@/types/world-events';
import { parseTerrainWsMessage } from '@/game/network/parse-terrain-ws';

/** Export `WorldEventHandler` — world event handler. */
export type WorldEventHandler = (event: WorldEvent) => void;
/** Export `SessionEventHandler` — session event handler. */
export type SessionEventHandler = (event: SessionEvent) => void;

/** Export `WorldRealtimeHandlers` — world realtime handlers. */
export interface WorldRealtimeHandlers {
  onWorldEvent: WorldEventHandler;
  onSessionEvent?: SessionEventHandler;
  onOpen?: () => void;
}

interface SwingResultHit {
  particle_id: string;
  destroyed: boolean;
  integridad?: number;
}

function parsePlayerStateIntents(raw: unknown): Record<string, true> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, true> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === true) out[key] = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Export `parseInboundMessage` — parse inbound message. */
export function parseInboundMessage(raw: unknown): RealtimeInboundMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw as Record<string, unknown>;
  const type = msg.type;
  if (typeof type !== 'string') return null;

  if (type === 'particle_destroyed') {
    const particleId = msg.particle_id;
    const bloqueId = msg.bloque_id;
    if (typeof particleId !== 'string' || typeof bloqueId !== 'string') return null;
    const pos = msg.position;
    let position: { x: number; y: number; z: number } | undefined;
    if (pos && typeof pos === 'object') {
      const p = pos as Record<string, unknown>;
      if (typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number') {
        position = { x: p.x, y: p.y, z: p.z };
      }
    }
    return { type: 'particle_destroyed', particle_id: particleId, bloque_id: bloqueId, position };
  }

  if (type === 'join_ok') {
    const bloqueId = msg.bloque_id;
    const playerId = msg.player_id;
    const players = msg.players;
    if (typeof bloqueId !== 'string' || typeof playerId !== 'string' || !Array.isArray(players)) return null;
    return {
      type: 'join_ok',
      bloque_id: bloqueId,
      player_id: playerId,
      players: players.filter((p): p is string => typeof p === 'string'),
    };
  }

  if (type === 'join_error') {
    return { type: 'join_error', error: String(msg.error ?? 'unknown') };
  }

  if (type === 'player_joined' || type === 'player_left') {
    const bloqueId = msg.bloque_id;
    const playerId = msg.player_id;
    if (typeof bloqueId !== 'string' || typeof playerId !== 'string') return null;
    if (type === 'player_left') {
      return { type: 'player_left', bloque_id: bloqueId, player_id: playerId };
    }
    const pos = msg.position;
    if (!pos || typeof pos !== 'object') return null;
    const p = pos as Record<string, unknown>;
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.z !== 'number') return null;
    return {
      type: 'player_joined',
      bloque_id: bloqueId,
      player_id: playerId,
      position: { x: p.x, y: p.y, z: p.z },
    };
  }

  if (type === 'player_state') {
    const bloqueId = msg.bloque_id;
    const playerId = msg.player_id;
    if (typeof bloqueId !== 'string' || typeof playerId !== 'string') return null;
    if (
      typeof msg.x !== 'number' || typeof msg.y !== 'number' || typeof msg.z !== 'number' ||
      typeof msg.vx !== 'number' || typeof msg.vy !== 'number' || typeof msg.vz !== 'number' ||
      typeof msg.yaw !== 'number'
    ) return null;
    return {
      type: 'player_state',
      server_tick: typeof msg.server_tick === 'number' ? msg.server_tick : 0,
      player_id: playerId,
      bloque_id: bloqueId,
      x: msg.x, y: msg.y, z: msg.z,
      vx: msg.vx, vy: msg.vy, vz: msg.vz,
      yaw: msg.yaw,
      pitch: typeof msg.pitch === 'number' ? msg.pitch : undefined,
      medium: typeof msg.medium === 'string' ? msg.medium : 'ground',
      action_id: typeof msg.action_id === 'string' ? msg.action_id : undefined,
      action_t0_ms: typeof msg.action_t0_ms === 'number' ? msg.action_t0_ms : undefined,
      entity_id: typeof msg.entity_id === 'number' ? msg.entity_id : undefined,
      intents: parsePlayerStateIntents(msg.intents),
      input_seq: typeof msg.input_seq === 'number' ? msg.input_seq : undefined,
    };
  }

  if (type === 'swing_result') {
    return {
      type: 'swing_result',
      seq: Number(msg.seq ?? 0),
      entity_id: Number(msg.entity_id ?? 0),
      action_id: String(msg.action_id ?? ''),
      hits: Array.isArray(msg.hits) ? (msg.hits as SwingResultHit[]) : [],
    };
  }

  if (type === 'swing_error') {
    return {
      type: 'swing_error',
      error: String(msg.error ?? 'unknown'),
      action_id: typeof msg.action_id === 'string' ? msg.action_id : undefined,
      seq: typeof msg.seq === 'number' ? msg.seq : undefined,
    };
  }

  const terrain = parseTerrainWsMessage(msg);
  if (terrain) {
    return terrain;
  }

  return null;
}

/**
 * Enruta mensaje WS ya validado al handler correspondiente.
 *
 * **Terreno (Fase 0+):** `terrain_types`, `terrain_chunk`, `terrain_chunk_done` y
 * `particle_destroyed` van a {@link WorldRealtimeHandlers.onWorldEvent} — mutan
 * {@link TerrainStore}, no presencia ni reconciliación.
 *
 * **Presencia/combate:** resto → {@link WorldRealtimeHandlers.onSessionEvent}.
 */
export function dispatchMessage(msg: RealtimeInboundMessage, handlers: WorldRealtimeHandlers): void {
  if (
    msg.type === 'particle_destroyed' ||
    msg.type === 'terrain_types' ||
    msg.type === 'terrain_chunk' ||
    msg.type === 'terrain_chunk_done'
  ) {
    handlers.onWorldEvent(msg);
    return;
  }
  handlers.onSessionEvent?.(msg);
}
