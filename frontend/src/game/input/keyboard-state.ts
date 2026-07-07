/**
 * @file Estado global de teclas (un listener en `document`, capture).
 */

import { logInputKey } from '@/game/debug/input-flow-debug';

const HELD = new Set<string>();
let attached = false;

const GAME_KEY_CODES = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ShiftLeft',
  'ShiftRight',
  'KeyF',
  'KeyC',
  'Mouse0',
]);

/** Registra listeners una sola vez (llamar desde `main.ts` al arranque). */
export function attachKeyboardInput(): void {
  if (attached || typeof document === 'undefined') {
    return;
  }
  attached = true;

  document.addEventListener(
    'keydown',
    (e) => {
      if (GAME_KEY_CODES.has(e.code)) {
        e.preventDefault();
      }
      const wasNew = !HELD.has(e.code);
      HELD.add(e.code);
      if (wasNew) {
        logInputKey('down', e.code, getHeldKeyCodes());
      }
    },
    { capture: true },
  );

  document.addEventListener(
    'keyup',
    (e) => {
      const had = HELD.delete(e.code);
      if (had) {
        logInputKey('up', e.code, getHeldKeyCodes());
      }
    },
    { capture: true },
  );

  window.addEventListener('blur', () => {
    if (HELD.size > 0) {
      HELD.clear();
      logInputKey('blur', '(cleared)', []);
    }
  });
}

/** @param code - `KeyboardEvent.code` */
export function isKeyHeld(code: string): boolean {
  return HELD.has(code);
}

/** Códigos pulsados ahora (para debug HUD). */
export function getHeldKeyCodes(): string[] {
  return [...HELD];
}
