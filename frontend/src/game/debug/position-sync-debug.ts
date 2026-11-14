/**
 * @file Comparación de la presentación local con `player_state` del servidor.
 *
 * Activar: `?debug=pos-sync` o `?debug=pos-sync,input-stats`.
 */

import { isDebugFlagEnabled } from '@/game/debug/debug-query';
import { PlayerCharacterVisual } from '@/game/player/player-character-visual';
import { selectRemoteClip } from '@/game/player/remote-animation';
import type { PlayerStateEvent } from '@/types/world-events';
import type { Scene } from 'three';

/** Export `AuthoritativeSnapshot` — authoritative snapshot. */
export interface AuthoritativeSnapshot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  medium: string;
  yaw: number;
  serverTick: number;
  inputSeq: number | null;
  intents: Record<string, boolean>;
  receivedAtMs: number;
}

let authoritative: AuthoritativeSnapshot | null = null;
let serverGhost: PlayerCharacterVisual | null = null;
let lastServerTick = -1;
let lastTickAdvanceAtMs = 0;
let staleSnapshotCount = 0;

/** Export `isPositionSyncDebugEnabled` — is position sync debug enabled. */
export function isPositionSyncDebugEnabled(): boolean {
  return isDebugFlagEnabled('pos-sync');
}

/** Actualiza snapshot cuando llega `player_state` del jugador local. */
export function ingestLocalPlayerState(
  event: PlayerStateEvent,
  localPlayerId: string,
): void {
  if (!isPositionSyncDebugEnabled() || event.player_id !== localPlayerId) {
    return;
  }
  const nowMs = event.receivedAtMs ?? performance.now();
  if (event.server_tick !== lastServerTick) {
    lastServerTick = event.server_tick;
    lastTickAdvanceAtMs = nowMs;
  }

  const prev = authoritative;
  authoritative = {
    x: event.x,
    y: event.y,
    z: event.z,
    vx: event.vx,
    vy: event.vy,
    vz: event.vz,
    medium: event.medium,
    yaw: event.yaw,
    serverTick: event.server_tick,
    inputSeq: event.input_seq ?? null,
    intents: event.intents ?? {},
    receivedAtMs: nowMs,
  };
  if (
    prev &&
    Math.hypot(prev.x - event.x, prev.y - event.y, prev.z - event.z) < 1e-4 &&
    (event.vx ** 2 + event.vy ** 2 + event.vz ** 2) < 1e-6
  ) {
    staleSnapshotCount += 1;
  } else {
    staleSnapshotCount = 0;
  }
  if (serverGhost) {
    syncServerGhost(serverGhost, authoritative, prev ? Math.max(0, (nowMs - prev.receivedAtMs) / 1000) : 0);
  }
}

/** Personaje semitransparente en la posición, orientación y animación que reporta el servidor. */
export function ensureServerGhost(scene: Scene, cellSize: number): PlayerCharacterVisual | null {
  if (!isPositionSyncDebugEnabled()) {
    return null;
  }
  if (serverGhost) {
    return serverGhost;
  }
  serverGhost = new PlayerCharacterVisual(scene, cellSize);
  serverGhost.setOpacity(0.45);
  if (authoritative) {
    syncServerGhost(serverGhost, authoritative, 0);
  }
  return serverGhost;
}

function syncServerGhost(
  character: PlayerCharacterVisual,
  state: AuthoritativeSnapshot,
  deltaTime: number,
): void {
  character.update(
    deltaTime,
    selectRemoteClip(state),
    state.x,
    state.y,
    state.z,
    state.yaw,
    0xe879f9,
  );
}

/** Export `formatPositionSyncHud` — format position sync hud. */
export function formatPositionSyncHud(
  localX: number,
  localY: number,
  localZ: number,
  client?: {
    lastRxAgeSec: number | null;
    lastAppliedAgeSec: number | null;
    maxRxGapMs: number;
    rxPerSec: number;
    terrainRebuilding: boolean;
    localMedium?: string | null;
  },
): string {
  if (!authoritative) {
    return [
      'pos sync (local vs servidor):',
      '  local:  esperando…',
      '  server: (sin player_state aún)',
    ].join('\n');
  }

  const dx = localX - authoritative.x;
  const dy = localY - authoritative.y;
  const dz = localZ - authoritative.z;
  const dist = Math.hypot(dx, dy, dz);
  const nowMs = performance.now();
  const ageSec = (nowMs - authoritative.receivedAtMs) / 1000;
  const tickAgeSec =
    lastTickAdvanceAtMs > 0 ? (nowMs - lastTickAdvanceAtMs) / 1000 : ageSec;
  const intents =
    Object.keys(authoritative.intents).length > 0 ? Object.keys(authoritative.intents).join(', ') : '(ninguno)';

  const diag: string[] = [];
  const rxAge = client?.lastRxAgeSec;
  const appliedAge = client?.lastAppliedAgeSec;
  const maxGap = client?.maxRxGapMs ?? 0;
  const rxRate = client?.rxPerSec ?? 0;

  if (client?.terrainRebuilding) {
    diag.push('⚙ rebuild terreno en curso');
  }

  // Servidor ~30 Hz → gap normal ~33 ms; aviso si >350 ms sin mensaje WS en el browser.
  if (rxAge != null && rxAge > 0.35) {
    diag.push(`⚠ WS sin llegar al browser hace ${rxAge.toFixed(2)}s (red/servidor/main thread)`);
  } else if (appliedAge != null && appliedAge > 0.35 && rxAge != null && rxAge <= 0.15) {
    diag.push('⚠ WS llega pero no se aplica → bug drain/ingest');
  } else if (ageSec > 0.35) {
    diag.push('⚠ snapshot autoritativo viejo (servidor ~30 Hz; ver gap máx abajo)');
  } else if (staleSnapshotCount >= 3 && dist > 0.3) {
    diag.push('⚠ state llega pero pos/vel servidor fijas → sim o intents parados');
  } else if (tickAgeSec > 0.35 && ageSec <= 0.35) {
    diag.push('⚠ server_tick no avanza → loop de presencia atascado');
  }

  const localMedium = client?.localMedium ?? null;
  const mediumMismatch =
    localMedium != null && localMedium !== authoritative.medium
      ? ` ⚠ local=${localMedium} server=${authoritative.medium}`
      : localMedium != null
        ? ` (local=${localMedium})`
        : '';

  return [
    'pos sync (local vs servidor):',
    `  local:  ${localX.toFixed(2)}, ${localY.toFixed(2)}, ${localZ.toFixed(2)}`,
    `  server: ${authoritative.x.toFixed(2)}, ${authoritative.y.toFixed(2)}, ${authoritative.z.toFixed(2)}`,
    `  Δ: ${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)}  |dist| ${dist.toFixed(2)} celdas`,
    `  server vel: ${authoritative.vx.toFixed(1)}, ${authoritative.vy.toFixed(1)}, ${authoritative.vz.toFixed(1)}`,
    `  tick ${authoritative.serverTick} · seq ${authoritative.inputSeq ?? '—'} · medium server=${authoritative.medium}${mediumMismatch}`,
    `  intents server: ${intents}`,
    `  último state hace ${ageSec.toFixed(2)}s · tick avanzó hace ${tickAgeSec.toFixed(2)}s`,
    client
      ? [
          `  ws rx hace ${rxAge != null ? `${rxAge.toFixed(2)}s` : '—'} · aplicado hace ${appliedAge != null ? `${appliedAge.toFixed(2)}s` : '—'}`,
          `  gap máx rx ${maxGap.toFixed(0)}ms · ~${rxRate}/s (esperado ~30) · rebuild ${client.terrainRebuilding ? 'sí' : 'no'}`,
        ].join('\n')
      : '',
    ...diag.filter(Boolean),
    '  fantasma magenta = rig, animación y orientación del servidor',
  ].join('\n');
}

/** Export `bindPositionSyncHud` — bind position sync hud. */
export function bindPositionSyncHud(el: HTMLElement | null): void {
  if (!el) {
    return;
  }
  el.hidden = !isPositionSyncDebugEnabled();
  if (!el.hidden) {
    el.textContent = 'pos sync: esperando player_state…';
  }
}
