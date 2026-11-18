/**
 * @file Captura de teclado/ratón y traducción a intents del cliente.
 *
 * No decide resultados de acciones ni simula movimiento. Traduce el estado de
 * hardware a nombres estables en `InputComponent`; `NetworkInputSender` los envía
 * al servidor, que resuelve movimiento y acciones.
 *
 * Los listeners viven en `keyboard-state.ts` (un solo attach en `main.ts`).
 * Este sistema solo **lee** el estado HELD cada frame.
 */
import { InputComponent } from '@/ecs/components/input';
import { System } from '@/ecs/core';
import { logInputIntents } from '@/game/debug/input-flow-debug';
import { logMovementWarn } from '@/game/debug/movement-debug';
import { isCameraInspectMode } from '@/game/camera/camera-access';
import { getHeldKeyCodes, isKeyHeld } from '@/game/input/keyboard-state';

const BLOCKED_IN_INSPECT = new Set([
  'move_forward', 'move_backward', 'move_left', 'move_right', 'run_forward',
  'jump', 'attack_light', 'attack_projectile', 'continuous_attack', 'continuous_aura', 'target_orbe', 'target_trueno',
]);

/** Mapa de intents locales a códigos `KeyboardEvent.code`, también usado por el HUD. */
export const INTENT_KEY_CODES: Record<string, readonly string[]> = {
  move_forward: ['KeyW', 'ArrowUp'],
  move_backward: ['KeyS', 'ArrowDown'],
  move_left: ['KeyA', 'ArrowLeft'],
  move_right: ['KeyD', 'ArrowRight'],
  run_forward: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  continuous_attack: ['KeyQ'],
  continuous_aura: ['KeyE'],
  attack_light: ['KeyF', 'Mouse0'],
  attack_projectile: ['KeyG'],
  target_orbe: ['KeyR'],
  target_trueno: ['KeyT'],
};

/** Lee controles locales y actualiza `InputComponent` antes de enviarlos. */
export class InputSystem extends System {
  readonly priority = 0;
  readonly requiredComponents = ['input'] as const;

  override update(_deltaTime: number): void {
    const entities = this.getEntities();
    if (entities.size === 0) {
      logMovementWarn('InputSystem: ninguna entidad con input');
      return;
    }
    const held = getHeldKeyCodes();
    for (const entityId of entities) {
      const input = this.world?.getComponent<InputComponent>(entityId, 'input');
      if (!input) continue;
      input.clear();
      const inspect = isCameraInspectMode();
      for (const [intent, codes] of Object.entries(INTENT_KEY_CODES)) {
        if (inspect && BLOCKED_IN_INSPECT.has(intent)) continue;
        input.setIntent(intent, codes.some((code) => isKeyHeld(code)));
      }
      logInputIntents(entityId, input.intents, held);
    }
  }
}
