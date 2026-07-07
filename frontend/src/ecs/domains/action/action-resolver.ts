/**
 * @file Resuelve fichas ganadoras por intent + `when.medium` + `interrupt` (fase 6).
 */

import {
  BODY_ACTIONS,
  CONSTANT_DISPLACEMENT_ACTION_ORDER,
  CONSTANT_DISPLACEMENT_ACTIONS,
  IMPULSE_DISPLACEMENT_ACTIONS,
} from '@/game-data/actions';
import { getActionDurationMs } from '@/game-data/appearance';
import type { ActionsComponent } from '@/ecs/components/actions';
import type { ConditionsComponent } from '@/ecs/components/conditions';
import {
  buildActionContext,
  isIntentActive,
  type ActionContext,
} from '@/ecs/domains/action/context-builder';
import { InputComponent } from '@/ecs/components/input';
import { ContactComponent } from '@/ecs/components/contact';
import type { ActionDefinition, ActionWhen } from '@/types/action';
import type { Medium } from '@/types/medium';

/** Resultado del resolver por frame (una ficha ganadora por slot). */
export interface ResolvedActions {
  constantDisplacements: ActionDefinition | null;
  impulseDisplacements: ActionDefinition | null;
  bodyActions: ActionDefinition | null;
  fullBodyAction: ActionDefinition | null;
  /** Timestamp hasta el cual `bodyActions` permanece latched (`one_shot`). */
  bodyActionsUntilMs: number;
}

function mediumMatches(whenMedium: Medium | Medium[] | undefined, current: Medium): boolean {
  if (whenMedium == null) {
    return true;
  }
  const list = Array.isArray(whenMedium) ? whenMedium : [whenMedium];
  return list.includes(current);
}

function hasActiveCondition(ctx: ActionContext, conditionId: string): boolean {
  return ctx.activeConditionIds.includes(conditionId);
}

function evaluateWhen(when: ActionWhen | undefined, ctx: ActionContext): boolean {
  if (!when) {
    return true;
  }
  if (when.medium != null && !mediumMatches(when.medium, ctx.medium)) {
    return false;
  }
  if (when.not?.medium != null && mediumMatches(when.not.medium, ctx.medium)) {
    return false;
  }
  if (when.conditions?.length) {
    for (const id of when.conditions) {
      if (!hasActiveCondition(ctx, id)) {
        return false;
      }
    }
  }
  if (when.not?.conditions?.length) {
    for (const id of when.not.conditions) {
      if (hasActiveCondition(ctx, id)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * `true` si alguna ficha activa lista este id en `control.interrupt.blocks`.
 */
function isBlockedByActive(
  candidateId: string,
  actives: readonly ActionDefinition[],
): boolean {
  for (const active of actives) {
    const blocks = active.control.interrupt?.blocks;
    if (blocks?.includes(candidateId)) {
      return true;
    }
  }
  return false;
}

function actionMatches(
  action: ActionDefinition,
  ctx: ActionContext,
  actives: readonly ActionDefinition[],
): boolean {
  if (ctx.blockedActionIds.has(action.id)) {
    return false;
  }
  if (isBlockedByActive(action.id, actives)) {
    return false;
  }
  if (!isIntentActive(ctx, action.control.inputIntent)) {
    return false;
  }
  return evaluateWhen(action.control.when, ctx);
}

function pickFirstMatching(
  candidates: readonly ActionDefinition[],
  ctx: ActionContext,
  actives: readonly ActionDefinition[],
): ActionDefinition | null {
  for (const action of candidates) {
    if (actionMatches(action, ctx, actives)) {
      return action;
    }
  }
  return null;
}

function pickByOrder(
  order: readonly string[],
  pool: readonly ActionDefinition[],
  ctx: ActionContext,
  actives: readonly ActionDefinition[],
): ActionDefinition | null {
  for (const id of order) {
    const action = pool.find((a) => a.id === id);
    if (action && actionMatches(action, ctx, actives)) {
      return action;
    }
  }
  return null;
}

/**
 * Slot `body_actions`: mantiene la ficha latched hasta `bodyActionsUntilMs`.
 * Si el latch sigue vivo, no re-evalúa intent (el ataque no se corta al soltar la tecla).
 */
function resolveBodyActionsLatch(
  active: ActionsComponent,
  ctx: ActionContext,
  actives: readonly ActionDefinition[],
  nowMs: number,
): { bodyActions: ActionDefinition | null; bodyActionsUntilMs: number } {
  if (active.bodyActions && active.bodyActionsUntilMs > nowMs) {
    return { bodyActions: active.bodyActions, bodyActionsUntilMs: active.bodyActionsUntilMs };
  }

  const picked = pickFirstMatching(BODY_ACTIONS, ctx, actives);
  if (!picked) {
    return { bodyActions: null, bodyActionsUntilMs: 0 };
  }

  const untilMs =
    picked.control.type === 'one_shot' ? nowMs + getActionDurationMs(picked.id) : 0;
  return { bodyActions: picked, bodyActionsUntilMs: untilMs };
}

/**
 * Elige una ficha ganadora por slot según `when`, intents e `interrupt.blocks`.
 *
 * Orden típico: primero `body_actions` (latch), luego constante/impulso con
 * `activesWithBody` para que `attack` bloquee run/walk vía `blocks`.
 *
 * @param nowMs - `performance.now()` para comparar con `bodyActionsUntilMs`
 */
export function resolveActions(
  input: InputComponent,
  contact: ContactComponent,
  conditions: ConditionsComponent,
  active: ActionsComponent,
  nowMs: number,
): ResolvedActions {
  const ctx = buildActionContext(input, contact, conditions.active);
  const latchedBody =
    active.bodyActions && active.bodyActionsUntilMs > nowMs ? [active.bodyActions] : [];
  const activesForResolve = latchedBody;

  const { bodyActions, bodyActionsUntilMs } = resolveBodyActionsLatch(
    active,
    ctx,
    activesForResolve,
    nowMs,
  );

  const activesWithBody = bodyActions && bodyActionsUntilMs > nowMs
    ? [...activesForResolve, bodyActions]
    : activesForResolve;

  const constantDisplacements = pickByOrder(
    CONSTANT_DISPLACEMENT_ACTION_ORDER,
    CONSTANT_DISPLACEMENT_ACTIONS,
    ctx,
    activesWithBody,
  );

  const impulseDisplacements = pickFirstMatching(
    IMPULSE_DISPLACEMENT_ACTIONS,
    ctx,
    activesWithBody,
  );

  return {
    constantDisplacements,
    impulseDisplacements,
    bodyActions,
    fullBodyAction: null,
    bodyActionsUntilMs,
  };
}
