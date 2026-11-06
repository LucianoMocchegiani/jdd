/**
 * @file Apariencia animada del jugador local con el rig del Character Studio.
 *
 * Lee `appearance.clip` de las acciones ECS, muestrea el clip y actualiza la pose
 * y el tinte del personaje. No mezcla animaciones: elige un único clip ganador
 * por frame según la prioridad de los slots de acción.
 */

import { ActionsComponent } from '@/ecs/components/actions';
import { ConditionsComponent } from '@/ecs/components/conditions';
import { FacingComponent } from '@/ecs/components/facing';
import { PositionComponent } from '@/ecs/components/position';
import { System } from '@/ecs/core';
import { resolveConditionTint } from '@/ecs/domains/condition/resolve-condition-effects';
import { PlayerCharacterVisual } from '@/game/player/player-character-visual';
import type { Group } from 'three';

/**
 * Actualiza la pose del jugador local según las acciones ECS activas.
 *
 * - Entrada: acciones, posición, orientación y condiciones del jugador.
 * - Salida: clip muestreado y tinte aplicado al rig del Character Studio.
 * - Prioridad **25**: después de movement (20) e impact (22), cuando el estado
 *   de acción del frame ya está fijado.
 *
 * Solo afecta a `playerEntityId`; no recorre otras entidades.
 */
export class AppearanceSystem extends System {
  readonly priority = 25;
  readonly requiredComponents = ['actions', 'conditions', 'position', 'facing'] as const;
  private readonly character: PlayerCharacterVisual;

  /**
   * @param playerEntityId - Entidad ECS creada en `spawn-player`
   * @param playerMesh - Ancla del jugador que contiene su visual del Character Studio
   */
  constructor(
    private readonly playerEntityId: number,
    playerMesh: Group,
  ) {
    super();
    this.character = playerMesh.userData.characterVisual as PlayerCharacterVisual;
  }

  /** Actualiza una vez por frame la animación y presentación del jugador. */
  override update(deltaTime: number): void {
    if (!this.getEntities().has(this.playerEntityId)) return;

    const actions = this.world?.getComponent<ActionsComponent>(this.playerEntityId, 'actions');
    const position = this.world?.getComponent<PositionComponent>(this.playerEntityId, 'position');
    const facing = this.world?.getComponent<FacingComponent>(this.playerEntityId, 'facing');
    const conditions = this.world?.getComponent<ConditionsComponent>(this.playerEntityId, 'conditions');
    if (!actions || !position || !facing) return;

    const clip = this.pickClip(actions, performance.now());
    const tint = conditions ? resolveConditionTint(conditions.active) : null;
    this.character.update(deltaTime, clip, position.x, position.y, position.z, facing.yaw, tint);
  }

  /**
   * Elige un único `appearance.clip` para el frame.
   *
   * Prioridad (mayor gana): `body_actions` vigente → `impulse_displacements` →
   * `constant_displacements`. Así, las acciones corporales tapan locomoción
   * mientras dura su latch, sin mezclar clips.
   *
   * @param active - Acciones ganadoras este frame
   * @param nowMs - `performance.now()` para comparar `bodyActionsUntilMs`
   * @returns Nombre del clip o `null` si no hay una acción con clip
   */
  private pickClip(active: ActionsComponent, nowMs: number): string | null {
    if (active.bodyActions && active.bodyActionsUntilMs > nowMs) {
      return active.bodyActions.appearance?.clip ?? null;
    }
    if (active.impulseDisplacements) {
      return active.impulseDisplacements.appearance?.clip ?? null;
    }
    return active.constantDisplacements?.appearance?.clip ?? null;
  }
}
