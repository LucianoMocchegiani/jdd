/**
 * @file Contratos de reconciliación cliente ↔ servidor (Sprint D).
 */

import type { Medium } from '@/types/medium';

/** Input WS ya enviado, pendiente de confirmación por `input_seq` del servidor. */
export interface PendingInput {
  seq: number;
  intents: Record<string, boolean>;
  yaw: number;
  pitch?: number;
  sentAtMs: number;
}

/** Export `CorrectionMode` — correction mode. */
export type CorrectionMode = 'skip' | 'blend' | 'snap';

/** Export `ReconcileResult` — reconcile result. */
export interface ReconcileResult {
  mode: CorrectionMode;
  replayCount: number;
  reason: string;
}

/** Snapshot autoritativo normalizado desde `player_state` del jugador local. */
export interface AuthoritativeSnapshot {
  inputSeq: number;
  serverTick: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  medium: Medium;
  yaw: number;
  pitch?: number;
  receivedAtMs: number;
}
