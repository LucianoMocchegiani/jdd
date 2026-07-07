/**
 * @file Línea de HUD para {@link ConditionsComponent}.
 */

import type { ActiveConditionInstance } from '@/ecs/components/conditions';

function formatInstance(c: ActiveConditionInstance, nowMs: number): string {
  const stacks = c.stacks > 1 ? ` x${c.stacks}` : '';
  if (c.expiresAtMs == null) {
    return `${c.conditionId}${stacks}`;
  }
  const secLeft = Math.max(0, (c.expiresAtMs - nowMs) / 1000);
  return `${c.conditionId}${stacks} (${secLeft.toFixed(1)}s)`;
}

/** Export `formatConditionsHudLine` — format conditions hud line. */
export function formatConditionsHudLine(
  active: readonly ActiveConditionInstance[],
  debugDamageTotal: number,
): string {
  if (active.length === 0) {
    return debugDamageTotal > 0 ? `conditions: — · dmg ${debugDamageTotal}` : 'conditions: —';
  }
  const nowMs = performance.now();
  const list = active.map((c) => formatInstance(c, nowMs)).join(', ');
  const dmg =
    debugDamageTotal > 0 ? ` · dmg ${debugDamageTotal}` : '';
  return `conditions: ${list}${dmg}`;
}

/** Export `updateConditionsHud` — update conditions hud. */
export function updateConditionsHud(
  el: HTMLElement | null,
  active: readonly ActiveConditionInstance[],
  debugDamageTotal: number,
): void {
  if (!el) {
    return;
  }
  el.textContent = formatConditionsHudLine(active, debugDamageTotal);
}
