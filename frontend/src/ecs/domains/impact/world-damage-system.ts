/**
 * @file Daño a partículas del viewport según el `impact` de la ficha activa.
 *
 * Online: envía la acción al servidor; este resuelve su impacto autoritativamente.
 */

import { ActionsComponent } from '@/ecs/components/actions';
import { FacingComponent } from '@/ecs/components/facing';
import { PositionComponent } from '@/ecs/components/position';
import { System } from '@/ecs/core';
import { getActionById } from '@/game-data/actions';
import type { WorldRealtimeClient } from '@/game/network/ws-client';
import type { TerrainStore } from '@/game/terrain/terrain-store';
import type { SwingCommand } from '@/types/world-events';

const COOLDOWN_EVENT = 'ability-cooldown-start';

export class WorldDamageSystem extends System {
  readonly priority = 22;
  readonly requiredComponents = ['position', 'actions'] as const;
  private readonly swingActionByEntity = new Map<number, string>();
  private readonly swingSeqByEntity = new Map<number, number>();

  constructor(
    private readonly terrain: TerrainStore,
    private readonly worldRealtime: WorldRealtimeClient,
    private readonly playerId: string,
  ) {
    super();
  }

  override update(_deltaTime: number): void {
    if (!this.terrain.bloqueId) return;
    const now = performance.now();
    for (const entityId of this.getEntities()) {
      const pos = this.world?.getComponent<PositionComponent>(entityId, 'position');
      const active = this.world?.getComponent<ActionsComponent>(entityId, 'actions');
      if (!pos || !active) continue;
      const attack = active.bodyActions && active.bodyActionsUntilMs > now ? active.bodyActions : null;
      const action = attack && getActionById(attack.id);
      if (!attack || (!action?.impact && !action?.projectile)) {
        this.swingActionByEntity.delete(entityId);
        continue;
      }
      if (this.swingActionByEntity.get(entityId) !== attack.id) {
        this.swingActionByEntity.set(entityId, attack.id);
        const facing = this.world?.getComponent<FacingComponent>(entityId, 'facing');
        if (this.sendSwingCommand(entityId, attack.id, pos, facing?.yaw)) {
          window.dispatchEvent(new CustomEvent(COOLDOWN_EVENT, { detail: { actionId: attack.id } }));
        }
      }
    }
  }

  private sendSwingCommand(entityId: number, actionId: string, pos: PositionComponent, yaw?: number): boolean {
    const seq = (this.swingSeqByEntity.get(entityId) ?? 0) + 1;
    this.swingSeqByEntity.set(entityId, seq);
    const cmd: SwingCommand = {
      type: 'swing', seq, action_id: actionId, entity_id: entityId,
      player_id: this.playerId, bloque_id: this.terrain.bloqueId,
      position: { x: pos.x, y: pos.y, z: pos.z }, ...(yaw !== undefined ? { yaw } : {}),
    };
    const sent = this.worldRealtime.send(cmd);
    if (!sent && import.meta.env.DEV) console.warn('[world-damage] WS no disponible para swing');
    return sent;
  }
}
