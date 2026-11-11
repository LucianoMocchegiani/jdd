/**
 * @file Posición inicial del jugador sobre sólido visible.
 */

import type { Particle, ParticleType } from '@/types/particle';
import { particleColumnIndex } from '@/game/terrain/particle-cell';

/**
 * Altura Z (celdas) para pararse sobre el sólido más alto en (x, y).
 */
export function findSpawnZ(
  particles: readonly Particle[],
  centerX: number,
  centerY: number,
  typesByNombre: ReadonlyMap<string, ParticleType>,
): number {
  const fx = particleColumnIndex(centerX);
  const fy = particleColumnIndex(centerY);
  let topSolid = -1;
  for (const p of particles) {
    const tipo = typesByNombre.get(p.tipo_nombre);
    if (
      tipo?.tipo_fisico === 'solido' &&
      p.celda_x === fx &&
      p.celda_y === fy
    ) {
      topSolid = Math.max(topSolid, p.celda_z);
    }
  }
  return topSolid >= 0 ? topSolid + 1 : 2;
}
