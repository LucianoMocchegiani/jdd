/**
 * @file Configuración de reconciliación cliente-servidor (Sprint D).
 *
 * Toggle debug — desactivar para aislar predicción pura vs fantasma magenta:
 *
 * - `?debug=reconcile-off`
 * - `?debug=pos-sync,reconcile-off`
 * - `?reconcile=off`
 */

import { NETWORK_SIM_HZ } from '@/game-data/game-config';

/** Reconciliación activa por defecto (comportamiento de producción). */
export const RECONCILIATION_ENABLED_BY_DEFAULT = true;

/** Distancia (celdas) por encima de la cual: snap + replay. */
export const RECONCILE_SNAP_DIST_CELLS = 0.5;

/** Distancia (celdas) por debajo de la cual: ignorar o blend suave (D1). */
export const RECONCILE_BLEND_DIST_CELLS = 0.15;

/** Máximo de ticks de replay tras un snap (evita lag spikes). */
export const RECONCILE_MAX_REPLAY_TICKS = 10;

/** Si `medium` local ≠ server → snap forzado. */
export const RECONCILE_MEDIUM_FORCE_SNAP = true;

/** Delta fijo por tick de replay (espejo loop server ~30 Hz). */
export const RECONCILE_FIXED_DT_SEC = 1 / NETWORK_SIM_HZ;

function parseDebugFlags(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = new URLSearchParams(window.location.search).get('debug') ?? '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * `true` por defecto. `false` con `?debug=reconcile-off` o `?reconcile=off`.
 *
 * El reconciler debe consultar esto al inicio de `onPlayerState` / `applyPending`.
 */
export function isReconciliationEnabled(): boolean {
  if (!RECONCILIATION_ENABLED_BY_DEFAULT) {
    return false;
  }
  if (typeof window === 'undefined') {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  const reconcile = params.get('reconcile')?.trim().toLowerCase();
  if (reconcile === 'off' || reconcile === '0' || reconcile === 'false') {
    return false;
  }
  return !parseDebugFlags().includes('reconcile-off');
}

/** Línea opcional para HUD `?debug=pos-sync`. */
export function formatReconciliationToggleHudLine(): string {
  return isReconciliationEnabled()
    ? '  reconciliación: activa'
    : '  reconciliación: OFF (solo predicción; ?debug=reconcile-off)';
}
