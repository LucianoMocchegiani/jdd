/**
 * @file Política snap / blend / skip para reconciliación.
 */

import {
  RECONCILE_BLEND_DIST_CELLS,
  RECONCILE_MEDIUM_FORCE_SNAP,
  RECONCILE_SNAP_DIST_CELLS,
} from '@/game-data/reconciliation';
import type { AuthoritativeSnapshot, CorrectionMode } from '@/types/reconciliation';
import type { Medium } from '@/types/medium';

/** Export `LocalSimState` — local sim state. */
export interface LocalSimState {
  x: number;
  y: number;
  z: number;
  medium: Medium;
}

/** Export `decideCorrectionMode` — decide correction mode. */
export function decideCorrectionMode(
  local: LocalSimState,
  server: AuthoritativeSnapshot,
): { mode: CorrectionMode; reason: string } {
  const dx = local.x - server.x;
  const dy = local.y - server.y;
  const dz = local.z - server.z;
  const dist = Math.hypot(dx, dy, dz);

  if (RECONCILE_MEDIUM_FORCE_SNAP && local.medium !== server.medium) {
    return {
      mode: 'snap',
      reason: `medium local=${local.medium} server=${server.medium}`,
    };
  }

  if (dist > RECONCILE_SNAP_DIST_CELLS) {
    return { mode: 'snap', reason: `|Δpos|=${dist.toFixed(2)} celdas` };
  }

  if (dist <= RECONCILE_BLEND_DIST_CELLS) {
    return { mode: 'skip', reason: `|Δpos|=${dist.toFixed(3)} ≤ blend` };
  }

  return { mode: 'blend', reason: `|Δpos|=${dist.toFixed(2)} blend` };
}
