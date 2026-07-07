/**
 * @file Orquestador: resuelve fichas y escribe {@link ActionsComponent}.
 */

import { ActionsComponent } from '@/ecs/components/actions';
import { ConditionsComponent } from '@/ecs/components/conditions';
import { InputComponent } from '@/ecs/components/input';
import { ContactComponent } from '@/ecs/components/contact';
import { System } from '@/ecs/core';
import { resolveActions } from '@/ecs/domains/action/action-resolver';

/**
 * Prioridad entre contact (10) y movement (20).
 */
export class ActionOrchestratorSystem extends System {
  readonly priority = 15;
  readonly requiredComponents = ['input', 'contact', 'conditions', 'actions'] as const;

  private onActionResolved?: (label: string) => void;

  /**
   * @param onActionResolved - Callback opcional para HUD (`acción: run`)
   */
  constructor(onActionResolved?: (label: string) => void) {
    super();
    this.onActionResolved = onActionResolved;
  }

  override update(_deltaTime: number): void {
    const nowMs = performance.now();

    for (const entityId of this.getEntities()) {
      const input = this.world?.getComponent<InputComponent>(entityId, 'input');
      const contact = this.world?.getComponent<ContactComponent>(entityId, 'contact');
      const conditions = this.world?.getComponent<ConditionsComponent>(entityId, 'conditions');
      const active = this.world?.getComponent<ActionsComponent>(entityId, 'actions');
      if (!input || !contact || !conditions || !active) {
        continue;
      }

      active.clearTransient();
      const resolved = resolveActions(input, contact, conditions, active, nowMs);
      active.constantDisplacements = resolved.constantDisplacements;
      active.impulseDisplacements = resolved.impulseDisplacements;
      active.bodyActions = resolved.bodyActions;
      active.fullBodyAction = resolved.fullBodyAction;
      active.bodyActionsUntilMs = resolved.bodyActionsUntilMs;

      const parts: string[] = [];
      if (active.constantDisplacements) {
        parts.push(active.constantDisplacements.id);
      }
      if (active.impulseDisplacements) {
        parts.push(active.impulseDisplacements.id);
      }
      if (active.bodyActions && active.bodyActionsUntilMs > nowMs) {
        parts.push(active.bodyActions.id);
      }
      this.onActionResolved?.(parts.length > 0 ? `acción: ${parts.join(' + ')}` : 'acción: —');
    }
  }
}
