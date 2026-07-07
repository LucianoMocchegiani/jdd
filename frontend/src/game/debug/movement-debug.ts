/**
 * @file Depuración de movimiento: HUD en pantalla + consola.
 */

/** `true` por defecto; desactivar con `?debug=movement-off`. */
export function isMovementDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') !== 'movement-off';
}

/** Export `MovementDebugSnapshot` — movement debug snapshot. */
export interface MovementDebugSnapshot {
  entityId: number;
  pos: { x: number; y: number; z: number };
  cell: { x: number; y: number; z: number };
  medium: string;
  dominantTipo: string | null;
  onGround: boolean;
  activeIntents: string[];
  velocity: { vx: number; vy: number; vz: number };
  deltaTime: number;
  solidBelowFeet: boolean;
  bodyBlockedAtCell: boolean;
  solidAtFeet: boolean;
  solidAtHead: boolean;
  occupiedSolidCount: number;
  entityCount: number;
  heldKeys: string[];
}

/** Export `AxisBlockInfo` — axis block info. */
export interface AxisBlockInfo {
  axis: 'x' | 'y' | 'z';
  delta: number;
  targetCell: { x: number; y: number; z: number };
  solidFeet: boolean;
  solidHead: boolean;
}

let hudMovementEl: HTMLElement | null = null;
let lastSnapshotLogMs = 0;
let lastLoggedIntents = '';

const SNAPSHOT_INTERVAL_MS = 400;

/** Panel `#debug-movement` (texto en pantalla). */
export function setMovementDebugHud(el: HTMLElement | null): void {
  hudMovementEl = el;
}

function formatHud(snapshot: MovementDebugSnapshot): string {
  const intents =
    snapshot.activeIntents.length > 0 ? snapshot.activeIntents.join(', ') : '(ninguno)';
  const keys =
    snapshot.heldKeys.length > 0 ? snapshot.heldKeys.join(', ') : '(ninguna)';
  const blocked = snapshot.bodyBlockedAtCell ? 'SÍ' : 'no';
  return [
    `keys: ${keys}`,
    `pos ${snapshot.pos.x.toFixed(1)},${snapshot.pos.y.toFixed(1)},${snapshot.pos.z.toFixed(1)}`,
    `vel ${snapshot.velocity.vx.toFixed(1)},${snapshot.velocity.vy.toFixed(1)},${snapshot.velocity.vz.toFixed(1)}`,
    `suelo:${snapshot.onGround ? 'sí' : 'no'} · bloqueado:${blocked}`,
    `pies:${snapshot.solidAtFeet ? 'S' : '.'} cabeza:${snapshot.solidAtHead ? 'S' : '.'} · sólidos:${snapshot.occupiedSolidCount}`,
    `intents: ${intents}`,
  ].join('\n');
}

/**
 * Actualiza HUD y consola (consola más a menudo si hay input).
 */
export function logMovementSnapshot(snapshot: MovementDebugSnapshot): void {
  if (!isMovementDebugEnabled()) {
    return;
  }

  if (hudMovementEl) {
    hudMovementEl.textContent = formatHud(snapshot);
  }

  const intentsKey = snapshot.activeIntents.join('|');
  const hasInput = snapshot.activeIntents.length > 0;
  const now = performance.now();
  const shouldLogConsole =
    hasInput ||
    intentsKey !== lastLoggedIntents ||
    now - lastSnapshotLogMs >= SNAPSHOT_INTERVAL_MS;

  if (!shouldLogConsole) {
    return;
  }

  lastSnapshotLogMs = now;
  lastLoggedIntents = intentsKey;
  console.log('[movement:state]', snapshot);
}

/** Export `logAxisBlocked` — log axis blocked. */
export function logAxisBlocked(block: AxisBlockInfo): void {
  if (!isMovementDebugEnabled()) {
    return;
  }
  const msg = `[movement:blocked] ${block.axis} Δ${block.delta.toFixed(3)} cel(${block.targetCell.x},${block.targetCell.y},${block.targetCell.z}) pies:${block.solidFeet} cabeza:${block.solidHead}`;
  console.warn(msg);
  if (hudMovementEl) {
    hudMovementEl.textContent += `\n⚠ ${msg}`;
  }
}

/** Export `logMovementWarn` — log movement warn. */
export function logMovementWarn(message: string, detail?: unknown): void {
  if (!isMovementDebugEnabled()) {
    return;
  }
  console.warn('[movement]', message, detail ?? '');
  if (hudMovementEl) {
    hudMovementEl.textContent = `⚠ ${message}`;
  }
}
