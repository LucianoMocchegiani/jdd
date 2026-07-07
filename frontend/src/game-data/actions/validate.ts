/**
 * @file Validación estática del Action Registry al arranque (fase 5–6).
 */

import { ALL_ACTIONS, getActionById } from '@/game-data/actions/registry';
import { isKnownConditionId } from '@/game-data/conditions/registry';
import { isKnownClip } from '@/game-data/appearance/catalog';
import { isRegisteredInputIntent } from '@/game-data/input/registry';
import { isValidMedium } from '@/game-data/medium/registry';
import type { ActionWhen } from '@/types/action';
import type { Medium } from '@/types/medium';

/** Export `ActionRegistryValidationResult` — action registry validation result. */
export interface ActionRegistryValidationResult {
  ok: boolean;
  errors: string[];
}

function validateMediumList(
  mediums: Medium | Medium[] | undefined,
  path: string,
  errors: string[],
): void {
  if (mediums == null) {
    return;
  }
  const list = Array.isArray(mediums) ? mediums : [mediums];
  for (const m of list) {
    if (!isValidMedium(m)) {
      errors.push(`${path}: medium desconocido "${m}"`);
    }
  }
}

function validateConditionIdList(
  ids: readonly string[] | undefined,
  path: string,
  errors: string[],
): void {
  if (!ids?.length) {
    return;
  }
  for (const id of ids) {
    if (!isKnownConditionId(id)) {
      errors.push(`${path}: condition desconocida "${id}"`);
    }
  }
}

function validateWhen(when: ActionWhen | undefined, actionId: string, errors: string[]): void {
  if (!when) {
    return;
  }
  validateMediumList(when.medium, `${actionId}.when.medium`, errors);
  validateMediumList(when.not?.medium, `${actionId}.when.not.medium`, errors);
  validateConditionIdList(when.conditions, `${actionId}.when.conditions`, errors);
  validateConditionIdList(when.not?.conditions, `${actionId}.when.not.conditions`, errors);
}

/** Export `validateActionRegistry` — validate action registry. */
export function validateActionRegistry(): ActionRegistryValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const action of ALL_ACTIONS) {
    if (seen.has(action.id)) {
      errors.push(`id duplicado: ${action.id}`);
    }
    seen.add(action.id);

    const intent = action.control.inputIntent;
    if (intent !== 'constant_displacements_move' && !isRegisteredInputIntent(intent)) {
      errors.push(`${action.id}: inputIntent no registrado "${intent}"`);
    }

    validateWhen(action.control.when, action.id, errors);

    const interrupt = action.control.interrupt;
    if (interrupt?.blocks) {
      for (const blockedId of interrupt.blocks) {
        if (!getActionById(blockedId)) {
          errors.push(`${action.id}: interrupt.blocks id desconocido "${blockedId}"`);
        }
      }
    }
    if (interrupt?.canBeInterruptedBy) {
      for (const id of interrupt.canBeInterruptedBy) {
        if (!getActionById(id)) {
          errors.push(`${action.id}: interrupt.canBeInterruptedBy id desconocido "${id}"`);
        }
      }
    }

    const clip = action.appearance?.clip;
    if (clip && !isKnownClip(clip) && import.meta.env.DEV) {
      console.warn(`[action-registry] clip no catalogado: ${action.id} → "${clip}"`);
    }

    const applyConditions = action.impact?.applyConditions;
    if (applyConditions) {
      for (const ref of applyConditions) {
        if (!isKnownConditionId(ref.conditionId)) {
          errors.push(
            `${action.id}.impact.applyConditions: condition desconocida "${ref.conditionId}"`,
          );
        }
      }
    }
  }

  const ok = errors.length === 0;
  if (!ok && import.meta.env.DEV) {
    console.error('[action-registry] Errores de validación:', errors);
  }

  return { ok, errors };
}
