/**
 * @file Orientación horizontal del personaje en el plano X/Y (celdas).
 */

import { Component } from '@/ecs/core';

/**
 * Yaw en radianes (convención de órbita). **W** en planta usa la vista `(-sin, -cos)`; ver `cameraPlanarForwardUnit` en `movement-relative.ts`.
 *
 * En `third_person` lo actualiza {@link CameraController}; en `inspect` queda congelado.
 */
export class FacingComponent extends Component {
  readonly type = 'facing';

  constructor(public yaw = 0) {
    super();
  }
}
