export const INTENT_KEY_CODES: Record<string, readonly string[]> = {
  move_forward: ['KeyW', 'ArrowUp'],
  move_backward: ['KeyS', 'ArrowDown'],
  move_left: ['KeyA', 'ArrowLeft'],
  move_right: ['KeyD', 'ArrowRight'],
  run_forward: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  continuous_attack: ['KeyQ'],
  attack_light: ['KeyF', 'Mouse0'],
  attack_projectile: ['KeyG'],
};