/**
 * @file Buffer e interpolación de `player_state` para jugadores remotos (Sprint D4).
 *
 * El servidor emite ~{@link NETWORK_SIM_HZ} Hz; el cliente renderiza ~60 fps.
 * Retrasamos el muestreo {@link REMOTE_INTERPOLATION_DELAY_SEC} para tener dos
 * snapshots entre los que interpolar; si no hay par, extrapolamos con velocidad acotada.
 */

import { NETWORK_SIM_HZ } from '@/game-data/game-config';
import type { RemoteRenderState, RemoteSnapshot } from '@/types/remote-player';

/** Retraso de render respecto al último snapshot (segundos). ~3 ticks a 30 Hz. */
export const REMOTE_INTERPOLATION_DELAY_SEC = 1 / NETWORK_SIM_HZ + 0.04;

/** Tope de extrapolación cuando aún no llega el siguiente snapshot. */
export const REMOTE_MAX_EXTRAPOLATION_SEC = 2 / NETWORK_SIM_HZ;

/** Snapshots guardados por jugador remoto. */
export const REMOTE_SNAPSHOT_BUFFER_SIZE = 32;

/** Export `lerp` — lerp. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolación angular por el arco más corto. */
export function lerpAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return from + delta * t;
}

function extrapolate(snapshot: RemoteSnapshot, elapsedSec: number): RemoteRenderState {
  const dt = Math.min(Math.max(elapsedSec, 0), REMOTE_MAX_EXTRAPOLATION_SEC);
  return {
    x: snapshot.x + snapshot.vx * dt,
    y: snapshot.y + snapshot.vy * dt,
    z: snapshot.z + snapshot.vz * dt,
    yaw: snapshot.yaw,
  };
}

/**
 * Buffer temporal por `player_id` remoto.
 */
export class RemoteInterpolationBuffer {
  private snapshots: RemoteSnapshot[] = [];

  push(snapshot: RemoteSnapshot): void {
    const last = this.snapshots[this.snapshots.length - 1];
    if (last && last.serverTick === snapshot.serverTick) {
      this.snapshots[this.snapshots.length - 1] = snapshot;
      return;
    }
    if (last && snapshot.serverTick < last.serverTick) {
      if (last.serverTick - snapshot.serverTick > REMOTE_SNAPSHOT_BUFFER_SIZE) {
        return;
      }
      const idx = this.snapshots.findIndex((s) => s.serverTick > snapshot.serverTick);
      if (idx >= 0) {
        this.snapshots.splice(idx, 0, snapshot);
      } else {
        this.snapshots.unshift(snapshot);
      }
    } else {
      this.snapshots.push(snapshot);
    }
    while (this.snapshots.length > REMOTE_SNAPSHOT_BUFFER_SIZE) {
      this.snapshots.shift();
    }
  }

  clear(): void {
    this.snapshots = [];
  }

  get snapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * Estado de presentación en `nowMs` (epoch ms, p. ej. `performance.now()`).
   */
  sample(nowMs: number): RemoteRenderState | null {
    if (this.snapshots.length === 0) {
      return null;
    }

    const renderTimeMs = nowMs - REMOTE_INTERPOLATION_DELAY_SEC * 1000;

    if (this.snapshots.length === 1) {
      const only = this.snapshots[0]!;
      return extrapolate(only, (nowMs - only.receivedAtMs) / 1000);
    }

    for (let i = 0; i < this.snapshots.length - 1; i += 1) {
      const a = this.snapshots[i]!;
      const b = this.snapshots[i + 1]!;
      if (a.receivedAtMs <= renderTimeMs && b.receivedAtMs >= renderTimeMs) {
        const span = b.receivedAtMs - a.receivedAtMs;
        const t = span > 1e-6 ? (renderTimeMs - a.receivedAtMs) / span : 1;
        return {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          z: lerp(a.z, b.z, t),
          yaw: lerpAngle(a.yaw, b.yaw, t),
        };
      }
    }

    const newest = this.snapshots[this.snapshots.length - 1]!;
    if (renderTimeMs >= newest.receivedAtMs) {
      return extrapolate(newest, (renderTimeMs - newest.receivedAtMs) / 1000);
    }

    const oldest = this.snapshots[0]!;
    return {
      x: oldest.x,
      y: oldest.y,
      z: oldest.z,
      yaw: oldest.yaw,
    };
  }
}
