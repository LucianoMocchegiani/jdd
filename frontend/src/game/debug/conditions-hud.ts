export interface PlayerStateEvent {
  type: 'player_state';
  server_tick: number;
  player_id: string;
  bloque_id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number;
  pitch?: number;
  medium: string;
  dominant_particle?: string;
  conditions?: string[];
  condition_damage_total?: number;
  action_id?: string;
  action_seq?: number;
  action_t0_ms?: number;
  entity_id?: number;
  intents?: Record<string, true>;
  input_seq?: number;
  health?: number;
  max_health?: number;
  mana?: number;
  max_mana?: number;
  in_combat?: boolean;
  receivedAtMs?: number;
}

export interface ActiveConditionInstance {
  condition_id: string;
  stacks: number;
  remaining_ms: number | null;
}

function formatInstance(condition: ActiveConditionInstance): string {
  const stacks = condition.stacks > 1 ? ` x${condition.stacks}` : '';
  const remaining = condition.remaining_ms == null ? '' : ` (${(condition.remaining_ms / 1000).toFixed(1)}s)`;
  return `${condition.condition_id}${stacks}${remaining}`;
}

export function formatConditionsHudLine(active: readonly ActiveConditionInstance[], debugDamageTotal: number): string {
  const conditions = active.map(formatInstance).join(', ');
  const damage = debugDamageTotal > 0 ? ` · dmg ${debugDamageTotal}` : '';
  return `conditions: ${conditions || '—'}${damage}`;
}

export function updateConditionsHud(el: HTMLElement | null, active: readonly ActiveConditionInstance[], debugDamageTotal: number): void {
  if (el) el.textContent = formatConditionsHudLine(active, debugDamageTotal);
}
