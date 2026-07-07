/**
 * @file Partículas: reglas de contacto + validación contra el API.
 */

export {
  DEFAULT_RULE_BY_PHYSICS,
  PARTICLE_TYPE_OVERRIDES,
  SUBMERGED_COUNT_FAMILIES,
  countsTowardSubmerged,
  hasExplicitOverride,
  resolveContactRule,
  type ParticleContactRule,
  type ParticleFamily,
  type MediumContribution,
  type ParticleContactConditions,
} from '@/game-data/particles/registry';
export {
  validateParticleTypes,
  type ParticleTypeValidationResult,
  type ValidateParticleTypesOptions,
} from '@/game-data/particles/validate';
