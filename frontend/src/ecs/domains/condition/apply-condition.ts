/**
 * @file Aplica {@link ConditionApplyRef} a una entidad.
 */

import { ConditionsComponent, type ActiveConditionInstance } from '@/ecs/components/conditions';
import { getConditionById } from '@/game-data/conditions';
import type { ConditionApplyRef } from '@/types/condition';
import type { World } from '@/ecs/core';

/**
 * Añade o renueva una condición según la ficha del registry.
 */
export function applyConditionRef(
  world: World,
  entityId: number,
  ref: ConditionApplyRef,
  nowMs: number,
): void {
  const comp = world.getComponent<ConditionsComponent>(entityId, 'conditions');
  const def = getConditionById(ref.conditionId);
  if (!comp || !def) {
    return;
  }

  const durationMs = ref.durationMs ?? def.lifecycle?.durationMs ?? null;
  const expiresAtMs = durationMs != null ? nowMs + durationMs : null;
  const addStacks = ref.stacks ?? 1;
  const maxStacks = def.lifecycle?.maxStacks ?? 1;
  const stackable = def.lifecycle?.stackable ?? false;

  const existing = comp.active.find((c) => c.conditionId === ref.conditionId);
  if (existing) {
    if (stackable) {
      existing.stacks = Math.min(maxStacks, existing.stacks + addStacks);
    }
    if (expiresAtMs != null) {
      existing.expiresAtMs = expiresAtMs;
    }
    return;
  }

  const instance: ActiveConditionInstance = {
    conditionId: ref.conditionId,
    stacks: stackable ? Math.min(maxStacks, addStacks) : 1,
    expiresAtMs,
  };
  comp.active.push(instance);
}

/** Export `applyConditionRefs` — apply condition refs. */
export function applyConditionRefs(
  world: World,
  entityId: number,
  refs: readonly ConditionApplyRef[] | undefined,
  nowMs: number,
): void {
  if (!refs?.length) {
    return;
  }
  for (const ref of refs) {
    applyConditionRef(world, entityId, ref, nowMs);
  }
}
