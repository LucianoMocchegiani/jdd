/**
 * @file Aplica un input histórico y simula un tick fijo (~30 Hz).
 */

import { FacingComponent } from '@/ecs/components/facing';
import { InputComponent } from '@/ecs/components/input';
import type { World } from '@/ecs/core';
import type { PlayerSimulationRunner } from '@/game/client-prediction/replay-runner';
import { RECONCILE_FIXED_DT_SEC } from '@/game-data/reconciliation';
import type { PendingInput } from '@/types/reconciliation';

const MOVEMENT_INTENT_KEYS = [
  'move_forward',
  'move_backward',
  'move_left',
  'move_right',
  'run_forward',
  'jump',
] as const;

/** Export `applyPendingInputToEntity` — apply pending input to entity. */
export function applyPendingInputToEntity(
  world: World,
  entityId: number,
  pending: PendingInput,
): void {
  const input = world.getComponent<InputComponent>(entityId, 'input');
  const facing = world.getComponent<FacingComponent>(entityId, 'facing');
  if (!input || !facing) {
    return;
  }

  input.clear();
  for (const key of MOVEMENT_INTENT_KEYS) {
    if (pending.intents[key] === true) {
      input.setIntent(key, true);
    }
  }
  facing.yaw = pending.yaw;
}

/** Export `replaySimulationTick` — replay simulation tick. */
export function replaySimulationTick(
  world: World,
  entityId: number,
  runner: PlayerSimulationRunner,
  pending: PendingInput,
  deltaTime: number = RECONCILE_FIXED_DT_SEC,
): void {
  applyPendingInputToEntity(world, entityId, pending);
  runner.runTick(deltaTime, pending.pitch);
}
