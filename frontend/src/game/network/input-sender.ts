import type { InputCommand } from '@/types/world-events';
import type { WorldRealtimeClient } from '@/game/network/ws-client';
import { INPUT_SEND_INTERVAL_SEC } from '@/game-data/game-config';
import { recordInputSent } from '@/game/debug/input-stats-debug';

const NETWORKED_INTENTS = [
  'move_forward', 'move_backward', 'move_left', 'move_right', 'run_forward', 'jump',
  'attack_light', 'attack_heavy', 'attack_projectile', 'attack_quick_projectile', 'attack_shockwave', 'attack_ki_shield', 'continuous_attack', 'continuous_aura', 'continuous_ki_shield',
] as const;
const ONE_SHOT_ATTACK_INTENTS = ['attack_light', 'attack_heavy', 'attack_projectile', 'attack_quick_projectile', 'attack_shockwave', 'attack_ki_shield'] as const;
type AttackIntent = typeof ONE_SHOT_ATTACK_INTENTS[number];
type IntentWireMode = 'omit' | 'clear' | 'active';

function packActiveIntents(intents: Record<string, boolean>): Record<string, true> {
  const out: Record<string, true> = {};
  for (const key of NETWORKED_INTENTS) if (intents[key] === true) out[key] = true;
  return out;
}

/** Devuelve true si una habilidad de un solo uso acaba de pasar de liberada a pulsada. */
export function hasNewAttackIntent(
  packed: Record<string, true>,
  wasActive: Record<AttackIntent, boolean>,
): boolean {
  let edge = false;
  for (const intent of ONE_SHOT_ATTACK_INTENTS) {
    const active = packed[intent] === true;
    edge = edge || (active && !wasActive[intent]);
    wasActive[intent] = active;
  }
  return edge;
}

/** Envía intents y orientación; omite intents sin cambios y fuerza envío en flancos de acción. */
export class NetworkInputSender {
  private lastSentAt = 0;
  private seq = 0;
  private lastPayload = '';
  private jumpWasActive = false;
  private attackWasActive: Record<AttackIntent, boolean> = {
    attack_light: false,
    attack_heavy: false,
    attack_projectile: false,
    attack_quick_projectile: false,
    attack_shockwave: false,
    attack_ki_shield: false,
  };
  private hadMovementIntent = false;

  constructor(
    private readonly client: WorldRealtimeClient,
    private readonly bloqueId: string,
    private readonly playerId: string,
  ) {}

  /** Secuencia del último mensaje numerado enviado o reservado. */
  get currentSeq(): number { return this.seq; }

  /** Reserva un número de la misma secuencia para comandos separados, como area_spell_cast. */
  reserveSequence(): number { return ++this.seq; }

  /** Procesa un frame de input y envía el comando si venció el intervalo o cambió una acción. */
  tick(nowSec: number, intents: Record<string, boolean>, yaw: number, pitch?: number): void {
    const packed = packActiveIntents(intents);
    const hasMovement = Object.keys(packed).length > 0;
    const jumpEdge = packed.jump === true && !this.jumpWasActive;
    this.jumpWasActive = packed.jump === true;
    const attackEdge = hasNewAttackIntent(packed, this.attackWasActive);
    const releaseEdge = this.hadMovementIntent && !hasMovement;
    const wireMode: IntentWireMode = hasMovement ? 'active' : releaseEdge ? 'clear' : 'omit';
    const throttleElapsed = nowSec - this.lastSentAt >= INPUT_SEND_INTERVAL_SEC;
    if (!throttleElapsed && !jumpEdge && !attackEdge && !releaseEdge) return;
    const payloadKey = JSON.stringify({ wireMode, packed, yaw, pitch });
    if (wireMode === 'omit' && payloadKey === this.lastPayload && !jumpEdge && !attackEdge) return;

    this.lastSentAt = nowSec;
    this.lastPayload = payloadKey;
    this.seq += 1;
    if (wireMode === 'active' || wireMode === 'clear') this.hadMovementIntent = hasMovement;
    const cmd: InputCommand = { type: 'input', bloque_id: this.bloqueId, player_id: this.playerId, seq: this.seq, yaw };
    if (pitch !== undefined) cmd.pitch = pitch;
    if (wireMode === 'active') {
      cmd.intents = packed;
      recordInputSent('active', packed);
    } else if (wireMode === 'clear') {
      cmd.intents = {};
      recordInputSent('clear', {});
    } else recordInputSent('omit');
    this.client.send(cmd);
  }
}
