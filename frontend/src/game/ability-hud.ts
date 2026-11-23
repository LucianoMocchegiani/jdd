import { BODY_ACTIONS } from '@/game-data/actions';
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';
import { setVirtualKeyHeld, isTextInputFocused } from '@/game/input/keyboard-state';
import {
  assignAction, CONTROL_SLOTS, getActiveLoadout, getLoadout, LOADOUT_KEYS,
  selectLoadout, subscribeLoadouts,
} from '@/game/ability-loadouts';

const COOLDOWN_EVENT = 'ability-cooldown-start';
const TARGET_REQUEST_EVENT = 'area-ability-target';
const pressTimers = new Map<string, number>();
const cooldownUntil = new Map<string, number>();
const actionById = new Map(BODY_ACTIONS.map((action) => [action.id, action]));
const prettyKey = (code: string): string => code === 'Mouse0' ? 'Click izq.' : code.replace(/^Key/, '');
const actionName = (id: string): string => id === 'attack' ? 'Ataque'
  : id === 'kamehameha' ? 'Kamehameha'
    : id === 'rayo_de_ki' ? 'Rayo de Ki'
      : id === 'aura_de_ki' ? 'Aura de Ki'
        : id === 'orbe_explosivo' ? 'Orbe explosivo'
          : id === 'trueno' ? 'Trueno' : id.replaceAll('_', ' ');

type HudRow = { item: HTMLButtonElement; clock: HTMLElement; cooldown: HTMLElement; cooldownMs: number; label: string; name: string; key: string };

function pulseAction(intent: string): void {
  const code = INTENT_KEY_CODES[intent]?.[0];
  if (!code) return;
  setVirtualKeyHeld(code, true);
  const previous = pressTimers.get(code);
  if (previous !== undefined) window.clearTimeout(previous);
  pressTimers.set(code, window.setTimeout(() => {
    setVirtualKeyHeld(code, false);
    pressTimers.delete(code);
  }, 120));
}

/** Construye el HUD de habilidades, selector de perfiles y editor accesible de controles. */
export function mountAbilityHud(root: HTMLElement): void {
  let rows = new Map<string, HudRow>();
  let editing = false;
  let selectedSlot = 0;
  let announcement = document.createElement('span');

  const startCooldown = (row: HudRow, remainingMs: number): void => {
    row.clock.style.setProperty('--cooldown-duration', `${remainingMs}ms`);
    row.item.classList.add('is-cooling-down');
    row.item.setAttribute('aria-label', `${row.name}, ${row.key}, Enfriando`);
    row.cooldown.textContent = 'Enfriando…';
    row.clock.classList.remove('is-spinning');
    void row.clock.offsetWidth;
    row.clock.classList.add('is-spinning');
  };

  const render = (): void => {
    rows = new Map();
    root.replaceChildren();
    const configs = document.createElement('div');
    configs.className = 'ability-hud__loadouts';
    configs.setAttribute('role', 'group');
    configs.setAttribute('aria-label', 'Configuraciones de controles');
    LOADOUT_KEYS.forEach((key, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ability-hud__config';
      button.textContent = key.slice(-1);
      button.setAttribute('aria-label', `Configuración ${index + 1}`);
      button.setAttribute('aria-pressed', String(getActiveLoadout() === index));
      if (getActiveLoadout() === index) button.classList.add('active');
      button.addEventListener('click', () => selectLoadout(index));
      configs.append(button);
    });
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'ability-hud__edit';
    edit.textContent = editing ? 'Listo' : 'Editar controles';
    edit.setAttribute('aria-expanded', String(editing));
    edit.addEventListener('click', () => { editing = !editing; render(); });
    configs.append(edit);
    root.append(configs);

    const activeActions = document.createElement('div');
    activeActions.className = 'ability-hud__actions';
    getLoadout().forEach((id, slot) => {
      const action = id ? actionById.get(id) : undefined;
      if (!action) return;
      const keyText = `${prettyKey(CONTROL_SLOTS[slot]!)}${slot === 0 ? ' / Click izq.' : ''}`;
      const cooldownMs = action.cooldownMs ?? 0;
      const nameText = actionName(action.id);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ability-hud__item';
      item.setAttribute('aria-label', `${nameText}, ${keyText}, ${(cooldownMs / 1000).toFixed(1)} s de enfriamiento; activar`);
      const activate = (): void => {
        if (action.control.type === 'sustained') {
          const code = CONTROL_SLOTS[slot]!;
          setVirtualKeyHeld(code, true);
          item.setAttribute('aria-pressed', 'true');
        } else if (action.targeting) {
          window.dispatchEvent(new CustomEvent(TARGET_REQUEST_EVENT, { detail: { actionId: action.id } }));
        } else pulseAction(action.control.inputIntent);
      };
      if (action.control.type === 'sustained') {
        item.setAttribute('aria-pressed', 'false');
        const release = (): void => { setVirtualKeyHeld(CONTROL_SLOTS[slot]!, false); item.setAttribute('aria-pressed', 'false'); };
        item.addEventListener('pointerdown', (event) => { event.preventDefault(); activate(); });
        item.addEventListener('pointerup', release);
        item.addEventListener('pointerleave', release);
        item.addEventListener('pointercancel', release);
        item.addEventListener('click', (event) => { if (event.detail === 0) { activate(); window.setTimeout(release, 120); } });
      } else {
        item.addEventListener('pointerdown', activate);
        item.addEventListener('click', (event) => { if (event.detail === 0) activate(); });
      }
      const icon = document.createElement('span');
      icon.className = 'ability-hud__icon';
      icon.textContent = action.id === 'attack' ? '⚔' : nameText.slice(0, 1).toUpperCase();
      icon.setAttribute('aria-hidden', 'true');
      const key = document.createElement('kbd');
      key.textContent = keyText;
      const label = document.createElement('span');
      label.className = 'ability-hud__label';
      label.textContent = nameText;
      const clock = document.createElement('span');
      clock.className = 'ability-hud__cooldown-clock';
      clock.setAttribute('aria-hidden', 'true');
      const cooldown = document.createElement('span');
      cooldown.className = 'ability-hud__cooldown';
      cooldown.textContent = `${(cooldownMs / 1000).toFixed(1)} s`;
      item.append(icon, key, label, clock, cooldown);
      const row = { item, clock, cooldown, cooldownMs, label: cooldown.textContent, name: nameText, key: keyText };
      rows.set(action.id, row);
      const remaining = (cooldownUntil.get(action.id) ?? 0) - performance.now();
      if (remaining > 0) startCooldown(row, remaining);
      else cooldownUntil.delete(action.id);
      activeActions.append(item);
    });
    root.append(activeActions);

    if (editing) {
      const editor = document.createElement('section');
      editor.className = 'ability-hud__editor';
      editor.setAttribute('aria-label', 'Editar configuración de controles');
      const title = document.createElement('strong');
      title.textContent = 'Arrastrá una habilidad a un control o elegila en la lista.';
      editor.append(title);
      const slots = document.createElement('div');
      slots.className = 'ability-hud__slots';
      CONTROL_SLOTS.forEach((code, index) => {
        const slot = document.createElement('div');
        slot.className = `ability-hud__slot${selectedSlot === index ? ' selected' : ''}`;
        slot.addEventListener('dragover', (event) => event.preventDefault());
        slot.addEventListener('drop', (event) => {
          event.preventDefault();
          const id = event.dataTransfer?.getData('text/plain') ?? '';
          if (actionById.has(id)) assignAction(index, id);
        });
        const key = document.createElement('kbd');
        key.textContent = prettyKey(code);
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Habilidad asignada a ${prettyKey(code)}`);
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Vacío';
        select.append(empty);
        for (const action of BODY_ACTIONS) {
          const option = document.createElement('option');
          option.value = action.id;
          option.textContent = actionName(action.id);
          select.append(option);
        }
        select.value = getLoadout()[index] ?? '';
        select.addEventListener('focus', () => { selectedSlot = index; });
        select.addEventListener('change', () => assignAction(index, select.value || null));
        slot.append(key, select);
        slots.append(slot);
      });
      editor.append(slots);
      const catalog = document.createElement('div');
      catalog.className = 'ability-hud__catalog';
      catalog.setAttribute('aria-label', 'Catálogo de habilidades');
      for (const action of BODY_ACTIONS) {
        const ability = document.createElement('button');
        ability.type = 'button';
        ability.className = 'ability-hud__catalog-item';
        ability.draggable = true;
        ability.textContent = actionName(action.id);
        ability.addEventListener('dragstart', (event) => event.dataTransfer?.setData('text/plain', action.id));
        ability.addEventListener('click', () => assignAction(selectedSlot, action.id));
        catalog.append(ability);
      }
      editor.append(catalog);
      root.append(editor);
    }

    announcement = document.createElement('span');
    announcement.className = 'ability-hud__status';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    root.append(announcement);
  };

  render();
  subscribeLoadouts(render);
  document.addEventListener('keydown', (event) => {
    if (isTextInputFocused() || event.repeat || !LOADOUT_KEYS.includes(event.code as typeof LOADOUT_KEYS[number])) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectLoadout(LOADOUT_KEYS.indexOf(event.code as typeof LOADOUT_KEYS[number]));
  }, true);
  window.addEventListener(COOLDOWN_EVENT, (event) => {
    const actionId = (event as CustomEvent<{ actionId: string }>).detail?.actionId;
    const cooldownMs = actionId ? actionById.get(actionId)?.cooldownMs ?? 0 : 0;
    if (!actionId || cooldownMs <= 0) return;
    cooldownUntil.set(actionId, performance.now() + cooldownMs);
    const row = rows.get(actionId);
    if (row) {
      startCooldown(row, cooldownMs);
      announcement.textContent = `${row.name}: Enfriando`;
    }
  });
  root.addEventListener('animationend', (event) => {
    const clock = event.target;
    if (!(clock instanceof HTMLElement) || !clock.classList.contains('ability-hud__cooldown-clock')) return;
    const item = clock.closest<HTMLButtonElement>('.ability-hud__item');
    const actionId = [...rows].find(([, row]) => row.clock === clock)?.[0];
    if (!item || !actionId || !item.classList.contains('is-cooling-down')) return;
    cooldownUntil.delete(actionId);
    item.classList.remove('is-cooling-down');
    clock.classList.remove('is-spinning');
    const row = rows.get(actionId)!;
    row.cooldown.textContent = row.label;
    item.setAttribute('aria-label', `${row.name}, ${row.key}, Listo; activar`);
    announcement.textContent = `${row.name}: Listo`;
  });
}
