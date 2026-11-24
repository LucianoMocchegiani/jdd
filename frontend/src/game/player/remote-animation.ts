/**
 * @file Estado autoritativo usado para elegir el clip de animación presentado en el cliente.
 */
export interface RemoteAnimationState {
  medium: string;
  vx: number;
  vy: number;
  vz: number;
  yaw?: number;
  intents?: Record<string, boolean>;
  continuous_attack_active?: boolean;
  continuous_action_id?: string;
  action_id?: string;
}

type Direction = 'forward' | 'backward' | 'left' | 'right';

const MOVE_INTENTS = ['move_forward', 'move_backward', 'move_left', 'move_right'] as const;

/** Compara secuencias de acción para ignorar estados duplicados o atrasados. */
export function isNewActionSequence(previous: number | null, next: number): boolean {
  return next > (previous ?? 0);
}

function movementDirection(state: RemoteAnimationState): Direction {
  const intents = state.intents;
  const forward = Number(Boolean(intents?.move_forward || intents?.run_forward)) - Number(Boolean(intents?.move_backward || intents?.run_backward));
  const right = Number(Boolean(intents?.move_right)) - Number(Boolean(intents?.move_left));
  if (forward || right) return Math.abs(forward) >= Math.abs(right) ? (forward > 0 ? 'forward' : 'backward') : (right > 0 ? 'right' : 'left');

  const yaw = state.yaw ?? 0;
  const forwardSpeed = -state.vx * Math.sin(yaw) - state.vy * Math.cos(yaw);
  const rightSpeed = state.vx * Math.cos(yaw) - state.vy * Math.sin(yaw);
  if (Math.max(Math.abs(forwardSpeed), Math.abs(rightSpeed)) < 0.05) return 'forward';
  return Math.abs(forwardSpeed) >= Math.abs(rightSpeed)
    ? (forwardSpeed > 0 ? 'forward' : 'backward')
    : (rightSpeed > 0 ? 'right' : 'left');
}

/** Elige primero acciones explícitas; locomoción conserva las reglas actuales por medio. */
export function selectRemoteClip(state: RemoteAnimationState): string | null {
  if (state.continuous_action_id === 'escudo_radial_de_ki' || state.intents?.continuous_ki_shield || state.action_id === 'escudo_radial_de_ki') return 'escudo_radial_de_ki';
  if (state.continuous_action_id === 'aura_de_ki' || state.intents?.continuous_aura || state.action_id === 'aura_de_ki') return 'aura_de_ki';
  if (state.continuous_attack_active || state.intents?.continuous_attack) return 'rayo_de_ki';
  if (state.action_id === 'esquive_rapido') return `esquive_rapido_${movementDirection(state)}`;
  if (state.action_id === 'attack' || state.action_id === 'golpe_pesado' || state.action_id === 'onda_de_choque' || state.action_id === 'escudo_de_ki') return 'attack';
  if (state.action_id === 'kamehameha' || state.action_id === 'esfera_rapida') return 'kamehameha';
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
    const gait = state.intents?.run_forward || state.intents?.run_backward ? 'run' : 'walk';
    return `${gait}_${movementDirection(state)}`;
  }
  return null;
}

/** Usa la variante direccional si existe; conserva el clip base como fallback. */
export function resolveRemoteClipId(requested: string | null, clips: ReadonlyMap<string, unknown>): string | null {
  if (!requested) return null;
  if (clips.has(requested)) return requested;
  const base = requested.replace(/_(forward|backward|left|right)$/, '');
  if (clips.has(base)) return base;
  return base === 'run' && clips.has('walk') ? 'walk' : null;
}
