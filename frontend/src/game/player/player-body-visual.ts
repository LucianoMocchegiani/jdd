/**
 * @file Dimensiones del marcador cubo del jugador (local y remoto).
 */

import { BoxGeometry, Mesh, type Material } from 'three';

/** Escala del cuerpo respecto a `cellSize` (ancho, alto, profundidad). */
export const PLAYER_BODY_CELL_SCALE = {
  width: 0.5,
  height: 1.8,
  depth: 0.85,
  /** Centro del mesh sobre el grupo (pies en y=0 del grupo). */
  pivotY: 0.9,
} as const;

/** Crea la geometría compartida local/remoto. */
export function createPlayerBodyGeometry(cellSize: number): BoxGeometry {
  const s = PLAYER_BODY_CELL_SCALE;
  return new BoxGeometry(
    cellSize * s.width,
    cellSize * s.height,
    cellSize * s.depth,
  );
}

/** Mesh del cuerpo con material dado. */
export function createPlayerBodyMesh(cellSize: number, material: Material): Mesh {
  const mesh = new Mesh(createPlayerBodyGeometry(cellSize), material);
  mesh.position.y = cellSize * PLAYER_BODY_CELL_SCALE.pivotY;
  return mesh;
}
