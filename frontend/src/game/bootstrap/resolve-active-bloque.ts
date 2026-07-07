/**
 * @file Selección de bloque activo (URL ?bloque= o defaults de game-config).
 */

import type { BloqueDimension } from '@/api/bloques-api';
import { BloquesApi } from '@/api/bloques-api';
import {
  DEFAULT_BLOQUE_LIST_INDEX,
  DEFAULT_BLOQUE_NAME_MATCH,
  DEV_BASELINE_BLOQUE_NAME,
} from '@/game-data/game-config';

const BLOQUE_ALIASES: Record<string, string> = {
  arena: DEV_BASELINE_BLOQUE_NAME,
  '3': DEV_BASELINE_BLOQUE_NAME,
  lago: 'Lago y Montaña',
  '2': 'Lago y Montaña',
  bosque: 'Bosque Denso',
  '1': 'Bosque Denso',
};

function bloqueNameFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('bloque');
  if (!raw) return null;
  return BLOQUE_ALIASES[raw.toLowerCase()] ?? raw;
}

/**
 * Resuelve el bloque a cargar: `?bloque=` > nombre por defecto > índice > primer bloque en BD.
 */
export async function resolveActiveBloque(
  bloquesApi: BloquesApi,
): Promise<BloqueDimension | null> {
  const urlMatch = bloqueNameFromUrl();
  if (urlMatch) {
    const byUrl = await bloquesApi.getBloqueByNombreIncludes(urlMatch);
    if (byUrl) return byUrl;
  }

  if (DEFAULT_BLOQUE_NAME_MATCH) {
    const byName = await bloquesApi.getBloqueByNombreIncludes(DEFAULT_BLOQUE_NAME_MATCH);
    if (byName) return byName;
  }

  const byIndex = await bloquesApi.getBloqueAtListIndex(DEFAULT_BLOQUE_LIST_INDEX);
  if (byIndex) return byIndex;

  const bloques = await bloquesApi.listBloques();
  return bloques[0] ?? null;
}
