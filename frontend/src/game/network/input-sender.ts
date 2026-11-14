/**
 * @file Envío periódico de intents y orientación al servidor.
 *
 * **Contrato intents vs cámara:** si solo cambian `yaw`/`pitch`, no se envía la clave
 * `intents` (el servidor conserva el último estado recibido). Al soltar movimiento
 * se manda `{}` para que el servidor limpie los intents activos.
 */

import type { InputCommand } from '@/types/world-events';
import type { WorldRealtimeClient } from '@/game/network/ws-client';
import { INPUT_SEND_INTERVAL_SEC } from '@/game-data/game-config';
import { recordInputSent } from '@/game/debug/input-stats-debug';

const NETWORKED_INTENTS = [
  'move_forward',
  'move_backward',
  'move_left',
  'move_right',
  'run_forward',
  'jump',
  'attack_light',
  'attack_projectile',
] as const;

type IntentWireMode = 'omit' | 'clear' | 'active';

function packActiveIntents(intents: Record<string, boolean>): Record<string, true> {
  const out: Record<string, true> = {};
  for (const key of NETWORKED_INTENTS) {
    if (intents[key] === true) out[key] = true;
  }
  return out;
}

/** Envía los intents al servidor con el intervalo configurado y al detectar flancos. */
export class NetworkInputSender {
  private lastSentAt = 0;
  private seq = 0;
  private lastPayload = '';
  private jumpWasActive = false;
  private attackWasActive: Record<'attack_light' | 'attack_projectile', boolean> = {
    attack_light: false,
    attack_projectile: false,
  };
  /** Había intents activos en el último envío con clave `intents`. */
  private hadMovementIntent = false;

  constructor(
    private readonly client: WorldRealtimeClient,
    private readonly bloqueId: string,
    private readonly playerId: string,
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
    const attackEdge = (['attack_light', 'attack_projectile'] as const).some((intent) => {
      const active = packed[intent] === true;
      const edge = active && !this.attackWasActive[intent];
      this.attackWasActive[intent] = active;
      return edge;
    });

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
    if (!throttleElapsed && !jumpEdge && !attackEdge && !releaseEdge) {
      return;
    }

    const payloadKey = JSON.stringify({ wireMode, packed, yaw, pitch });
    if (wireMode === 'omit' && payloadKey === this.lastPayload && !jumpEdge && !attackEdge) {
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
      recordInputSent('active', packed);
    } else if (wireMode === 'clear') {
      cmd.intents = {};
      recordInputSent('clear', {});
    } else {
      recordInputSent('omit');
    }
    this.client.send(cmd);
  }
}
