/**
 * @file Réplicas visuales de otros jugadores con interpolación (Sprint B + D4).
 *
 * Recibe `player_state` / `player_joined`, acumula snapshots y suaviza posición
 * + yaw cada frame vía {@link RemoteInterpolationBuffer}.
 */

import type { PlayerJoinedEvent, PlayerStateEvent } from '@/types/world-events';
import type { RemoteSnapshot } from '@/types/remote-player';
import { createPlayerBodyMesh } from '@/game/player/player-body-visual';
import { RemoteInterpolationBuffer } from '@/game/client-prediction/remote-interpolation';
import { Group, MeshStandardMaterial, Scene } from 'three';

const REMOTE_COLOR = 0x4488ff;

interface RemoteEntry {
  group: Group;
  buffer: RemoteInterpolationBuffer;
}

/**
 * Gestiona meshes remotos por `player_id` (excluye al jugador local).
 */
export class RemotePresence {
  private readonly remotes = new Map<string, RemoteEntry>();
  /** Jugadores que salieron; ignora `player_state` en vuelo hasta un nuevo join. */
  private readonly leftPlayerIds = new Set<string>();
  private readonly material = new MeshStandardMaterial({ color: REMOTE_COLOR });

  /**
   * @param scene - Escena Three.js donde añadir cubos remotos.
   * @param cellSize - Escala mundo (como el jugador local).
   * @param localPlayerId - No crear réplica para este id.
   */
  constructor(
    private readonly scene: Scene,
    private readonly cellSize: number,
    private readonly localPlayerId: string,
  ) {}

  /**
   * Encola snapshot autoritativo (no mueve el mesh hasta {@link update}).
   */
  applyPlayerState(event: PlayerStateEvent): void {
    if (event.player_id === this.localPlayerId) {
      return;
    }
    if (this.leftPlayerIds.has(event.player_id)) {
      return;
    }
    if (!event.bloque_id) {
      return;
    }
    const entry = this.ensureRemote(event.player_id);
    entry.buffer.push(this.toSnapshot(event));
  }

  /** Crea réplica inicial si hace falta (join de otro cliente). */
  onPlayerJoined(event: PlayerJoinedEvent): void {
    if (event.player_id === this.localPlayerId) {
      return;
    }
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
    this.applyRenderState(entry.group, {
      x: event.position.x,
      y: event.position.y,
      z: event.position.z,
      yaw: 0,
    });
  }

  /** Elimina la réplica al salir otro jugador. */
  onPlayerLeft(playerId: string): void {
    this.leftPlayerIds.add(playerId);
    const entry = this.remotes.get(playerId);
    if (!entry) {
      return;
    }
    this.scene.remove(entry.group);
    this.remotes.delete(playerId);
  }

  /**
   * Actualiza posición/yaw interpolados de todos los remotos (llamar cada frame).
   */
  update(nowMs: number = performance.now()): void {
    for (const entry of this.remotes.values()) {
      const state = entry.buffer.sample(nowMs);
      if (state) {
        this.applyRenderState(entry.group, state);
      }
    }
  }

  /** Cantidad de jugadores remotos visibles (debug HUD). */
  get remoteCount(): number {
    return this.remotes.size;
  }

  private ensureRemote(playerId: string): RemoteEntry {
    let entry = this.remotes.get(playerId);
    if (entry) {
      return entry;
    }
    const group = new Group();
    const body = createPlayerBodyMesh(this.cellSize, this.material);
    group.add(body);
    this.scene.add(group);
    entry = { group, buffer: new RemoteInterpolationBuffer() };
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

  private applyRenderState(
    group: Group,
    state: { x: number; y: number; z: number; yaw: number },
  ): void {
    group.position.set(
      state.x * this.cellSize,
      state.z * this.cellSize,
      state.y * this.cellSize,
    );
    group.rotation.y = state.yaw;
  }
}
