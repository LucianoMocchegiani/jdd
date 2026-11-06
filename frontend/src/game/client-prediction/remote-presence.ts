/**
 * @file Réplicas animadas de otros jugadores con interpolación (Sprint B + D4).
 *
 * Recibe `player_state`, interpola posición/yaw y reutiliza el visual del Character Studio.
 */

import type { PlayerJoinedEvent, PlayerStateEvent } from '@/types/world-events';
import type { RemoteSnapshot } from '@/types/remote-player';
import { RemoteInterpolationBuffer } from '@/game/client-prediction/remote-interpolation';
import { PlayerCharacterVisual } from '@/game/player/player-character-visual';
import { selectRemoteClip } from '@/game/player/remote-animation';
import { Scene } from 'three';

const REMOTE_COLOR = 0x4488ff;

interface RemoteEntry {
  character: PlayerCharacterVisual;
  buffer: RemoteInterpolationBuffer;
  clip: string | null;
}

/** Gestiona visuales remotos por `player_id` (excluye al jugador local). */
export class RemotePresence {
  private readonly remotes = new Map<string, RemoteEntry>();
  /** Jugadores que salieron; ignora `player_state` en vuelo hasta un nuevo join. */
  private readonly leftPlayerIds = new Set<string>();
  private lastUpdateMs = performance.now();

  constructor(
    private readonly scene: Scene,
    private readonly cellSize: number,
    private readonly localPlayerId: string,
  ) {}

  /** Encola snapshot autoritativo (no mueve el visual hasta {@link update}). */
  applyPlayerState(event: PlayerStateEvent): void {
    if (event.player_id === this.localPlayerId || this.leftPlayerIds.has(event.player_id) || !event.bloque_id) return;

    const entry = this.ensureRemote(event.player_id);
    entry.clip = selectRemoteClip({
      medium: event.medium,
      vx: event.vx,
      vy: event.vy,
      vz: event.vz,
      intents: event.intents,
    });
    entry.buffer.push(this.toSnapshot(event));
  }

  /** Crea réplica inicial si hace falta (join de otro cliente). */
  onPlayerJoined(event: PlayerJoinedEvent): void {
    if (event.player_id === this.localPlayerId) return;

    this.leftPlayerIds.delete(event.player_id);
    const entry = this.ensureRemote(event.player_id);
    const nowMs = performance.now();
    entry.buffer.push({
      serverTick: 0,
      x: event.position.x,
      y: event.position.y,
      z: event.position.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      receivedAtMs: nowMs,
    });
    entry.character.update(0, null, event.position.x, event.position.y, event.position.z, 0, REMOTE_COLOR);
  }

  /** Elimina la réplica al salir otro jugador. */
  onPlayerLeft(playerId: string): void {
    this.leftPlayerIds.add(playerId);
    const entry = this.remotes.get(playerId);
    if (!entry) return;
    entry.character.dispose();
    this.remotes.delete(playerId);
  }

  /** Actualiza posición/yaw interpolados y anima todos los remotos (llamar cada frame). */
  update(nowMs: number = performance.now()): void {
    const deltaTime = Math.max(0, (nowMs - this.lastUpdateMs) / 1000);
    this.lastUpdateMs = nowMs;
    for (const entry of this.remotes.values()) {
      const state = entry.buffer.sample(nowMs);
      if (state) {
        entry.character.update(deltaTime, entry.clip, state.x, state.y, state.z, state.yaw, REMOTE_COLOR);
      }
    }
  }

  /** Cantidad de jugadores remotos visibles (debug HUD). */
  get remoteCount(): number {
    return this.remotes.size;
  }

  private ensureRemote(playerId: string): RemoteEntry {
    let entry = this.remotes.get(playerId);
    if (entry) return entry;
    entry = {
      character: new PlayerCharacterVisual(this.scene, this.cellSize),
      buffer: new RemoteInterpolationBuffer(),
      clip: null,
    };
    this.remotes.set(playerId, entry);
    return entry;
  }

  private toSnapshot(event: PlayerStateEvent): RemoteSnapshot {
    return {
      serverTick: event.server_tick,
      x: event.x,
      y: event.y,
      z: event.z,
      vx: event.vx,
      vy: event.vy,
      vz: event.vz,
      yaw: event.yaw,
      receivedAtMs: event.receivedAtMs ?? performance.now(),
    };
  }
}
