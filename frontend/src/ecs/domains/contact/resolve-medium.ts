/**
 * @file Resolución de `medium` y tipo dominante a partir de conteos de muestreo.
 *
 * Espejo servidor: `backend/src/ecs/domains/contact/resolve_medium.py`.
 * Refuerza `ground` con grilla de sólidos ({@link SolidGridReader}) cuando el
 * muestreo esférico no ve suelo bajo los pies.
 */

import { MEDIUM_RESOLUTION_ORDER, MEDIUM_RULES } from '@/game-data/medium';
import {
  countsTowardSubmerged,
  resolveContactRule,
  type ParticleFamily,
} from '@/game-data/particles';
import type { ContactContext } from '@/types/contact-context';
import type { Medium } from '@/types/medium';
import type { Particle, ParticleType } from '@/types/particle';

/**
 * Grilla de colisión local (p. ej. {@link TerrainStore.isCellSolid}).
 */
export interface SolidGridReader {
  isCellSolid(x: number, y: number, z: number): boolean;
}

/**
 * Conteos agregados del radio de contacto.
 */
export interface ContactSampleCounts {
  totalSampled: number;
  submergedCount: number;
  solidUnderFeet: number;
  dominantTipoNombre: string | null;
  dominantTipoParticulaId: string | null;
}

/** Export `SampleContactContextOptions` — sample contact context options. */
export interface SampleContactContextOptions {
  /** Grilla de sólidos del viewport; refuerza `ground` bajo los pies. */
  solidGrid?: SolidGridReader | null;
}

/**
 * Celda sólida bajo los pies (misma convención que colisión / servidor).
 */
export function solidUnderFeetFromGrid(
  solidGrid: SolidGridReader,
  centerX: number,
  centerY: number,
  centerZ: number,
): boolean {
  const fx = Math.floor(centerX);
  const fy = Math.floor(centerY);
  const feetZ = Math.floor(centerZ) - 1;
  return solidGrid.isCellSolid(fx, fy, feetZ);
}

/**
 * Si la grilla tiene suelo bajo los pies, fuerza `solidUnderFeet` para resolución de medium.
 */
export function boostGroundFromSolidGrid(
  counts: ContactSampleCounts,
  solidGrid: SolidGridReader | null | undefined,
  centerX: number,
  centerY: number,
  centerZ: number,
): void {
  if (!solidGrid) {
    return;
  }
  const groundMin = MEDIUM_RULES.groundSolidCellsMin;
  if (counts.solidUnderFeet >= groundMin) {
    return;
  }
  if (solidUnderFeetFromGrid(solidGrid, centerX, centerY, centerZ)) {
    counts.solidUnderFeet = groundMin;
  }
}

/**
 * Cuenta partículas en esfera (celdas) y resuelve {@link ContactContext}.
 */
export function sampleContactContext(
  particles: readonly Particle[],
  typesByNombre: ReadonlyMap<string, ParticleType>,
  centerX: number,
  centerY: number,
  centerZ: number,
  radiusCells: number,
  options?: SampleContactContextOptions,
): ContactContext {
  const counts = countContactSamples(
    particles,
    typesByNombre,
    centerX,
    centerY,
    centerZ,
    radiusCells,
  );
  const groundMin = MEDIUM_RULES.groundSolidCellsMin;
  const particleGround = counts.solidUnderFeet >= groundMin;
  boostGroundFromSolidGrid(counts, options?.solidGrid, centerX, centerY, centerZ);
  const medium = resolveMediumFromCounts(counts);

  if (
    medium === 'air' &&
    options?.solidGrid &&
    solidUnderFeetFromGrid(options.solidGrid, centerX, centerY, centerZ) &&
    !particleGround
  ) {
    console.debug(
      '[contact] medium ground vía grilla sólidos (partículas no vieron suelo) pos=(%s,%s,%s) sampled=%d',
      centerX.toFixed(2),
      centerY.toFixed(2),
      centerZ.toFixed(2),
      counts.totalSampled,
    );
  }

  return {
    medium,
    dominantTipoNombre: counts.dominantTipoNombre,
    dominantTipoParticulaId: counts.dominantTipoParticulaId,
  };
}

/**
 * Agrega conteos en el radio (distancia euclídea en celdas).
 */
export function countContactSamples(
  particles: readonly Particle[],
  typesByNombre: ReadonlyMap<string, ParticleType>,
  centerX: number,
  centerY: number,
  centerZ: number,
  radiusCells: number,
): ContactSampleCounts {
  const radiusSq = radiusCells * radiusCells;
  const feetZ = Math.floor(centerZ) - 1;
  const fx = Math.floor(centerX);
  const fy = Math.floor(centerY);
  let submergedCount = 0;
  let solidUnderFeet = 0;
  let totalSampled = 0;
  const tipoCounts = new Map<string, { count: number; id: string }>();

  for (const p of particles) {
    const dx = p.celda_x - centerX;
    const dy = p.celda_y - centerY;
    const dz = p.celda_z - centerZ;
    if (
      Math.abs(dx) > radiusCells ||
      Math.abs(dy) > radiusCells ||
      Math.abs(dz) > radiusCells
    ) {
      continue;
    }
    if (dx * dx + dy * dy + dz * dz > radiusSq) {
      continue;
    }

    totalSampled++;
    const tipo = typesByNombre.get(p.tipo_nombre);
    const rule = tipo ? resolveContactRule(tipo) : null;
    const family: ParticleFamily = rule?.family ?? 'solid';

    if (rule && countsTowardSubmerged(family)) {
      submergedCount++;
    }

    if (
      tipo?.tipo_fisico === 'solido' &&
      p.celda_x === fx &&
      p.celda_y === fy &&
      p.celda_z === feetZ
    ) {
      solidUnderFeet++;
    }

    const prev = tipoCounts.get(p.tipo_nombre);
    if (prev) {
      prev.count++;
    } else {
      tipoCounts.set(p.tipo_nombre, { count: 1, id: p.tipo_particula_id });
    }
  }

  let dominantTipoNombre: string | null = null;
  let dominantTipoParticulaId: string | null = null;
  let best = 0;
  for (const [nombre, data] of tipoCounts) {
    if (data.count > best) {
      best = data.count;
      dominantTipoNombre = nombre;
      dominantTipoParticulaId = data.id;
    }
  }

  return {
    totalSampled,
    submergedCount,
    solidUnderFeet,
    dominantTipoNombre,
    dominantTipoParticulaId,
  };
}

/**
 * Aplica {@link MEDIUM_RULES} y {@link MEDIUM_RESOLUTION_ORDER} (espejo Python).
 */
export function resolveMediumFromCounts(counts: ContactSampleCounts): Medium {
  const groundMin = MEDIUM_RULES.groundSolidCellsMin;

  if (counts.totalSampled > 0) {
    const submergedRatio = counts.submergedCount / counts.totalSampled;
    const checks: Record<Medium, boolean> = {
      submerged_full: submergedRatio >= MEDIUM_RULES.submergedFullRatio,
      submerged_partial: submergedRatio >= MEDIUM_RULES.submergedPartialRatio,
      ground: counts.solidUnderFeet >= groundMin,
      air: true,
    };

    for (const medium of MEDIUM_RESOLUTION_ORDER) {
      if (checks[medium]) {
        return medium;
      }
    }
    return 'air';
  }

  if (counts.solidUnderFeet >= groundMin) {
    return 'ground';
  }
  return 'air';
}

/**
 * Construye el set de celdas sólidas ocupadas (`tipo_fisico === 'solido'`).
 */
export function buildOccupiedSolidCells(
  particles: readonly Particle[],
  typesByNombre: ReadonlyMap<string, ParticleType>,
): Set<string> {
  const set = new Set<string>();
  for (const p of particles) {
    const tipo = typesByNombre.get(p.tipo_nombre);
    if (tipo?.tipo_fisico === 'solido') {
      set.add(`${p.celda_x},${p.celda_y},${p.celda_z}`);
    }
  }
  return set;
}
