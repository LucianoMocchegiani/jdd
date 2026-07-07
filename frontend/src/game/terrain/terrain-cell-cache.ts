/**
 * @file Merge incremental de partículas por celda (terreno WS / Fase 1).
 */

import type { Particle } from '@/types/particle';
import type { TerrainWsParticle } from '@/types/world-events';
import { cellKey } from '@/game/utils/cell-key';

/** Convierte wire compacto a {@link Particle} mínimo para colisión/render. */
export function particleFromWsWire(
  p: TerrainWsParticle,
  bloqueId: string,
): Particle {
  return {
    id: p.id,
    bloque_id: bloqueId,
    celda_x: p.x,
    celda_y: p.y,
    celda_z: p.z,
    tipo: p.tipo_nombre,
    estado: '',
    tipo_nombre: p.tipo_nombre,
    estado_nombre: '',
    tipo_particula_id: '',
    estado_materia_id: '',
    cantidad: 1,
    temperatura: 0,
    energia: 0,
    extraida: false,
    agrupacion_id: null,
    es_nucleo: false,
    propiedades: {},
    creado_en: '',
    modificado_en: '',
    creado_por: null,
  };
}

/** Fusiona partículas en caché por celda (sobrescribe por clave). */
export function mergeParticlesIntoCellCache(
  cache: Map<string, Particle>,
  particles: readonly Particle[],
): void {
  for (const p of particles) {
    cache.set(cellKey(p.celda_x, p.celda_y, p.celda_z), p);
  }
}

/** Partículas en ventana XY centrada + rango Z. */
export function collectParticlesInXYWindow(
  cache: ReadonlyMap<string, Particle>,
  centerX: number,
  centerY: number,
  radiusXY: number,
  zMin: number,
  zMax: number,
): Particle[] {
  const minX = Math.floor(centerX) - radiusXY;
  const maxX = Math.floor(centerX) + radiusXY;
  const minY = Math.floor(centerY) - radiusXY;
  const maxY = Math.floor(centerY) + radiusXY;
  const out: Particle[] = [];
  for (const p of cache.values()) {
    if (
      p.celda_x >= minX &&
      p.celda_x <= maxX &&
      p.celda_y >= minY &&
      p.celda_y <= maxY &&
      p.celda_z >= zMin &&
      p.celda_z <= zMax
    ) {
      out.push(p);
    }
  }
  return out;
}
