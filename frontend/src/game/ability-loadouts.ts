import { BODY_ACTIONS } from '@/game-data/actions';
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';
import { clearHeldKeyCodes } from '@/game/input/keyboard-state';

const STORAGE_KEY = 'jdd.ability-loadouts.v1';
export const LOADOUT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'] as const;
export const CONTROL_SLOTS = ['KeyF', 'KeyG', 'KeyQ', 'KeyE', 'KeyR', 'KeyT'] as const;
const actions = new Map(BODY_ACTIONS.map((action) => [action.id, action]));
type Loadout = Array<string | null>;

function defaults(): Loadout[] {
  return Array.from({ length: LOADOUT_KEYS.length }, () => CONTROL_SLOTS.map((_, index) => BODY_ACTIONS[index]?.id ?? null));
}

function readSavedLoadouts(): Loadout[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!Array.isArray(saved) || saved.length !== LOADOUT_KEYS.length) return defaults();
    return saved.map((loadout) => {
      if (!Array.isArray(loadout) || loadout.length !== CONTROL_SLOTS.length) return defaults()[0]!;
      const used = new Set<string>();
      return loadout.map((id) => {
        if (id === null) return null;
        if (typeof id !== 'string' || !actions.has(id) || used.has(id)) return null;
        used.add(id);
        return id;
      });
    });
  } catch {
    return defaults();
  }
}

let loadouts = readSavedLoadouts();
let activeLoadout = 0;
const listeners = new Set<() => void>();

function applyActiveLoadout(): void {
  for (const action of BODY_ACTIONS) INTENT_KEY_CODES[action.control.inputIntent] = [];
  loadouts[activeLoadout]!.forEach((id, slot) => {
    const action = id ? actions.get(id) : undefined;
    if (action) INTENT_KEY_CODES[action.control.inputIntent] = [CONTROL_SLOTS[slot]!, ...(slot === 0 ? ['Mouse0'] : [])];
  });
}

function changed(): void {
  try {
    // TODO: Al implementar cuentas, migrar estos perfiles locales a la configuración del jugador y sincronizarlos entre dispositivos.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loadouts));
  } catch {
    // El juego sigue usando el perfil activo aunque el navegador no permita persistirlo.
  }
  clearHeldKeyCodes([...CONTROL_SLOTS, 'Mouse0']);
  applyActiveLoadout();
  window.dispatchEvent(new Event('ability-loadout-changed'));
  listeners.forEach((listener) => listener());
}

export function getActiveLoadout(): number { return activeLoadout; }
export function getLoadout(): readonly (string | null)[] { return loadouts[activeLoadout]!; }
export function subscribeLoadouts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function selectLoadout(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= LOADOUT_KEYS.length || activeLoadout === index) return;
  activeLoadout = index;
  changed();
}
export function assignAction(slot: number, actionId: string | null): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= CONTROL_SLOTS.length) return;
  if (actionId !== null && !actions.has(actionId)) return;
  const loadout = loadouts[activeLoadout]!;
  if (actionId !== null) {
    const previousSlot = loadout.indexOf(actionId);
    if (previousSlot >= 0) loadout[previousSlot] = null;
  }
  loadout[slot] = actionId;
  changed();
}

applyActiveLoadout();
