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
