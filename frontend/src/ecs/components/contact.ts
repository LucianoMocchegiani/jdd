/**
 * @file Contexto de contacto con el entorno (`medium` + sustancia dominante).
 */

import { Component } from '@/ecs/core';
import type { Medium } from '@/types/medium';

/**
 * Escrito por {@link ParticleContextSystem} a partir de partículas en el radio del jugador.
 */
export class ContactComponent extends Component {
  readonly type = 'contact';

  /**
   * @param medium - Inmersión / soporte actual
   * @param dominantTipoNombre - Material dominante en el radio (`agua`, `lodo`, …)
   * @param dominantTipoParticulaId - Id del tipo en BD, si se resolvió
   */
  constructor(
    public medium: Medium = 'air',
    public dominantTipoNombre: string | null = null,
    public dominantTipoParticulaId: string | null = null,
  ) {
    super();
  }
}
