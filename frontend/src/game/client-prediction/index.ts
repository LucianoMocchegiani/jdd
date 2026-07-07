/**
 * @file Barrel: predicción cliente y reconciliación.
 */

export {
  formatReconciliationToggleHudLine,
  isReconciliationEnabled,
  RECONCILE_BLEND_DIST_CELLS,
  RECONCILE_FIXED_DT_SEC,
  RECONCILE_MAX_REPLAY_TICKS,
  RECONCILE_MEDIUM_FORCE_SNAP,
  RECONCILE_SNAP_DIST_CELLS,
  RECONCILIATION_ENABLED_BY_DEFAULT,
} from '@/game-data/reconciliation';

/** Re-export de símbolos del módulo. */
export { InputHistory } from '@/game/client-prediction/input-history';
/** Re-export de símbolos del módulo. */
export { normalizePlayerState, isSameSnapshot } from '@/game/client-prediction/authoritative-snapshot';
/** Re-export de símbolos del módulo. */
export { LocalPlayerReconciler } from '@/game/client-prediction/local-player-reconciler';
/** Re-export de símbolos del módulo. */
export { PlayerSimulationRunner } from '@/game/client-prediction/replay-runner';
/** Re-export de símbolos del módulo. */
export { RemotePresence } from '@/game/client-prediction/remote-presence';
export {
  RemoteInterpolationBuffer,
  REMOTE_INTERPOLATION_DELAY_SEC,
  lerpAngle,
} from '@/game/client-prediction/remote-interpolation';

/** Re-export de tipos del módulo. */
export type {
  AuthoritativeSnapshot,
  CorrectionMode,
  PendingInput,
  ReconcileResult,
} from '@/types/reconciliation';

/** Re-export de tipos del módulo. */
export type { RemoteRenderState, RemoteSnapshot } from '@/types/remote-player';
