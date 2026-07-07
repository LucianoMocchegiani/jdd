/**
 * @file Snapshot autoritativo normalizado desde `player_state` del jugador local.
 */

import type { PlayerStateEvent } from '@/types/world-events';
import { isMediumId } from '@/types/medium';
import type { AuthoritativeSnapshot } from '@/types/reconciliation';

/** Export `normalizePlayerState` — normalize player state. */
export function normalizePlayerState(event: PlayerStateEvent): AuthoritativeSnapshot {
  const mediumRaw = event.medium ?? 'ground';
  return {
    inputSeq: event.input_seq ?? 0,
    serverTick: event.server_tick,
    x: event.x,
    y: event.y,
    z: event.z,
    vx: event.vx,
    vy: event.vy,
    vz: event.vz,
    medium: isMediumId(mediumRaw) ? mediumRaw : 'ground',
    yaw: event.yaw,
    pitch: event.pitch,
    receivedAtMs: event.receivedAtMs ?? performance.now(),
  };
}

/** Export `isSameSnapshot` — is same snapshot. */
export function isSameSnapshot(
  a: AuthoritativeSnapshot,
  b: AuthoritativeSnapshot,
): boolean {
  return a.serverTick === b.serverTick && a.inputSeq === b.inputSeq;
}
