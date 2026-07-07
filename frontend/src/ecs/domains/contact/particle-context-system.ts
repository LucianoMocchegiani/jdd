/**
 * @file Sistema de contacto: `medium` + tipo dominante desde partículas en radio.
 */

import { CONTACT_SAMPLE_RADIUS_CELLS } from '@/game-data/game-config';
import { ContactComponent } from '@/ecs/components/contact';
import { PositionComponent } from '@/ecs/components/position';
import { System } from '@/ecs/core';
import { sampleContactContext } from '@/ecs/domains/contact/resolve-medium';
import type { TerrainStore } from '@/game/terrain/terrain-store';

/**
 * Único sistema que interpreta partículas del viewport para locomoción (`contact`).
 */
export class ParticleContextSystem extends System {
  readonly priority = 10;
  readonly requiredComponents = ['position', 'contact'] as const;

  /**
   * @param terrain - Partículas y tipos del viewport cargado
   * @param onMediumChange - Callback opcional para debug UI
   */
  constructor(
    private readonly terrain: TerrainStore,
    private readonly onMediumChange?: (text: string) => void,
  ) {
    super();
  }

  override update(_deltaTime: number): void {
    const types = this.terrain.getTypesByNombre();

    for (const entityId of this.getEntities()) {
      const pos = this.world?.getComponent<PositionComponent>(entityId, 'position');
      const contactComp = this.world?.getComponent<ContactComponent>(entityId, 'contact');
      if (!pos || !contactComp) {
        continue;
      }

      const nearby = this.terrain.getParticlesInRadius(
        pos.x,
        pos.y,
        pos.z,
        CONTACT_SAMPLE_RADIUS_CELLS,
      );
      const ctx = sampleContactContext(
        nearby,
        types,
        pos.x,
        pos.y,
        pos.z,
        CONTACT_SAMPLE_RADIUS_CELLS,
        { solidGrid: this.terrain },
      );

      contactComp.medium = ctx.medium;
      contactComp.dominantTipoNombre = ctx.dominantTipoNombre;
      contactComp.dominantTipoParticulaId = ctx.dominantTipoParticulaId;

      const label = ctx.dominantTipoNombre
        ? `medium: ${ctx.medium} · ${ctx.dominantTipoNombre}`
        : `medium: ${ctx.medium}`;
      this.onMediumChange?.(label);
    }
  }
}
