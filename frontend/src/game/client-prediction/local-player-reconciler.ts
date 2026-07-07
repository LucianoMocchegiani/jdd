/**
 * @file Reconciliación del jugador local: snap + replay de inputs pendientes.
 */

import { ContactComponent } from '@/ecs/components/contact';
import { FacingComponent } from '@/ecs/components/facing';
import { KinematicsComponent } from '@/ecs/components/kinematics';
import { PositionComponent } from '@/ecs/components/position';
import type { World } from '@/ecs/core';
import type { PlayerSimulationRunner } from '@/game/client-prediction/replay-runner';
import {
  isReconciliationEnabled,
  RECONCILE_FIXED_DT_SEC,
  RECONCILE_MAX_REPLAY_TICKS,
} from '@/game-data/reconciliation';
import {
  isSameSnapshot,
  normalizePlayerState,
} from '@/game/client-prediction/authoritative-snapshot';
import type { InputHistory } from '@/game/client-prediction/input-history';
import { decideCorrectionMode } from '@/game/client-prediction/correction-policy';
import { updateReconciliationDebugState } from '@/game/debug/reconciliation-debug';
import { replaySimulationTick } from '@/game/client-prediction/replay-tick';
import type { AuthoritativeSnapshot, ReconcileResult } from '@/types/reconciliation';
import type { PlayerStateEvent } from '@/types/world-events';

const BLEND_FACTOR = 0.35;

/** Export `LocalPlayerReconciler` — local player reconciler. */
export class LocalPlayerReconciler {
  private lastApplied: AuthoritativeSnapshot | null = null;
  private lastAckedSeq = 0;

  constructor(
    private readonly localPlayerId: string,
    private readonly history: InputHistory,
    private readonly runner: PlayerSimulationRunner,
  ) {}

  onPlayerState(
    world: World,
    entityId: number,
    event: PlayerStateEvent,
  ): ReconcileResult {
    if (event.player_id !== this.localPlayerId) {
      return { mode: 'skip', replayCount: 0, reason: 'remote player' };
    }

    if (!isReconciliationEnabled()) {
      updateReconciliationDebugState({
        lastMode: 'disabled',
        lastReason: 'reconcile-off',
        pendingInputs: this.history.pendingCount,
      });
      return { mode: 'skip', replayCount: 0, reason: 'reconcile-off' };
    }

    const snapshot = normalizePlayerState(event);

    if (this.lastApplied && isSameSnapshot(this.lastApplied, snapshot)) {
      return { mode: 'skip', replayCount: 0, reason: 'duplicate snapshot' };
    }

    if (snapshot.inputSeq < this.lastAckedSeq) {
      return { mode: 'skip', replayCount: 0, reason: 'stale input_seq' };
    }

    const pos = world.getComponent<PositionComponent>(entityId, 'position');
    const kin = world.getComponent<KinematicsComponent>(entityId, 'kinematics');
    const contact = world.getComponent<ContactComponent>(entityId, 'contact');
    if (!pos || !kin || !contact) {
      return { mode: 'skip', replayCount: 0, reason: 'missing components' };
    }

    const { mode, reason } = decideCorrectionMode(
      {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        medium: contact.medium,
      },
      snapshot,
    );

    this.lastAckedSeq = snapshot.inputSeq;
    this.lastApplied = snapshot;

    if (mode === 'skip') {
      this.history.dropThrough(snapshot.inputSeq);
      updateReconciliationDebugState({
        lastAckedSeq: snapshot.inputSeq,
        lastServerTick: snapshot.serverTick,
        lastReplayCount: 0,
        pendingInputs: this.history.after(snapshot.inputSeq).length,
        lastMode: 'skip',
        lastReason: reason,
      });
      return { mode: 'skip', replayCount: 0, reason };
    }

    if (mode === 'blend') {
      this.blendTowardServer(pos, kin, snapshot);
      this.history.dropThrough(snapshot.inputSeq);
      updateReconciliationDebugState({
        lastAckedSeq: snapshot.inputSeq,
        lastServerTick: snapshot.serverTick,
        lastReplayCount: 0,
        pendingInputs: this.history.after(snapshot.inputSeq).length,
        lastMode: 'blend',
        lastReason: reason,
      });
      return { mode: 'blend', replayCount: 0, reason };
    }

    this.snapToServer(world, entityId, snapshot);
    this.history.dropThrough(snapshot.inputSeq);

    const pending = this.history.after(snapshot.inputSeq);
    const replayCount = Math.min(pending.length, RECONCILE_MAX_REPLAY_TICKS);

    for (let i = 0; i < replayCount; i += 1) {
      replaySimulationTick(world, entityId, this.runner, pending[i]!, RECONCILE_FIXED_DT_SEC);
    }

    updateReconciliationDebugState({
      lastAckedSeq: snapshot.inputSeq,
      lastServerTick: snapshot.serverTick,
      lastReplayCount: replayCount,
      pendingInputs: Math.max(0, pending.length - replayCount),
      lastMode: 'snap',
      lastReason: reason,
    });

    return { mode: 'snap', replayCount, reason };
  }

  private snapToServer(
    world: World,
    entityId: number,
    snapshot: AuthoritativeSnapshot,
  ): void {
    const pos = world.getComponent<PositionComponent>(entityId, 'position');
    const kin = world.getComponent<KinematicsComponent>(entityId, 'kinematics');
    const contact = world.getComponent<ContactComponent>(entityId, 'contact');
    const facing = world.getComponent<FacingComponent>(entityId, 'facing');
    if (!pos || !kin || !contact || !facing) {
      return;
    }

    pos.x = snapshot.x;
    pos.y = snapshot.y;
    pos.z = snapshot.z;
    kin.vx = snapshot.vx;
    kin.vy = snapshot.vy;
    kin.vz = snapshot.vz;
    contact.medium = snapshot.medium;
    facing.yaw = snapshot.yaw;
  }

  private blendTowardServer(
    pos: PositionComponent,
    kin: KinematicsComponent,
    snapshot: AuthoritativeSnapshot,
  ): void {
    const t = BLEND_FACTOR;
    pos.x += (snapshot.x - pos.x) * t;
    pos.y += (snapshot.y - pos.y) * t;
    pos.z += (snapshot.z - pos.z) * t;
    kin.vx += (snapshot.vx - kin.vx) * t;
    kin.vy += (snapshot.vy - kin.vy) * t;
    kin.vz += (snapshot.vz - kin.vz) * t;
  }
}
