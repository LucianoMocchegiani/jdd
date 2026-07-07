/**
 * @file Contadores de `input` WS + intents en `player_state` (debug multijugador).
 *
 * Activar HUD: `?debug=input-stats` en la URL.
 */

import type { PlayerStateEvent } from '@/types/world-events';

/** Singleton de envíos desde {@link NetworkInputSender}. */
export const inputSentStats = {
  nonemptySent: 0,
  emptySent: 0,
  cameraOnlySent: 0,
};

/** Último snapshot por jugador visto en `player_state` (observador). */
export interface ObservedPlayerIntents {
  playerId: string;
  serverTick: number;
  intents: string[];
  inputSeq: number | null;
  medium: string;
  actionId: string | null;
  x: number;
  y: number;
  z: number;
  updatedAtMs: number;
}

const observedByPlayer = new Map<string, ObservedPlayerIntents>();
let observedStateWithIntents = 0;
let observedStateEmpty = 0;

import { isDebugFlagEnabled } from '@/game/debug/debug-query';

/** `true` si la URL incluye `?debug=input-stats`. */
export function isInputStatsDebugEnabled(): boolean {
  return isDebugFlagEnabled('input-stats');
}

/** Registra un envío WS saliente. */
export function recordInputSent(
  mode: 'active' | 'clear' | 'omit',
  _intents?: Record<string, true>,
): void {
  if (mode === 'active') {
    inputSentStats.nonemptySent += 1;
  } else if (mode === 'clear') {
    inputSentStats.emptySent += 1;
  } else {
    inputSentStats.cameraOnlySent += 1;
  }
}

/** Registra `player_state` entrante (todos los jugadores, incluido el local). */
export function recordObservedPlayerState(event: PlayerStateEvent): void {
  if (!isInputStatsDebugEnabled()) {
    return;
  }
  const intents = event.intents ? Object.keys(event.intents) : [];
  if (intents.length > 0) {
    observedStateWithIntents += 1;
  } else {
    observedStateEmpty += 1;
  }
  observedByPlayer.set(event.player_id, {
    playerId: event.player_id,
    serverTick: event.server_tick,
    intents,
    inputSeq: event.input_seq ?? null,
    medium: event.medium,
    actionId: event.action_id ?? null,
    x: event.x,
    y: event.y,
    z: event.z,
    updatedAtMs: performance.now(),
  });
}

/** Export `BackendInputStats` — backend input stats. */
export interface BackendInputStats {
  nonempty_received: number;
  empty_received: number;
  camera_only_received: number;
  nonempty_sim_ticks: number;
  nonempty_state_broadcasts: number;
  last_input_seq: number;
  last_intents: string[];
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatObservedPlayers(localPlayerId: string): string[] {
  const lines: string[] = ['player_state (observador):'];
  if (observedByPlayer.size === 0) {
    lines.push('  (sin snapshots aún)');
    return lines;
  }
  const sorted = [...observedByPlayer.values()].sort((a, b) =>
    a.playerId.localeCompare(b.playerId),
  );
  for (const row of sorted) {
    const who = row.playerId === localPlayerId ? `${shortId(row.playerId)} (tú)` : shortId(row.playerId);
    const intentsLabel = row.intents.length > 0 ? row.intents.join(', ') : '(ninguno)';
    const seq = row.inputSeq ?? '—';
    const ageSec = ((performance.now() - row.updatedAtMs) / 1000).toFixed(2);
    lines.push(
      `  ${who} tick ${row.serverTick} seq ${seq} · hace ${ageSec}s`,
      `    intents: ${intentsLabel}`,
      `    ${row.medium}${row.actionId ? ` · ${row.actionId}` : ''} · pos ${row.x.toFixed(1)},${row.y.toFixed(1)},${row.z.toFixed(1)}`,
    );
  }
  lines.push(
    `  snapshots ≠{}: ${observedStateWithIntents} / vacíos: ${observedStateEmpty}`,
  );
  return lines;
}

/** Formatea líneas del HUD de comparación front ↔ back ↔ sim ↔ observador. */
export function formatInputStatsHud(
  playerId: string,
  backend: BackendInputStats | null,
): string {
  const front = inputSentStats.nonemptySent;
  const back = backend?.nonempty_received ?? null;
  const sim = backend?.nonempty_sim_ticks ?? null;
  const broadcast = backend?.nonempty_state_broadcasts ?? null;

  const delta =
    back === null ? null : front - back;
  const deltaLine =
    delta === null
      ? 'Δ enviados-recibidos: —'
      : delta === 0
        ? 'Δ enviados-recibidos: 0 ✓'
        : `Δ enviados-recibidos: ${delta > 0 ? '+' : ''}${delta}`;

  const lines = [
    'input con intents (≠ {}):',
    `  front enviados:     ${front}`,
    `  back recibidos:     ${back ?? '—'}`,
    `  back sim ticks:     ${sim ?? '—'}`,
    `  back → player_state: ${broadcast ?? '—'}`,
    `  ${deltaLine}`,
    `  (clear {}: front ${inputSentStats.emptySent} / back ${backend?.empty_received ?? '—'})`,
    `  (solo cámara: front ${inputSentStats.cameraOnlySent} / back ${backend?.camera_only_received ?? '—'})`,
    `  back último seq: ${backend?.last_input_seq ?? '—'} [${(backend?.last_intents ?? []).join(', ') || '—'}]`,
    '',
    ...formatObservedPlayers(playerId),
  ];
  return lines.join('\n');
}

/** Muestra u oculta el panel según el query param. */
export function bindInputStatsHud(el: HTMLElement | null): void {
  if (!el) {
    return;
  }
  el.hidden = !isInputStatsDebugEnabled();
  if (el.hidden) {
    return;
  }
  el.textContent = 'input stats: esperando…';
}

/** Poll al backend cada ~1 s. */
export async function fetchBackendInputStats(
  apiBase: string,
  playerId: string,
): Promise<BackendInputStats | null> {
  try {
    const url = `${apiBase}/debug/input-stats?player_id=${encodeURIComponent(playerId)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as BackendInputStats & { last_intents?: string[] };
    return {
      nonempty_received: Number(data.nonempty_received ?? 0),
      empty_received: Number(data.empty_received ?? 0),
      camera_only_received: Number(data.camera_only_received ?? 0),
      nonempty_sim_ticks: Number(data.nonempty_sim_ticks ?? 0),
      nonempty_state_broadcasts: Number(data.nonempty_state_broadcasts ?? 0),
      last_input_seq: Number(data.last_input_seq ?? 0),
      last_intents: Array.isArray(data.last_intents) ? data.last_intents : [],
    };
  } catch {
    return null;
  }
}
