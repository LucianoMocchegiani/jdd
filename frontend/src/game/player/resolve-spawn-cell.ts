/**
 * @file Celda de spawn según dimension/bloque (alineado con seeds de BD).
 */

import type { BloqueDimension } from '@/api/bloques-api';
import { DEV_BASELINE_BLOQUE_NAME } from '@/game-data/game-config';

/**
 * Devuelve celda X/Y de spawn en coordenadas de bloque.
 *
 * @param bloque - Dimensión activa (`GET /bloques`)
 */
export function resolveSpawnCell(bloque: BloqueDimension): { x: number; y: number } {
  const w = Math.floor(bloque.ancho_metros / bloque.tamano_celda);
  const h = Math.floor(bloque.alto_metros / bloque.tamano_celda);
  const ox = Math.floor(bloque.origen_x);
  const oy = Math.floor(bloque.origen_y);

  if (bloque.nombre.includes('Lago y Montaña')) {
    // Pradera SE abierta (seed árboles seed=42 lejos: ~105,32 es el más cercano). Ver seed_terrain_test_2.py.
    return { x: ox + 120, y: oy + 22 };
  }

  if (bloque.nombre.includes('Bosque Denso')) {
    return { x: ox + Math.floor(w * 0.35), y: oy + Math.floor(h * 0.35) };
  }

  if (bloque.nombre.includes(DEV_BASELINE_BLOQUE_NAME)) {
    return { x: ox + Math.floor(w / 2), y: oy + Math.floor(h / 2) };
  }

  return { x: ox + Math.floor(w / 2), y: oy + Math.floor(h / 2) };
}
