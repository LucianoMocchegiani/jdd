/**
 * @file Runtime del juego: input sender.
 */

﻿/**
 * @file Envío throttled de intents de locomoción al servidor (Sprint C).
 *
 * Espejo de `handle_input` en `backend/src/game/network/input_handler.py` (~30 Hz).
 *
 * **Contrato intents vs cámara:** si solo cambian `yaw`/`pitch`, no se envía la clave
 * `intents` (el servidor conserva el último WASD). Al soltar movimiento se manda `{}`.
 */

import type { InputCommand } from '@/types/world-events';
import type { WorldRealtimeClient } from '@/game/network/ws-client';
import { INPUT_SEND_INTERVAL_SEC } from '@/game-data/game-config';
import { recordInputSent } from '@/game/debug/input-stats-debug';
import type { InputHistory } from '@/game/client-prediction/input-history';
import type { PendingInput } from '@/types/reconciliation';

const MOVEMENT_INTENTS = [
  'move_forward',
  'move_backward',
  'move_left',
  'move_right',
  'run_forward',
  'jump',
] as const;

/** Cómo incluir `intents` en el wire. */
type IntentWireMode = 'omit' | 'clear' | 'active';

function packActiveIntents(intents: Record<string, boolean>): Record<string, true> {
  const out: Record<string, true> = {};
  for (const key of MOVEMENT_INTENTS) {
    if (intents[key] === true) {
      out[key] = true;
    }
  }
  return out;
}

/**
 * Envía `input` al servidor a intervalo fijo mientras el WS está abierto.
 */
export class NetworkInputSender {
  private lastSentAt = 0;
  private seq = 0;
  private lastPayload = '';
  private jumpWasActive = false;
  /** Había intents de locomoción en el último envío con clave `intents`. */
  private hadMovementIntent = false;
  /** Intents efectivos en el servidor tras el último envío con clave `intents`. */
  private lastEffectiveIntents: Record<string, boolean> = {};

  constructor(
    private readonly client: WorldRealtimeClient,
    private readonly bloqueId: string,
    private readonly playerId: string,
    private readonly history?: InputHistory,
  ) {}

  /** Último `seq` enviado por WS (0 si aún no hubo envíos). */
  get currentSeq(): number {
    return this.seq;
  }

  tick(
    nowSec: number,
    intents: Record<string, boolean>,
    yaw: number,
    pitch?: number,
  ): void {
    const packed = packActiveIntents(intents);
    const hasMovement = Object.keys(packed).length > 0;
    const jumpEdge = packed.jump === true && !this.jumpWasActive;
    this.jumpWasActive = packed.jump === true;

    const releaseEdge = this.hadMovementIntent && !hasMovement;
    let wireMode: IntentWireMode;
    if (hasMovement) {
      wireMode = 'active';
    } else if (releaseEdge) {
      wireMode = 'clear';
    } else {
      wireMode = 'omit';
    }

    const throttleElapsed = nowSec - this.lastSentAt >= INPUT_SEND_INTERVAL_SEC;
    if (!throttleElapsed && !jumpEdge && !releaseEdge) {
      return;
    }

    const payloadKey = JSON.stringify({ wireMode, packed, yaw, pitch });
    if (wireMode === 'omit' && payloadKey === this.lastPayload && !jumpEdge) {
      return;
    }

    this.lastSentAt = nowSec;
    this.lastPayload = payloadKey;
    this.seq += 1;

    if (wireMode === 'active' || wireMode === 'clear') {
      this.hadMovementIntent = hasMovement;
    }

    const cmd: InputCommand = {
      type: 'input',
      bloque_id: this.bloqueId,
      player_id: this.playerId,
      seq: this.seq,
      yaw,
    };
    if (pitch !== undefined) {
      cmd.pitch = pitch;
    }
    if (wireMode === 'active') {
      cmd.intents = packed;
      this.lastEffectiveIntents = { ...packed };
      recordInputSent('active', packed);
    } else if (wireMode === 'clear') {
      cmd.intents = {};
      this.lastEffectiveIntents = {};
      recordInputSent('clear', {});
    } else {
      recordInputSent('omit');
    }

    this.recordHistory(this.seq, wireMode, packed, yaw, pitch);

    this.client.send(cmd);
  }

  private recordHistory(
    seq: number,
    wireMode: IntentWireMode,
    packed: Record<string, true>,
    yaw: number,
    pitch?: number,
  ): void {
    if (!this.history) {
      return;
    }

    let intents: Record<string, boolean>;
    if (wireMode === 'active') {
      intents = { ...packed };
    } else if (wireMode === 'clear') {
      intents = {};
    } else {
      intents = { ...this.lastEffectiveIntents };
    }

    const entry: PendingInput = {
      seq,
      intents,
      yaw,
      sentAtMs: performance.now(),
    };
    if (pitch !== undefined) {
      entry.pitch = pitch;
    }
    this.history.push(entry);
  }
}
