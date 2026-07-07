/**
 * @file Arranque: carga registries locales (tipos de partícula vía WS en gameplay).
 */

import { BloquesApi } from '@/api/bloques-api';
import type { ApiClient } from '@/api/client';
import {
  getRegistryBootstrapState,
  initializeRegistries,
  type ParticleTypeValidationResult,
} from '@/game-data';
import { resolveActiveBloque } from '@/game/bootstrap/resolve-active-bloque';

/** Estado visual de la barra `#status`. */
export type StatusBarState = 'ok' | 'warn';

/**
 * Resultado de {@link syncParticleCatalog}.
 */
export interface ParticleCatalogSyncResult {
  /** Texto corto para la barra (sin prefijo de backend). */
  statusSuffix: string;
  statusState: StatusBarState;
  bloqueId: string | null;
  particleTypeCount: number;
  validation: ParticleTypeValidationResult | null;
}

/**
 * Inicializa catálogos locales. Los tipos del bloque activo llegan en `terrain_types` por WS.
 *
 * @param client - Cliente HTTP ya verificado (`verifyBackendConnectivity`)
 */
export async function syncParticleCatalog(
  client: ApiClient,
): Promise<ParticleCatalogSyncResult> {
  initializeRegistries();

  const bloquesApi = new BloquesApi(client);
  const bloque = await resolveActiveBloque(bloquesApi);
  const bloqueId = bloque?.id ?? null;
  const registries = getRegistryBootstrapState();
  const mediumN = registries?.mediumCount ?? 0;

  if (!bloqueId) {
    return {
      statusSuffix: 'Catálogo · sin bloques en BD',
      statusState: 'warn',
      bloqueId: null,
      particleTypeCount: 0,
      validation: null,
    };
  }

  return {
    statusSuffix: `Catálogo · tipos vía WS · ${mediumN} medios`,
    statusState: 'ok',
    bloqueId,
    particleTypeCount: 0,
    validation: null,
  };
}
