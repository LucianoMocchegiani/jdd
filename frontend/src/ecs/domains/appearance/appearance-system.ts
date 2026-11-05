/**
 * Apariencia animada del jugador local, usando rig y clips del Character Studio.
 */

import { ActionsComponent } from '@/ecs/components/actions';
import { ConditionsComponent } from '@/ecs/components/conditions';
import { FacingComponent } from '@/ecs/components/facing';
import { PositionComponent } from '@/ecs/components/position';
import { System } from '@/ecs/core';
import { resolveConditionTint } from '@/ecs/domains/condition/resolve-condition-effects';
import { PlayerCharacterVisual } from '@/game/player/player-character-visual';
import type { Group } from 'three';

export class AppearanceSystem extends System {
  readonly priority = 25;
  readonly requiredComponents = ['actions', 'conditions', 'position', 'facing'] as const;
  private readonly character: PlayerCharacterVisual;

  constructor(
    private readonly playerEntityId: number,
    playerMesh: Group,
  ) {
    super();
    this.character = playerMesh.userData.characterVisual as PlayerCharacterVisual;
  }

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
