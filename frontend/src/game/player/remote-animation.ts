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

export function selectRemoteClip(state: RemoteAnimationState): string | null {
  if (state.action_id === 'attack') return 'attack';
  if (state.action_id === 'kamehameha') return 'kamehameha';
  const moving =
    MOVE_INTENTS.some((intent) => state.intents?.[intent]) || Math.hypot(state.vx, state.vy) > 0.05;

  if (state.medium === 'submerged_partial' || state.medium === 'submerged_full') {
    return moving ? 'swim' : null;
  }
  if (state.medium === 'air') {
    return moving ? 'fly' : state.vz > 0.1 ? 'jump' : null;
  }
  if (state.medium === 'ground' && moving) {
    return state.intents?.run_forward ? 'run' : 'walk';
  }
  return null;
}
