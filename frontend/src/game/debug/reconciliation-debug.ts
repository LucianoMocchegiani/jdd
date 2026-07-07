/**
 * @file Estado de debug expuesto al HUD `?debug=pos-sync`.
 */

import type { CorrectionMode } from '@/types/reconciliation';

/** Export `ReconciliationDebugState` — reconciliation debug state. */
export interface ReconciliationDebugState {
  lastAckedSeq: number;
  lastServerTick: number;
  lastReplayCount: number;
  pendingInputs: number;
  lastMode: CorrectionMode | 'disabled';
  lastReason: string;
}

let state: ReconciliationDebugState = {
  lastAckedSeq: 0,
  lastServerTick: -1,
  lastReplayCount: 0,
  pendingInputs: 0,
  lastMode: 'skip',
  lastReason: '—',
};

/** Export `getReconciliationDebugState` — get reconciliation debug state. */
export function getReconciliationDebugState(): ReconciliationDebugState {
  return { ...state };
}

/** Export `updateReconciliationDebugState` — update reconciliation debug state. */
export function updateReconciliationDebugState(
  patch: Partial<ReconciliationDebugState>,
): void {
  state = { ...state, ...patch };
}

/** Export `formatReconciliationDebugLines` — format reconciliation debug lines. */
export function formatReconciliationDebugLines(): string[] {
  const s = state;
  return [
    `  ack seq ${s.lastAckedSeq} · tick ${s.lastServerTick} · pending ${s.pendingInputs}`,
    `  última corrección: ${s.lastMode} (${s.lastReason}) · replay ${s.lastReplayCount}`,
  ];
}
