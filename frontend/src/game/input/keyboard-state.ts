import { logInputKey } from '@/game/debug/input-flow-debug';

const HELD = new Set<string>();
const VIRTUAL_HELD = new Set<string>();
let attached = false;

/** `true` si el foco está en un campo editable (no capturar teclas de juego). */
export function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

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
  'KeyG',
  'KeyQ',
  'KeyE',
  'KeyC',
  'KeyR',
  'KeyT',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
  'Mouse0',
]);

/** Registra listeners una sola vez (llamar desde `main.ts` al arranque). */
export function attachKeyboardInput(): void {
  if (attached || typeof document === 'undefined') return;
  attached = true;
  document.addEventListener('keydown', (event) => {
    if (isTextInputFocused()) return;
    if (GAME_KEY_CODES.has(event.code)) event.preventDefault();
    const wasNew = !HELD.has(event.code);
    HELD.add(event.code);
    if (wasNew) logInputKey('down', event.code, getHeldKeyCodes());
  }, { capture: true });
  document.addEventListener('keyup', (event) => {
    if (isTextInputFocused()) return;
    const had = HELD.delete(event.code);
    if (had) logInputKey('up', event.code, getHeldKeyCodes());
  }, { capture: true });
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
    ) {
      HELD.clear();
      VIRTUAL_HELD.clear();
    }
  }, { capture: true });
  window.addEventListener('blur', () => {
    if (HELD.size > 0 || VIRTUAL_HELD.size > 0) {
      HELD.clear();
      VIRTUAL_HELD.clear();
      logInputKey('blur', '(cleared)', []);
    }
  });
}

/** Lets touch controls feed the existing intent pipeline without synthetic key events. */
export function setVirtualKeyHeld(code: string, held: boolean): void {
  if (held) VIRTUAL_HELD.add(code);
  else VIRTUAL_HELD.delete(code);
}

/** Discards held control keys before changing which actions they resolve to. */
export function clearHeldKeyCodes(codes: readonly string[]): void {
  for (const code of codes) {
    HELD.delete(code);
    VIRTUAL_HELD.delete(code);
  }
}

/** @param code - `KeyboardEvent.code` */
export function isKeyHeld(code: string): boolean {
  return HELD.has(code) || VIRTUAL_HELD.has(code);
}

/** Códigos pulsados ahora (para debug HUD). */
export function getHeldKeyCodes(): string[] {
  return [...new Set([...HELD, ...VIRTUAL_HELD])];
}
