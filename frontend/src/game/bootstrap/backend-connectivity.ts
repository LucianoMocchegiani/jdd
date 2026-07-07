/**
 * @file Comprobación de conectividad con el backend (health + índice API).
 */

import {
  ApiClient,
  checkBackendHealth,
  fetchApiInfo,
  type HealthResponse,
} from '@/api/client';

/**
 * Resultado de {@link verifyBackendConnectivity}.
 */
export interface BackendConnectivityResult {
  health: HealthResponse;
  /** Cliente listo para dominios (`BloquesApi`, …). */
  client: ApiClient;
}

/**
 * Verifica `/health` y `GET /api` (índice greenfield) y devuelve un {@link ApiClient} reutilizable.
 *
 * @throws {@link ApiError} o error de red si el backend no responde
 */
export async function verifyBackendConnectivity(): Promise<BackendConnectivityResult> {
  const health = await checkBackendHealth();
  const client = new ApiClient();
  await fetchApiInfo(client);
  return { health, client };
}

/**
 * Mensaje de la barra de estado cuando el backend no está disponible.
 */
export const BACKEND_OFFLINE_STATUS =
  'Backend no disponible (¿compose en :8080?) · ECS + Three OK';

/**
 * Construye el texto de la barra cuando el backend respondió bien.
 *
 * @param healthStatus - Campo `status` de `/health`
 * @param phaseSuffix - Sufijo de fase (ej. resultado de {@link runPhase1DataBootstrap})
 */
export function formatBackendOkStatus(healthStatus: string, phaseSuffix: string): string {
  return `Backend: ${healthStatus} · API OK · ${phaseSuffix}`;
}
