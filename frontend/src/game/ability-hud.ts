/** Builds the ability reference HUD from the same action and key data used by gameplay. */
import { BODY_ACTIONS } from '@/game-data/actions';
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';

const COOLDOWN_EVENT = 'ability-cooldown-start';

export function mountAbilityHud(root: HTMLElement): void {
  const rows = new Map<string, { item: HTMLElement; clock: HTMLElement; cooldown: HTMLElement; cooldownMs: number; label: string }>();

  for (const action of BODY_ACTIONS) {
    const keyText = (INTENT_KEY_CODES[action.control.inputIntent] ?? [])
      .map((code) => code.startsWith('Key') ? code.slice(3) : code === 'Mouse0' ? 'Click izq.' : code)
      .join(' / ') || '—';
    const cooldownMs = action.cooldownMs ?? 0;
    const cooldownText = `${(cooldownMs / 1000).toFixed(1)} s`;
    const nameText = action.id === 'attack' ? 'Ataque' : action.id.replaceAll('_', ' ');
    const item = document.createElement('div');
    item.className = 'ability-hud__item';
    item.setAttribute('aria-label', `${nameText}, ${keyText}, cooldown configurado ${cooldownText}`);

    const icon = document.createElement('span');
    icon.className = 'ability-hud__icon';
    icon.textContent = action.id === 'attack' ? '⚔' : nameText.slice(0, 1).toUpperCase();
    icon.setAttribute('aria-hidden', 'true');
    const key = document.createElement('kbd');
    key.textContent = keyText;
    const name = document.createElement('span');
    name.className = 'ability-hud__name';
    name.textContent = nameText;
    const cooldown = document.createElement('small');
    cooldown.textContent = `CD ${cooldownText}`;
    const clock = document.createElement('span');
    clock.className = 'ability-hud__clock';
    clock.setAttribute('aria-hidden', 'true');
    icon.append(clock);
    item.append(icon, key, name, cooldown);
    root.append(item);
    rows.set(action.id, { item, clock, cooldown, cooldownMs, label: `${nameText}, ${keyText}` });
  }

  window.addEventListener(COOLDOWN_EVENT, (event) => {
    const actionId = (event as CustomEvent<{ actionId: string }>).detail?.actionId;
    const row = actionId ? rows.get(actionId) : undefined;
    if (!row || row.cooldownMs <= 0) return;

    row.clock.style.setProperty('--cooldown-duration', `${row.cooldownMs}ms`);
    row.item.classList.add('is-cooling-down');
    row.cooldown.textContent = 'Enfriando…';
    row.item.setAttribute('aria-label', `${row.label}, en cooldown`);
    row.clock.classList.remove('is-spinning');
    void row.clock.offsetWidth;
    row.clock.classList.add('is-spinning');
  });

  for (const { item, clock, cooldown, cooldownMs, label } of rows.values()) {
    clock.addEventListener('animationend', () => {
      item.classList.remove('is-cooling-down');
      cooldown.textContent = 'Listo';
      item.setAttribute('aria-label', `${label}, listo para usar; cooldown ${cooldownMs / 1000} segundos`);
    });
  }
}
