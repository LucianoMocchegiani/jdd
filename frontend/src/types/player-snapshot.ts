/**
 * @file Contratos para interpolar snapshots autoritativos de jugadores.
 */

/** Snapshot mínimo para el buffer (posición autoritativa + llegada WS). */
export interface PlayerSnapshot {
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

/** Estado de presentación interpolado o extrapolado. */
export interface PlayerRenderState {
  x: number;
  y: number;
  z: number;
  yaw: number;
}
