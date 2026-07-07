/**
 * @file Componente de posición en celdas del mundo.
 */

import { Component } from '@/ecs/core';

/**
 * Posición de una entidad en coordenadas de celda (no metros).
 */
export class PositionComponent extends Component {
  readonly type = 'position';

  /**
   * @param x - Celda X
   * @param y - Celda Y
   * @param z - Celda Z
   */
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {
    super();
  }
}
