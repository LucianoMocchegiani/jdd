export interface RemoteAnimationState {
  medium: string;
  vx: number;
  vy: number;
  vz: number;
  intents?: Record<string, boolean>;
  continuous_attack_active?: boolean;
  action_id?: string;
}

const MOVE_INTENTS = ['move_forward', 'move_backward', 'move_left', 'move_right'] as const;

export function isNewActionSequence(previous: number | null, next: number): boolean {
  return next > (previous ?? 0);
}

/** Selecciona el clip visual del jugador local o remoto desde el estado recibido. */
export function selectRemoteClip(state: RemoteAnimationState): string | null {
  if (state.continuous_attack_active || state.intents?.continuous_attack) return 'rayo_de_ki';
  if (state.action_id === 'attack') return 'attack';
  if (state.action_id === 'kamehameha') return 'kamehameha';
  if (state.action_id === 'orbe_explosivo' || state.action_id === 'trueno') return state.action_id;
  const moving =
    MOVE_INTENTS.some((intent) => state.intents?.[intent]) || Math.hypot(state.vx, state.vy) > 0.05;

  if (state.medium === 'submerged_partial' || state.medium === 'submerged_full') {
    return moving ? 'swim' : null;
  }
  if (state.medium === 'air') {
    if (moving) return 'fly';
    return state.vz > 0.05 ? 'jump' : null;
  }
  if (moving) {
    return state.intents?.run_forward || state.intents?.run_backward ? 'run' : 'walk';
  }
  return null;
}
