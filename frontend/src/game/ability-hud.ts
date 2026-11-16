import { BODY_ACTIONS } from '@/game-data/actions';
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';
import { setVirtualKeyHeld } from '@/game/input/keyboard-state';

const COOLDOWN_EVENT = 'ability-cooldown-start';
const TARGET_REQUEST_EVENT = 'area-ability-target';
const pressTimers = new Map<string, number>();

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

export function mountAbilityHud(root: HTMLElement): void {
  const rows = new Map<string, { item: HTMLButtonElement; clock: HTMLElement; cooldown: HTMLElement; cooldownMs: number; label: string }>();
  for (const action of BODY_ACTIONS) {
    const keyText = (INTENT_KEY_CODES[action.control.inputIntent] ?? [])
      .map((code) => code.startsWith('Key') ? code.slice(3) : code === 'Mouse0' ? 'Click izq.' : code)
      .join(' / ') || '—';
    const cooldownMs = action.cooldownMs ?? 0;
    const cooldownText = `${(cooldownMs / 1000).toFixed(1)} s`;
    const nameText = action.id === 'attack' ? 'Ataque'
      : action.id === 'kamehameha' ? 'Kamehameha'
        : action.id === 'rayo_de_ki' ? 'Rayo de Ki'
          : action.id === 'orbe_explosivo' ? 'Orbe explosivo'
            : action.id === 'trueno' ? 'Trueno' : action.id.replaceAll('_', ' ');
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'ability-hud__item';
    item.setAttribute('aria-label', `${nameText}, ${keyText}, cooldown configurado ${cooldownText}; activar`);

    if (action.control.type === 'sustained' && INTENT_KEY_CODES[action.control.inputIntent]?.[0]) {
      const code = INTENT_KEY_CODES[action.control.inputIntent]![0]!;
      item.setAttribute('aria-pressed', 'false');
      const release = (): void => { setVirtualKeyHeld(code, false); item.setAttribute('aria-pressed', 'false'); };
      item.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setVirtualKeyHeld(code, true);
        item.setAttribute('aria-pressed', 'true');
      });
      item.addEventListener('pointerup', release);
      item.addEventListener('pointerleave', release);
      item.addEventListener('pointercancel', release);
      item.addEventListener('click', (event) => { if (event.detail === 0) {
        setVirtualKeyHeld(code, true);
        window.setTimeout(release, 120);
      } });
    } else {
      const activate = (): void => {
        if (action.area) window.dispatchEvent(new CustomEvent(TARGET_REQUEST_EVENT, { detail: { actionId: action.id } }));
        else pulseAction(action.control.inputIntent);
      };
      item.addEventListener('pointerdown', activate);
      item.addEventListener('click', (event) => { if (event.detail === 0) activate(); });
    }

    const icon = document.createElement('span');
    icon.className = 'ability-hud__icon';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'ability-hud__label';
    label.textContent = nameText;
    const clock = document.createElement('span');
    clock.className = 'ability-hud__cooldown-clock';
    clock.setAttribute('aria-hidden', 'true');
    const cooldown = document.createElement('span');
    cooldown.className = 'ability-hud__cooldown';
    cooldown.textContent = cooldownText;
    item.append(icon, label, clock, cooldown);
    root.append(item);
    rows.set(action.id, { item, clock, cooldown, cooldownMs, label: cooldown.textContent });
  }
  window.addEventListener(COOLDOWN_EVENT, (event) => {
    const actionId = (event as CustomEvent<{ actionId: string }>).detail?.actionId;
    const row = actionId ? rows.get(actionId) : undefined;
    if (!row || row.cooldownMs <= 0) return;
    row.clock.style.setProperty('--cooldown-duration', `${row.cooldownMs}ms`);
    row.item.classList.add('is-cooling-down');
    row.cooldown.textContent = 'Enfriando…';
    row.clock.classList.remove('is-spinning');
    void row.clock.offsetWidth;
    row.clock.classList.add('is-spinning');
  });
  for (const { item, clock, cooldown, label } of rows.values()) {
    clock.addEventListener('animationend', () => {
      item.classList.remove('is-cooling-down');
      clock.classList.remove('is-spinning');
      cooldown.textContent = label;
    });
  }
}
