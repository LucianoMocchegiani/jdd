/**
 * @file Pasos de arranque desacoplados de {@link bootstrapApp}.
 */

export {
  verifyBackendConnectivity,
  formatBackendOkStatus,
  BACKEND_OFFLINE_STATUS,
  type BackendConnectivityResult,
} from '@/game/bootstrap/backend-connectivity';
export {
  syncParticleCatalog,
  type ParticleCatalogSyncResult,
  type StatusBarState,
} from '@/game/bootstrap/particle-catalog-sync';
