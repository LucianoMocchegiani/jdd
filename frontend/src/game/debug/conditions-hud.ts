export function formatConditionsHudLine(active: readonly string[], debugDamageTotal: number): string {
  const damage = debugDamageTotal > 0 ? ` · dmg ${debugDamageTotal}` : '';
  return `conditions: ${active.join(', ') || '—'}${damage}`;
}

export function updateConditionsHud(el: HTMLElement | null, active: readonly string[], debugDamageTotal: number): void {
  if (el) el.textContent = formatConditionsHudLine(active, debugDamageTotal);
}
