/**
 * @file Fichas de acción ganadoras por slot (rellena {@link ActionOrchestratorSystem}).
 *
 * Una ficha por canal (`constant_displacements`, `impulse_displacements`, …).
 * No se apilan varias del mismo slot; ver {@link getActiveDefinitions}.
 */

import { Component } from '@/ecs/core';
import type { ActionDefinition } from '@/types/action';

/**
 * Acciones activas tras el resolver cada frame (habilidades en curso).
 */
export class ActionsComponent extends Component {
  readonly type = 'actions';

  constructor(
    /** Desplazamiento sostenido: walk, run, swim, fly… */
    public constantDisplacements: ActionDefinition | null = null,
    /** Impulsos: jump, dash… */
    public impulseDisplacements: ActionDefinition | null = null,
    /** Manos / combate: attack, parry… */
    public bodyActions: ActionDefinition | null = null,
    /** Modo cuerpo entero: agarrar, trepar… */
    public fullBodyAction: ActionDefinition | null = null,
    /**
     * Fin del latch de `body_actions` en `performance.now()`.
     * `0` = sin latch. Para `one_shot`, el resolver escribe `now + durationMs`.
     */
    public bodyActionsUntilMs = 0,
  ) {
    super();
  }

  /**
   * Limpia slots que se re-resuelven cada frame.
   * No toca `bodyActions` ni `bodyActionsUntilMs` (el resolver gestiona el latch).
   */
  clearTransient(): void {
    this.constantDisplacements = null;
    this.impulseDisplacements = null;
    this.fullBodyAction = null;
  }

  /**
   * Lista plana de fichas activas (máx. una por slot).
   *
   * @param nowMs - `performance.now()` del frame actual
   * @returns Copia lógica: 0–4 elementos, sin duplicar slot
   */
  getActiveDefinitions(nowMs: number): ActionDefinition[] {
    const list: ActionDefinition[] = [];
    if (this.constantDisplacements) {
      list.push(this.constantDisplacements);
    }
    if (this.impulseDisplacements) {
      list.push(this.impulseDisplacements);
    }
    if (this.bodyActions && this.bodyActionsUntilMs > nowMs) {
      list.push(this.bodyActions);
    }
    if (this.fullBodyAction) {
      list.push(this.fullBodyAction);
    }
    return list;
  }
}
