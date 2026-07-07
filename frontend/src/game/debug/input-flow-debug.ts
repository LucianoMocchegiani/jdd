/**
 * @file Logs del flujo input → intents → movimiento.
 */

import { isMovementDebugEnabled } from '@/game/debug/movement-debug';

/** Tecla pulsada o soltada. */
export function logInputKey(
  event: 'down' | 'up' | 'blur',
  code: string,
  held: string[],
): void {
  if (!isMovementDebugEnabled()) {
    return;
  }
  console.log(`[input:key] ${event}`, code, `| held(${held.length}):`, held);
}

/** Intents escritos en {@link InputComponent} este frame. */
export function logInputIntents(
  entityId: number,
  intents: Record<string, boolean>,
  held: string[],
): void {
  if (!isMovementDebugEnabled()) {
    return;
  }
  const active = Object.entries(intents)
    .filter(([, on]) => on)
    .map(([name]) => name);
  if (active.length === 0 && held.length === 0) {
    return;
  }
  console.log('[input:intents]', { entityId, active, held });
}

/** Velocidad calculada antes de integrar. */
export function logMovementVelocity(
  entityId: number,
  velocity: { vx: number; vy: number; vz: number },
  speed: number,
  onGround: boolean,
  activeIntents: string[],
): void {
  if (!isMovementDebugEnabled()) {
    return;
  }
  if (activeIntents.length === 0) {
    return;
  }
  console.log('[movement:vel]', { entityId, velocity, speed, onGround, activeIntents });
}

/** Integración de un eje (éxito o bloqueo). */
export function logMovementApply(
  axis: 'x' | 'y' | 'z',
  delta: number,
  before: { x: number; y: number; z: number },
  after: { x: number; y: number; z: number },
  blocked: boolean,
): void {
  if (!isMovementDebugEnabled()) {
    return;
  }
  if (delta === 0) {
    return;
  }
  console.log('[movement:apply]', {
    axis,
    delta: delta.toFixed(4),
    before,
    after,
    blocked,
  });
}
