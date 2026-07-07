/**
 * @file Reexportación de catálogos (`game-data/<dominio>/`).
 */

export * from '@/game-data/medium';
export * from '@/game-data/movement';
export * from '@/game-data/particles';
export * from '@/game-data/input';
export * from '@/game-data/actions';
export * from '@/game-data/conditions';
export * from '@/game-data/appearance';
export {
  initializeRegistries,
  validateAndStoreParticleTypes,
  getRegistryBootstrapState,
  type RegistryBootstrapState,
} from '@/game-data/bootstrap/initialize-registries';
export {
  formatReconciliationToggleHudLine,
  isReconciliationEnabled,
  RECONCILE_BLEND_DIST_CELLS,
  RECONCILE_FIXED_DT_SEC,
  RECONCILE_MAX_REPLAY_TICKS,
  RECONCILE_MEDIUM_FORCE_SNAP,
  RECONCILE_SNAP_DIST_CELLS,
  RECONCILIATION_ENABLED_BY_DEFAULT,
} from '@/game-data/reconciliation';
