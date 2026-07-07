/**
 * @file Contratos de jugadores remotos (interpolación de `player_state`).
 */

/** Snapshot mínimo para el buffer (posición autoritativa + llegada WS). */
export interface RemoteSnapshot {
  serverTick: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  receivedAtMs: number;
}

/** Export `RemoteRenderState` — remote render state. */
export interface RemoteRenderState {
  x: number;
  y: number;
  z: number;
  yaw: number;
}
