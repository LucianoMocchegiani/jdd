/** Health and mana presentation driven by authoritative `player_state` values. */
import { Vector3, type PerspectiveCamera } from 'three';
import type { RemoteHealthIndicator } from '@/game/client-prediction/remote-presence';

interface BarElements {
  element: HTMLDivElement;
  fill: HTMLDivElement;
  label: HTMLDivElement;
}

function createBar(label: string, local: boolean, color: string): BarElements {
  const element = document.createElement('div');
  Object.assign(element.style, {
    position: local ? 'relative' : 'absolute',
    width: local ? 'min(190px, calc(50vw - 24px))' : '78px',
    padding: local ? '5px 8px' : '3px 4px',
    borderRadius: '6px',
    color: '#fff',
    background: 'rgba(15, 23, 42, 0.88)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    font: local ? '12px system-ui, sans-serif' : '10px system-ui, sans-serif',
    textAlign: 'center',
    transform: local ? 'none' : 'translate(-50%, -100%)',
    pointerEvents: 'none',
  });
  element.setAttribute('role', 'progressbar');
  element.setAttribute('aria-label', label);
  const text = document.createElement('div');
  const track = document.createElement('div');
  Object.assign(track.style, {
    height: local ? '9px' : '5px',
    marginTop: '3px',
    overflow: 'hidden',
    borderRadius: '99px',
    background: 'rgba(15, 23, 42, 0.9)',
  });
  const fill = document.createElement('div');
  Object.assign(fill.style, { height: '100%', width: '100%', background: color });
  track.append(fill);
  element.append(text, track);
  return { element, fill, label: text };
}

/** Local resource bars and projected health bars over remote characters. */
export class HealthHud {
  private readonly root = document.createElement('div');
  private readonly local = document.createElement('div');
  private readonly health = createBar('Tu salud', true, '#4ade80');
  private readonly mana = createBar('Tu maná', true, '#38bdf8');
  private readonly conditions = document.createElement('div');
  private readonly remotes = new Map<string, BarElements>();
  private readonly projected = new Vector3();
  private renderedConditions = '';

  constructor() {
    const bottomHud = document.querySelector<HTMLElement>('#bottom-hud');
    if (!bottomHud) throw new Error('Missing #bottom-hud');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '8',
      pointerEvents: 'none',
    });
    Object.assign(this.local.style, { display: 'flex', flexDirection: 'column', gap: '3px' });
    Object.assign(this.conditions.style, {
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px',
      maxWidth: 'min(380px, calc(100vw - 24px))', marginBottom: '2px',
    });
    this.conditions.setAttribute('role', 'group');
    this.conditions.setAttribute('aria-label', 'Condiciones activas');
    this.local.append(this.conditions, this.health.element, this.mana.element);
    bottomHud.prepend(this.local);
    document.body.append(this.root);
  }

  update(
    health: number | null,
    maxHealth: number,
    mana: number | null,
    maxMana: number,
    inCombat: boolean,
    activeConditions: readonly string[],
    remoteHealth: RemoteHealthIndicator[],
    camera: PerspectiveCamera,
    cellSize: number,
  ): void {
    this.health.element.hidden = health === null || !Number.isFinite(health);
    if (health !== null && Number.isFinite(health)) this.setValue(this.health, health, maxHealth, 'Salud');
    this.mana.element.hidden = mana === null || !Number.isFinite(mana);
    if (mana !== null && Number.isFinite(mana)) this.setValue(this.mana, mana, maxMana, 'Maná', '#38bdf8');

    const conditionIds = [...new Set([...activeConditions, ...(inCombat ? ['in_combat'] : [])])];
    const conditionKey = conditionIds.join('\0');
    if (conditionKey !== this.renderedConditions) {
      this.renderedConditions = conditionKey;
      this.conditions.replaceChildren(...conditionIds.map((id) => {
        const badge = document.createElement('span');
        badge.textContent = id;
        Object.assign(badge.style, {
          padding: '3px 7px', borderRadius: '99px', color: '#f8fafc',
          background: 'rgba(127, 29, 29, 0.9)', border: '1px solid rgba(251, 113, 133, 0.55)',
          font: '11px system-ui, sans-serif',
        });
        return badge;
      }));
      this.conditions.hidden = conditionIds.length === 0;
    }

    const visible = new Set<string>();
    camera.updateMatrixWorld();
    for (const remote of remoteHealth) {
      if (!Number.isFinite(remote.health) || !Number.isFinite(remote.maxHealth) || remote.maxHealth <= 0) continue;
      visible.add(remote.playerId);
      let bar = this.remotes.get(remote.playerId);
      if (!bar) {
        bar = createBar('Salud de jugador', false, '#4ade80');
        this.remotes.set(remote.playerId, bar);
        this.root.append(bar.element);
      }
      this.setValue(bar, remote.health, remote.maxHealth, '');
      this.projected.set(remote.x * cellSize, (remote.z + 2.2) * cellSize, remote.y * cellSize).project(camera);
      bar.element.hidden = this.projected.z < -1 || this.projected.z > 1;
      if (!bar.element.hidden) {
        bar.element.style.left = `${(this.projected.x * 0.5 + 0.5) * window.innerWidth}px`;
        bar.element.style.top = `${(-this.projected.y * 0.5 + 0.5) * window.innerHeight}px`;
      }
    }
    for (const [playerId, bar] of this.remotes) {
      if (!visible.has(playerId)) {
        bar.element.remove();
        this.remotes.delete(playerId);
      }
    }
  }

  private setValue(bar: BarElements, value: number, maxValue: number, prefix: string, color?: string): void {
    if (!Number.isFinite(maxValue) || maxValue <= 0) return;
    const shown = Math.max(0, Math.min(value, maxValue));
    const ratio = shown / maxValue;
    bar.element.setAttribute('aria-valuemin', '0');
    bar.element.setAttribute('aria-valuemax', String(maxValue));
    bar.element.setAttribute('aria-valuenow', String(shown));
    bar.label.textContent = `${prefix ? `${prefix}: ` : ''}${shown} / ${maxValue}`;
    bar.fill.style.width = `${ratio * 100}%`;
    bar.fill.style.background = color ?? (ratio < 0.25 ? '#f87171' : ratio < 0.55 ? '#facc15' : '#4ade80');
  }
}
