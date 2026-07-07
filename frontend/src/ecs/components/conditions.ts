/**
 * @file Condiciones activas apilables en la entidad (fase 8).
 */

import { Component } from '@/ecs/core';

/** Instancia runtime de una ficha del condition registry. */
export interface ActiveConditionInstance {
  conditionId: string;
  stacks: number;
  /** `null` = sin expiración automática. */
  expiresAtMs: number | null;
}

/**
 * Estados del personaje (`stunned`, `poisoned`, `burning`, …).
 *
 * Escrito por {@link ConditionSystem}; leído por HUD, resolver y appliers futuros.
 */
export class ConditionsComponent extends Component {
  readonly type = 'conditions';

  active: ActiveConditionInstance[] = [];

  /** Último `dominantTipoNombre` usado para `onEnter` de partícula (evita re-aplicar cada frame). */
  lastContactTipoNombre: string | null = null;

  /** Acumulado de `effects.tick.damage` hasta tener HP de jugador (debug HUD). */
  debugDamageTotal = 0;

  /** Último tick por `conditionId` (`performance.now()`). */
  lastTickAtMs: Record<string, number> = {};

  ids(): string[] {
    return this.active.map((c) => c.conditionId);
  }
}
