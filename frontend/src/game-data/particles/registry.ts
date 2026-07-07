/**
 * @file Reglas de contacto — ``shared/game-data/particles/registry.json``.
 */

import type { ConditionApplyRef } from '@/types/condition';
import type { PhysicsType, ParticleType } from '@/types/particle';
import particleData from '@shared/particles/registry.json';

/** Export `ParticleFamily` — particle family. */
export type ParticleFamily = 'solid' | 'liquid' | 'gas' | 'energy' | 'granular';

/** Export `SUBMERGED_COUNT_FAMILIES` — submerged_count_families. */
export const SUBMERGED_COUNT_FAMILIES: readonly ParticleFamily[] =
  particleData.submergedCountFamilies as ParticleFamily[];

/** Export `MediumContribution` — medium contribution. */
export type MediumContribution = 'submerged' | 'ground';

/** Export `ParticleContactConditions` — particle contact conditions. */
export interface ParticleContactConditions {
  onEnter?: readonly ConditionApplyRef[];
  onStay?: readonly ConditionApplyRef[];
}

/** Export `ParticleContactRule` — particle contact rule. */
export interface ParticleContactRule {
  family: ParticleFamily;
  contributesTo: readonly MediumContribution[];
  conditions?: ParticleContactConditions;
}

/** Export `PARTICLE_TYPE_OVERRIDES` — particle_type_overrides. */
export const PARTICLE_TYPE_OVERRIDES: Readonly<Record<string, ParticleContactRule>> =
  particleData.typeOverrides as Readonly<Record<string, ParticleContactRule>>;

/** Export `DEFAULT_RULE_BY_PHYSICS` — default_rule_by_physics. */
export const DEFAULT_RULE_BY_PHYSICS: Readonly<Record<PhysicsType, ParticleContactRule>> =
  particleData.defaultByPhysics as Readonly<Record<PhysicsType, ParticleContactRule>>;

/** Export `resolveContactRule` — resolve contact rule. */
export function resolveContactRule(type: ParticleType): ParticleContactRule {
  const byName = PARTICLE_TYPE_OVERRIDES[type.nombre];
  if (byName) {
    return byName;
  }
  return DEFAULT_RULE_BY_PHYSICS[type.tipo_fisico] ?? DEFAULT_RULE_BY_PHYSICS.solido;
}

/** Export `hasExplicitOverride` — has explicit override. */
export function hasExplicitOverride(nombre: string): boolean {
  return Object.hasOwn(PARTICLE_TYPE_OVERRIDES, nombre);
}

/** Export `countsTowardSubmerged` — counts toward submerged. */
export function countsTowardSubmerged(family: ParticleFamily): boolean {
  return (SUBMERGED_COUNT_FAMILIES as readonly string[]).includes(family);
}
