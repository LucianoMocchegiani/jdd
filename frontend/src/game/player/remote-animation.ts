/**
 * @file Elige el clip remoto a partir del estado autoritativo publicado por el servidor.
 */

export interface RemoteAnimationState {
  medium: string;
  vx: number;
  vy: number;
  vz: number;
  intents?: Record<string, boolean>;
  action_id?: string;
}

const MOVE_INTENTS = ['move_forward', 'move_backward', 'move_left', 'move_right'] as const;

export function isNewActionSequence(previous: number | null, next: number): boolean {
  return next > (previous ?? 0);
}

export function selectRemoteClip(state: RemoteAnimationState): string | null {
  if (state.action_id === 'attack') return 'attack';
  if (state.action_id === 'kamehameha') return 'kamehameha';
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
