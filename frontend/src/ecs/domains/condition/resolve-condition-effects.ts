/**
 * @file Agrega efectos de condiciones activas (movimiento, apariencia, ticks).
 */

import { getConditionById } from '@/game-data/conditions';
import type { ActiveConditionInstance } from '@/ecs/components/conditions';

/**
 * Multiplicador horizontal combinado (1 = sin cambio). Los `speedMultiplier` de fichas se multiplican.
 */
export function resolveConditionSpeedMultiplier(
  active: readonly ActiveConditionInstance[],
): number {
  let mult = 1;
  for (const inst of active) {
    const def = getConditionById(inst.conditionId);
    const m = def?.effects?.movement?.speedMultiplier;
    if (m != null) {
      mult *= m;
    }
  }
  return mult;
}

/** Intents y acciones bloqueados por condiciones activas (fase 8 → resolver). */
export interface ConditionBlocks {
  blockedIntents: ReadonlySet<string>;
  blockedActionIds: ReadonlySet<string>;
}

/** Une `effects.blockIntents` / `blockActionIds` de todas las instancias activas. */
export function resolveConditionBlocks(
  active: readonly ActiveConditionInstance[],
): ConditionBlocks {
  const blockedIntents = new Set<string>();
  const blockedActionIds = new Set<string>();
  for (const inst of active) {
    const effects = getConditionById(inst.conditionId)?.effects;
    for (const intent of effects?.blockIntents ?? []) {
      blockedIntents.add(intent);
    }
    for (const actionId of effects?.blockActionIds ?? []) {
      blockedActionIds.add(actionId);
    }
  }
  return { blockedIntents, blockedActionIds };
}

/** Tint de la primera condición activa que declare `appearance.tint`. */
export function resolveConditionTint(active: readonly ActiveConditionInstance[]): number | null {
  for (const inst of active) {
    const tint = getConditionById(inst.conditionId)?.appearance?.tint;
    if (tint != null) {
      return tint;
    }
  }
  return null;
}
