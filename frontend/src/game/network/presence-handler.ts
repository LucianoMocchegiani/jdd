/**
 * @file Handler de presencia — gestiona join_block y eventos de jugadores remotos.
 *
 * Espejo servidor: `backend/src/game/network/presence_handler.py`.
 *
 * Responsabilidades:
 * - Enviar `join_block` al conectar el WS.
 * - Actualizar {@link RemotePresence} con `player_state`, `player_joined`, `player_left`.
 *
 * No maneja debug — esos callbacks quedan en `app.ts`.
 */

import type { SessionEvent } from '@/types/world-events';
import { getPreferredWireFormat } from '@/api/config';
import type { WorldRealtimeClient } from '@/game/network/ws-client';
import type { RemotePresence } from '@/game/client-prediction/remote-presence';

/** Export `PresenceHandler` — presence handler. */
export class PresenceHandler {
  constructor(
    private readonly client: WorldRealtimeClient,
    private readonly remotePresence: RemotePresence,
    private readonly playerId: string,
    private readonly bloqueId: string,
  ) {}

  /** Llamar desde `onOpen` del WS — envía join_block al servidor. */
  onOpen(spawnX: number, spawnY: number, spawnZ: number, playerEntityId: number): void {
    const sent = this.client.send({
      type: 'join_block',
      bloque_id: this.bloqueId,
      player_id: this.playerId,
      position: { x: spawnX, y: spawnY, z: spawnZ },
      entity_id: playerEntityId,
      yaw: 0,
      wire_format: getPreferredWireFormat(),
    });
    if (!sent && import.meta.env.DEV) {
      console.warn('[presence] join_block no enviado (WS no OPEN)');
    }
  }

  /** Llamar desde `onSessionEvent` del WS — actualiza presencia remota. */
  onSessionEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'player_state':
        this.remotePresence.applyPlayerState(event);
        break;
      case 'player_joined':
        this.remotePresence.onPlayerJoined(event);
        break;
      case 'player_left':
        this.remotePresence.onPlayerLeft(event.player_id);
        break;
      case 'join_ok':
        if (import.meta.env.DEV) {
          console.info('[presence] join_ok', event.players.length, 'en sala', event.wire_format ?? 'json');
        }
        break;
      case 'join_error':
        if (import.meta.env.DEV) {
          console.warn('[presence] join_error', event.error);
        }
        break;
    }
  }
}
