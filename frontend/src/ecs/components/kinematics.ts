/**
 * @file Estado de movimiento en celdas (velocidad; sin flags de contacto).
 */

import { Component } from '@/ecs/core';

/**
 * Velocidad del cuerpo en espacio de celdas.
 * Apoyo y salto → {@link ContactComponent} (`medium === 'ground'`).
 */
export class KinematicsComponent extends Component {
  readonly type = 'kinematics';

  constructor(
    public vx = 0,
    public vy = 0,
    public vz = 0,
  ) {
    super();
  }
}
