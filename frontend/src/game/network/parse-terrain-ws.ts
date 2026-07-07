/**
 * @file Parseo defensivo de mensajes WebSocket de terreno (Fase 0).
 *
 * Valida JSON entrante del server antes de mutar {@link TerrainStore} en el cliente.
 * Espejo de `backend/src/game/network/terrain_ws_messages.py`.
 *
 * **Integración**
 * - {@link parseInboundMessage} en `ws-dispatcher.ts` llama aquí tras `JSON.parse`.
 * - Mensajes válidos se enrutan a `onWorldEvent` (no a `onSessionEvent`).
 * - Fase 1: `app.ts` → `terrain.applyTerrainWsEvent(event)`.
 *
 * **Política fail-closed**
 * Si un elemento de `particles[]` o `types[]` es inválido, se rechaza **todo** el mensaje
 * (`null`). Evita índices de colisión a medias.
 *
 * @see {@link TerrainWsEvent} — tipos en `world-events.ts`
 * @see `instructions/notes/terreno-ws.md`
 */

import type {
  TerrainChunkDoneEvent,
  TerrainChunkEvent,
  TerrainTypesEvent,
  TerrainWsEvent,
  TerrainWsParticle,
  TerrainWsPhysicsType,
  TerrainWsTypeEntry,
} from '@/types/world-events';

/** Valores permitidos de `tipo_fisico` en wire terreno. */
const PHYSICS_TYPES: ReadonlySet<TerrainWsPhysicsType> = new Set([
  'solido',
  'liquido',
  'gas',
  'energia',
]);

/**
 * Type guard para {@link TerrainWsPhysicsType}.
 * @param value - Valor crudo del JSON.
 */
function isPhysicsType(value: unknown): value is TerrainWsPhysicsType {
  return typeof value === 'string' && PHYSICS_TYPES.has(value as TerrainWsPhysicsType);
}

/**
 * Parsea un elemento de `terrain_chunk.particles[]`.
 * @param raw - Objeto JSON de una partícula.
 * @returns Partícula tipada o `null` si falta campo o `tipo_fisico` inválido.
 */
function parseTerrainWsParticle(raw: unknown): TerrainWsParticle | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (
    typeof p.id !== 'string' ||
    typeof p.x !== 'number' ||
    typeof p.y !== 'number' ||
    typeof p.z !== 'number' ||
    typeof p.tipo_nombre !== 'string' ||
    !isPhysicsType(p.tipo_fisico)
  ) {
    return null;
  }
  return {
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
    tipo_nombre: p.tipo_nombre,
    tipo_fisico: p.tipo_fisico,
  };
}

/**
 * Parsea un elemento de `terrain_types.types[]`.
 * @param raw - Objeto JSON de un tipo de partícula.
 */
function parseTerrainTypeEntry(raw: unknown): TerrainWsTypeEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.nombre !== 'string' || !isPhysicsType(t.tipo_fisico)) return null;
  return {
    nombre: t.nombre,
    tipo_fisico: t.tipo_fisico,
    color: typeof t.color === 'string' || t.color === null ? t.color : undefined,
    viscosidad: typeof t.viscosidad === 'number' ? t.viscosidad : undefined,
    opacidad: typeof t.opacidad === 'number' ? t.opacidad : undefined,
  };
}

/**
 * Parsea un mensaje WS de terreno (`terrain_types`, `terrain_chunk`, `terrain_chunk_done`).
 *
 * @param raw - Objeto ya parseado desde JSON (p. ej. en `ws-client.onmessage`).
 * @returns Evento tipado listo para {@link WorldEvent}, o `null` si no es terreno o falla validación.
 *
 * @example
 * ```ts
 * const event = parseTerrainWsMessage(JSON.parse(data));
 * if (event?.type === 'terrain_chunk') {
 *   terrainStore.mergeChunk(event);
 * }
 * ```
 */
export function parseTerrainWsMessage(raw: unknown): TerrainWsEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw as Record<string, unknown>;
  const type = msg.type;
  if (typeof type !== 'string') return null;

  if (type === 'terrain_types') {
    if (typeof msg.bloque_id !== 'string' || !Array.isArray(msg.types)) return null;
    const types: TerrainWsTypeEntry[] = [];
    for (const entry of msg.types) {
      const parsed = parseTerrainTypeEntry(entry);
      if (!parsed) return null;
      types.push(parsed);
    }
    return { type: 'terrain_types', bloque_id: msg.bloque_id, types };
  }

  if (type === 'terrain_chunk') {
    if (
      typeof msg.bloque_id !== 'string' ||
      typeof msg.chunk_cx !== 'number' ||
      typeof msg.chunk_cy !== 'number' ||
      typeof msg.z_min !== 'number' ||
      typeof msg.z_max !== 'number' ||
      typeof msg.seq !== 'number' ||
      !Array.isArray(msg.particles)
    ) {
      return null;
    }
    const particles: TerrainWsParticle[] = [];
    for (const entry of msg.particles) {
      const parsed = parseTerrainWsParticle(entry);
      if (!parsed) return null;
      particles.push(parsed);
    }
    return {
      type: 'terrain_chunk',
      bloque_id: msg.bloque_id,
      chunk_cx: msg.chunk_cx,
      chunk_cy: msg.chunk_cy,
      z_min: msg.z_min,
      z_max: msg.z_max,
      seq: msg.seq,
      particles,
    };
  }

  if (type === 'terrain_chunk_done') {
    if (typeof msg.bloque_id !== 'string' || typeof msg.seq !== 'number') {
      return null;
    }
    const event: TerrainChunkDoneEvent = {
      type: 'terrain_chunk_done',
      bloque_id: msg.bloque_id,
      seq: msg.seq,
    };
    if (typeof msg.chunks_sent === 'number') {
      event.chunks_sent = msg.chunks_sent;
    }
    return event;
  }

  return null;
}

/** Re-export de tipos del módulo. */
export type { TerrainChunkEvent, TerrainChunkDoneEvent, TerrainTypesEvent };
