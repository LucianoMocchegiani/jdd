/**
 * @file Validación estática del condition registry (fase 8).
 */

import { ALL_ACTIONS } from '@/game-data/actions/registry';
import { ALL_CONDITIONS } from '@/game-data/conditions/registry';
import { ENVIRONMENT_CONDITION_TRIGGERS } from '@/game-data/conditions/environment-triggers';
import {
  DEFAULT_RULE_BY_PHYSICS,
  PARTICLE_TYPE_OVERRIDES,
} from '@/game-data/particles/registry';
import { isRegisteredInputIntent } from '@/game-data/input/registry';
import type { ConditionApplyRef, ConditionDefinition } from '@/types/condition';

/** Export `ConditionRegistryValidationResult` — condition registry validation result. */
export interface ConditionRegistryValidationResult {
  ok: boolean;
  errors: string[];
}

const KNOWN_CONDITION_IDS = new Set(ALL_CONDITIONS.map((c) => c.id));
const KNOWN_ACTION_IDS = new Set(ALL_ACTIONS.map((a) => a.id));

function validateApplyRefs(
  refs: readonly ConditionApplyRef[] | undefined,
  path: string,
  errors: string[],
): void {
  if (!refs?.length) {
    return;
  }
  for (const ref of refs) {
    if (!KNOWN_CONDITION_IDS.has(ref.conditionId)) {
      errors.push(`${path}: conditionId desconocido "${ref.conditionId}"`);
    }
  }
}

function validateConditionDefinition(def: ConditionDefinition, errors: string[]): void {
  const effects = def.effects;
  if (!effects) {
    return;
  }
  for (const intent of effects.blockIntents ?? []) {
    if (!isRegisteredInputIntent(intent) && intent !== 'constant_displacements_move') {
      errors.push(`${def.id}.effects.blockIntents: intent desconocido "${intent}"`);
    }
  }
  for (const actionId of effects.blockActionIds ?? []) {
    if (!KNOWN_ACTION_IDS.has(actionId)) {
      errors.push(`${def.id}.effects.blockActionIds: acción desconocida "${actionId}"`);
    }
  }
}

/** Export `validateConditionRegistry` — validate condition registry. */
export function validateConditionRegistry(): ConditionRegistryValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const def of ALL_CONDITIONS) {
    if (seen.has(def.id)) {
      errors.push(`condition id duplicado: "${def.id}"`);
    }
    seen.add(def.id);
    validateConditionDefinition(def, errors);
  }

  for (const [tipoNombre, rule] of Object.entries(PARTICLE_TYPE_OVERRIDES)) {
    validateApplyRefs(rule.conditions?.onEnter, `particle.${tipoNombre}.onEnter`, errors);
    validateApplyRefs(rule.conditions?.onStay, `particle.${tipoNombre}.onStay`, errors);
  }

  for (const familyRule of Object.values(DEFAULT_RULE_BY_PHYSICS)) {
    validateApplyRefs(familyRule.conditions?.onEnter, 'particle.physics.onEnter', errors);
    validateApplyRefs(familyRule.conditions?.onStay, 'particle.physics.onStay', errors);
  }

  for (const trigger of ENVIRONMENT_CONDITION_TRIGGERS) {
    validateApplyRefs(trigger.apply, `environment.${trigger.id}.apply`, errors);
  }

  return { ok: errors.length === 0, errors };
}
