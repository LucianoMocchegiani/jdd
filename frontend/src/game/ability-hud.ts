/** Builds the ability reference HUD from the same action and key data used by gameplay. */
import { BODY_ACTIONS } from '@/game-data/actions';
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';

export function mountAbilityHud(root: HTMLElement): void {
  for (const action of BODY_ACTIONS) {
    const keyText = (INTENT_KEY_CODES[action.control.inputIntent] ?? [])
      .map((code) => code.startsWith('Key') ? code.slice(3) : code === 'Mouse0' ? 'Click izq.' : code)
      .join(' / ') || '—';
    const cooldownText = `${((action.cooldownMs ?? 0) / 1000).toFixed(1)} s`;
    const item = document.createElement('div');
    item.className = 'ability-hud__item';
    item.setAttribute('aria-label', `${action.id}, ${keyText}, cooldown configurado ${cooldownText}`);

    const key = document.createElement('kbd');
    key.textContent = keyText;
    const name = document.createElement('span');
    name.textContent = action.id === 'attack' ? 'Ataque' : action.id.replaceAll('_', ' ');
    const cooldown = document.createElement('small');
    cooldown.textContent = `CD ${cooldownText}`;
    item.append(key, name, cooldown);
    root.append(item);
  }
}
