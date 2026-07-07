/**
 * @file Contexto por frame para el Action Resolver.
 */

import type { ActiveConditionInstance } from '@/ecs/components/conditions';
import { InputComponent } from '@/ecs/components/input';
import { ContactComponent } from '@/ecs/components/contact';
import { resolveConditionBlocks } from '@/ecs/domains/condition/resolve-condition-effects';
import type { Medium } from '@/types/medium';

/**
 * Contexto crudo antes de evaluar `when` en fichas.
 */
export interface ActionContext {
  medium: Medium;
  intents: Record<string, boolean>;
  /** Ids de condiciones activas en la entidad (para `when.conditions`). */
  activeConditionIds: readonly string[];
  blockedActionIds: ReadonlySet<string>;
}

/**
 * Construye intents de teclado + derivados (`constant_displacements_move`).
 * Aplica `blockIntents` de condiciones activas antes de derivados.
 */
export function buildActionContext(
  input: InputComponent,
  contact: ContactComponent,
  activeConditions: readonly ActiveConditionInstance[] = [],
): ActionContext {
  const { blockedIntents, blockedActionIds } = resolveConditionBlocks(activeConditions);
  const intents: Record<string, boolean> = { ...input.intents };

  for (const intent of blockedIntents) {
    intents[intent] = false;
  }

  const constantDisplacementsMove =
    intents.move_forward === true ||
    intents.move_backward === true ||
    intents.move_left === true ||
    intents.move_right === true;
  intents.constant_displacements_move = constantDisplacementsMove;

  return {
    medium: contact.medium,
    intents,
    activeConditionIds: activeConditions.map((c) => c.conditionId),
    blockedActionIds,
  };
}

/** @param intent - Intent registrado o derivado */
export function isIntentActive(ctx: ActionContext, intent: string): boolean {
  return ctx.intents[intent] === true;
}
