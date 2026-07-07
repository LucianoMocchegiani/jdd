/**
 * @file Capa de entrada: teclado/ratón → intents abstractos en {@link InputComponent}.
 *
 * No decide acciones ni animaciones. Solo traduce hardware a nombres estables
 * (`move_forward`, `attack_light`, …) que el {@link ActionOrchestratorSystem} y
 * el {@link MovementSystem} consumen más adelante.
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
  'move_forward',
  'move_backward',
  'move_left',
  'move_right',
  'run_forward',
  'jump',
  'attack_light',
]);

/**
 * Mapa intent → códigos `KeyboardEvent.code` que lo activan.
 *
 * Regla **OR**: si **cualquiera** de la lista está pulsada, el intent queda `true`.
 * Ej.: Shift izquierdo o derecho → `run_forward`.
 *
 * Debe alinearse con `INPUT_INTENTS` en `input-registry.ts` (validación de fichas).
 * Intents derivados (`constant_displacements_move`) no van aquí: los arma `context-builder`.
 */
const INTENT_KEY_CODES: Record<string, readonly string[]> = {
  move_forward: ['KeyW', 'ArrowUp'],
  move_backward: ['KeyS', 'ArrowDown'],
  move_left: ['KeyA', 'ArrowLeft'],
  move_right: ['KeyD', 'ArrowRight'],
  run_forward: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  attack_light: ['KeyF', 'Mouse0'],
};

/**
 * Primer sistema del frame (`priority` 0): rellena intents antes de contacto y acciones.
 *
 * - **Entrada:** `getHeldKeyCodes` / `isKeyHeld` (estado global del teclado).
 * - **Salida:** `InputComponent.intents` por entidad con componente `input`.
 * - **Query:** `requiredComponents = ['input']` → solo entidades que deben leer input
 *   (hoy el jugador; enemigos no llevan este componente).
 */
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
      if (!input) {
        continue;
      }

      // Cada frame parte de cero; no arrastra intents del frame anterior.
      input.clear();

      const inspect = isCameraInspectMode();

      for (const [intent, codes] of Object.entries(INTENT_KEY_CODES)) {
        if (inspect && BLOCKED_IN_INSPECT.has(intent)) {
          continue;
        }
        const active = codes.some((code) => isKeyHeld(code));
        input.setIntent(intent, active);
      }

      logInputIntents(entityId, input.intents, held);
    }
  }
}
