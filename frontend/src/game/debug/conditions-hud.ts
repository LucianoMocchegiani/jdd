import type { ActiveConditionState } from '@/types/condition-state';

export function formatConditionsHudLine(active: readonly ActiveConditionState[], debugDamageTotal: number): string {
  const conditions = active.map((condition) => {
    const stacks = condition.stacks > 1 ? ` x${condition.stacks}` : '';
    const remaining = condition.remaining_ms == null ? '' : ` (${(condition.remaining_ms / 1000).toFixed(1)}s)`;
    return `${condition.condition_id}${stacks}${remaining}`;
  }).join(', ');
  const damage = debugDamageTotal > 0 ? ` · dmg ${debugDamageTotal}` : '';
  return `conditions: ${conditions || '—'}${damage}`;
}

export function updateConditionsHud(el: HTMLElement | null, active: readonly ActiveConditionState[], debugDamageTotal: number): void {
  if (el) el.textContent = formatConditionsHudLine(active, debugDamageTotal);
}
