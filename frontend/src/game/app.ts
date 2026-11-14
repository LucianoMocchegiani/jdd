import type { HealthResponse } from '@/api/client';
import { BloquesApi } from '@/api/bloques-api';
import { getWebSocketUrl, API_BASE_URL } from '@/api/config';
import { resolveActiveBloque } from '@/game/bootstrap/resolve-active-bloque';
import { ConditionsComponent } from '@/ecs/components/conditions';
import { FacingComponent } from '@/ecs/components/facing';
import { InputComponent } from '@/ecs/components/input';
import { ContactComponent } from '@/ecs/components/contact';
import { PositionComponent } from '@/ecs/components/position';
import { World } from '@/ecs/core';
import { ConditionSystem } from '@/ecs/domains/condition/condition-system';
import { ParticleContextSystem } from '@/ecs/domains/contact/particle-context-system';
import { InputSystem } from '@/ecs/domains/input/input-system';
import { formatBackendOkStatus, syncParticleCatalog, verifyBackendConnectivity } from '@/game/bootstrap';
import { CameraController, setCameraController } from '@/game/camera';
import { GameLoop } from '@/game/game-loop';
import { getOrCreatePlayerId, NetworkInputSender, WorldRealtimeClient } from '@/game/network';
import { RemoteInterpolationBuffer, RemotePresence } from '@/game/client-prediction';
import { PresenceHandler } from '@/game/network/presence-handler';
import { HealthHud } from '@/game/health-hud';
import { ProjectileVisuals } from '@/game/projectile-visuals';
import { isNewActionSequence, selectRemoteClip } from '@/game/player/remote-animation';
import type { PlayerCharacterVisual } from '@/game/player/player-character-visual';
import type { PlayerStateEvent, SessionEvent } from '@/types/world-events';
import { isMediumId } from '@/types/medium';
import { findSpawnZ } from '@/game/player/find-spawn';
import { resolveSpawnCell } from '@/game/player/resolve-spawn-cell';
import { spawnPlayer, syncPlayerMesh } from '@/game/player/spawn-player';
import { SimpleParticleRenderer } from '@/game/terrain/simple-particle-renderer';
import { TerrainStore } from '@/game/terrain/terrain-store';
import { updateCameraHud } from '@/game/debug/camera-hud';
import { updateConditionsHud } from '@/game/debug/conditions-hud';
import { isMovementDebugEnabled, setMovementDebugHud } from '@/game/debug/movement-debug';
import {
  bindInputStatsHud,
  fetchBackendInputStats,
  formatInputStatsHud,
  isInputStatsDebugEnabled,
  recordObservedPlayerState,
  type BackendInputStats,
} from '@/game/debug/input-stats-debug';
import {
  bindPositionSyncHud,
  ensureServerGhost,
  formatPositionSyncHud,
  ingestLocalPlayerState,
  isPositionSyncDebugEnabled,
} from '@/game/debug/position-sync-debug';
import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export interface AppContext {
  world: World;
  loop: GameLoop;
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  playerEntityId: number;
  playerMesh: Group;
  terrain: TerrainStore;
  particleRenderer: SimpleParticleRenderer;
  cameraController: CameraController;
  worldRealtime: WorldRealtimeClient;
}

export interface BootstrapResult { app: AppContext; health: HealthResponse; }

function registerGameplaySystems(
  world: World,
  terrain: TerrainStore,
  debugMediumEl: HTMLElement,
): void {
  world.registerSystem(new InputSystem());
  world.registerSystem(new ParticleContextSystem(terrain, (label) => { debugMediumEl.textContent = label; }));
  world.registerSystem(new ConditionSystem(terrain));
}

export async function bootstrapApp(
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  statusEl: HTMLElement,
  debugMediumEl: HTMLElement,
  debugConditionsEl: HTMLElement,
  debugCameraEl: HTMLElement,
  debugMovementEl: HTMLElement,
  debugInputStatsEl: HTMLElement | null,
  debugPosSyncEl: HTMLElement | null,
): Promise<BootstrapResult> {
  setMovementDebugHud(debugMovementEl);
  bindInputStatsHud(debugInputStatsEl);
  bindPositionSyncHud(debugPosSyncEl);
  const inputStatsDebug = isInputStatsDebugEnabled();
  const posSyncDebug = isPositionSyncDebugEnabled();
  let backendInputStats: BackendInputStats | null = null;
  let inputStatsPollClockSec = 0;
  let inputStatsPollInFlight = false;
  const world = new World();
  const particleRenderer = new SimpleParticleRenderer(scene);
  let cellSize = 1;
  let terrain: TerrainStore;
  const rebuildTerrainMeshes = (): void => { particleRenderer.rebuildIncremental(terrain.getParticles(), terrain.getTypesByNombre(), terrain.cellSize); };
  let spawnResolved = false;
  let terrainReady = false;
  let socketReady = false;
  let activationSent = false;
  let playerActive = false;
  let requestActivation = (): void => {};
  let playerEntityId = 0;
  let spawnX = 8;
  let spawnY = 8;
  let spawnZ = 4;
  const { health, client } = await verifyBackendConnectivity();
  const catalog = await syncParticleCatalog(client);
  const bloquesApi = new BloquesApi(client);
  const bloque = await resolveActiveBloque(bloquesApi);
  if (!bloque) throw new Error('No se encontró bloque activo. Comprueba la base de datos o ?bloque= en la URL.');

  cellSize = bloque.tamano_celda;
  const spawnCell = resolveSpawnCell(bloque);
  spawnX = spawnCell.x;
  spawnY = spawnCell.y;
  const bloqueId = bloque.id;
  const bloqueNombre = bloque.nombre;
  terrain = new TerrainStore(bloqueId, cellSize);
  const projectileVisuals = new ProjectileVisuals(scene, cellSize);
  spawnZ = 8;
  terrain.onViewportLoaded(() => {
    rebuildTerrainMeshes();
    if (!spawnResolved && terrain.isSimulationStable) {
      spawnResolved = true;
      spawnZ = findSpawnZ(terrain.getParticles(), spawnX, spawnY, terrain.getTypesByNombre());
      const posComp = world.getComponent<PositionComponent>(playerEntityId, 'position');
      if (posComp) posComp.z = spawnZ;
      terrainReady = true;
      requestActivation();
    }
  });
  terrain.onParticlesRemoved((removed) => particleRenderer.removeParticles(removed));
  terrain.onParticlesAdded((added) => particleRenderer.addParticles(added, terrain.getTypesByNombre(), terrain.cellSize));

  const playerId = getOrCreatePlayerId();
  statusEl.textContent = `${formatBackendOkStatus(health.status, catalog.statusSuffix)} · ${bloqueNombre} · conectando y cargando terreno…`;
  statusEl.dataset.state = catalog.statusState;
  const worldRealtime = new WorldRealtimeClient();
  const remotePresence = new RemotePresence(scene, cellSize, playerId);
  const healthHud = new HealthHud();
  const networkInput = new NetworkInputSender(worldRealtime, bloqueId, playerId);
  const presenceHandler = new PresenceHandler(worldRealtime, remotePresence, playerId, bloqueId);
  const localSnapshots = new RemoteInterpolationBuffer();
  let inputSendClockSec = 0;
  let localHealth: number | null = null;
  let localMaxHealth = 100;
  let localMana: number | null = null;
  let localMaxMana = 100;
  let localInCombat = false;
  let activeConditionIds: string[] = [];
  let localVisualState: PlayerStateEvent | null = null;
  let localActionSeq: number | null = null;
  let pendingLocalActionClip: string | null = null;
  let localCharacter: PlayerCharacterVisual | null = null;
  let setPlayerVisible = (_visible: boolean): void => {};

  requestActivation = (): void => {
    if (socketReady && terrainReady && !activationSent) {
      activationSent = worldRealtime.send({ type: 'activate_player', position: { x: spawnX, y: spawnY, z: spawnZ } });
    }
  };

  const handleSessionEvent = (event: SessionEvent): void => {
    if (event.type === 'projectile_state') {
      projectileVisuals.apply(event);
      return;
    }
    if (event.type === 'player_state') {
      ingestLocalPlayerState(event, playerId);
      recordObservedPlayerState(event);
      if (event.player_id === playerId) {
        localVisualState = event;
        localSnapshots.push({
          serverTick: event.server_tick, x: event.x, y: event.y, z: event.z,
          vx: event.vx, vy: event.vy, vz: event.vz, yaw: event.yaw,
          receivedAtMs: event.receivedAtMs ?? performance.now(),
        });
        if (event.action_seq !== undefined) {
          if (event.action_id && isNewActionSequence(localActionSeq, event.action_seq)) {
            pendingLocalActionClip = selectRemoteClip({
              medium: event.medium, vx: event.vx, vy: event.vy, vz: event.vz,
              intents: event.intents, action_id: event.action_id,
            });
            window.dispatchEvent(new CustomEvent('ability-cooldown-start', { detail: { actionId: event.action_id } }));
          }
          localActionSeq = event.action_seq;
        }
        if (Number.isFinite(event.health)) {
          const nextHealth = event.health!;
          if (localHealth !== null && nextHealth < localHealth) localCharacter?.flashDamage();
          localHealth = nextHealth;
          if (Number.isFinite(event.max_health) && event.max_health! > 0) localMaxHealth = event.max_health!;
        }
        if (Number.isFinite(event.mana)) localMana = event.mana!;
        if (Number.isFinite(event.max_mana) && event.max_mana! > 0) localMaxMana = event.max_mana!;
        localInCombat = event.in_combat === true;
      }
    } else if (event.type === 'join_ok') {
      playerActive = true;
      setPlayerVisible(true);
      statusEl.textContent = `${formatBackendOkStatus(health.status, catalog.statusSuffix)} · ${bloqueNombre} · ${terrain.getParticles().length} partículas · clic canvas · WASD · C cámara · F/G ataques`;
    } else if (event.type === 'join_error') {
      playerActive = false;
      setPlayerVisible(false);
      statusEl.textContent = `No se pudo iniciar la partida: ${event.error}`;
    }
    presenceHandler.onSessionEvent(event);
  };

  const { entityId, mesh: playerMesh } = spawnPlayer(world, scene, cellSize, spawnX, spawnY, spawnZ);
  playerEntityId = entityId;
  playerMesh.visible = false;
  setPlayerVisible = (visible): void => { playerMesh.visible = visible; };
  localCharacter = playerMesh.userData.characterVisual as PlayerCharacterVisual;
  if (posSyncDebug) ensureServerGhost(scene, cellSize);

  worldRealtime.connect(getWebSocketUrl(), {
    onWorldEvent: (event) => { if (event.bloque_id === bloqueId) terrain.applyWorldEvent(event); },
    onSessionEvent: handleSessionEvent,
    onOpen: () => {
      playerActive = false;
      setPlayerVisible(false);
      activationSent = false;
      socketReady = presenceHandler.onOpen(spawnX, spawnY, spawnZ, playerEntityId);
      requestActivation();
    },
  });

  registerGameplaySystems(world, terrain, debugMediumEl);
  debugMediumEl.textContent = 'medium: —';
  const cameraController = new CameraController(camera, renderer.domElement, playerMesh);
  setCameraController(cameraController);
  if (isMovementDebugEnabled()) console.info('[movement:debug] Flujo autoritativo: [input:key] → [input:intents] → [server:movement] → [player_state] → [render]. HUD arriba-izq. Off: ?debug=movement-off');

  const loop = new GameLoop((deltaTime) => {
    worldRealtime.drainInboundQueue();
    const serverState = localSnapshots.sample(performance.now());
    if (serverState) {
      const pos = world.getComponent<PositionComponent>(playerEntityId, 'position');
      const facing = world.getComponent<FacingComponent>(playerEntityId, 'facing');
      const contact = world.getComponent<ContactComponent>(playerEntityId, 'contact');
      if (pos) Object.assign(pos, { x: serverState.x, y: serverState.y, z: serverState.z });
      if (facing) facing.yaw = serverState.yaw;
      if (contact && localVisualState && isMediumId(localVisualState.medium)) contact.medium = localVisualState.medium;
    }
    cameraController.tickInput(world, playerEntityId);
    if (playerActive && terrainReady && terrain.isSimulationStable) {
      world.update(deltaTime);
      inputSendClockSec += deltaTime;
      const inputComp = world.getComponent<InputComponent>(playerEntityId, 'input');
      const facingComp = world.getComponent<FacingComponent>(playerEntityId, 'facing');
      if (inputComp && facingComp) networkInput.tick(inputSendClockSec, inputComp.intents, facingComp.yaw, cameraController.pitch);
    }
    const pos = world.getComponent<PositionComponent>(playerEntityId, 'position');
    if (pos) {
      syncPlayerMesh(playerMesh, pos.x, pos.y, pos.z, cellSize);
      const facing = world.getComponent<FacingComponent>(playerEntityId, 'facing');
      const clip = pendingLocalActionClip ?? (localVisualState ? selectRemoteClip({
        medium: localVisualState.medium, vx: localVisualState.vx, vy: localVisualState.vy,
        vz: localVisualState.vz, intents: localVisualState.intents,
      }) : null);
      localCharacter?.update(deltaTime, clip, pos.x, pos.y, pos.z, facing?.yaw ?? 0, null);
      pendingLocalActionClip = null;
      cameraController.updateCamera(camera, world, playerEntityId, pos.x, pos.y, pos.z, cellSize);
      updateCameraHud(debugCameraEl, cameraController.yaw, cameraController.pitch, cameraController.mode);
      const conditions = world.getComponent<ConditionsComponent>(playerEntityId, 'conditions');
      activeConditionIds = conditions?.active.map((condition) => condition.conditionId) ?? [];
      updateConditionsHud(debugConditionsEl, conditions?.active ?? [], conditions?.debugDamageTotal ?? 0);
      if (inputStatsDebug && debugInputStatsEl) {
        inputStatsPollClockSec += deltaTime;
        if (inputStatsPollClockSec >= 1 && !inputStatsPollInFlight) {
          inputStatsPollClockSec = 0;
          inputStatsPollInFlight = true;
          void fetchBackendInputStats(API_BASE_URL, playerId).then((stats) => { backendInputStats = stats; inputStatsPollInFlight = false; });
        }
        debugInputStatsEl.textContent = formatInputStatsHud(playerId, backendInputStats);
      }
      if (posSyncDebug && debugPosSyncEl) {
        const ws = worldRealtime.getWsDebugStats();
        const contactComp = world.getComponent<ContactComponent>(playerEntityId, 'contact');
        debugPosSyncEl.textContent = formatPositionSyncHud(pos.x, pos.y, pos.z, {
          lastRxAgeSec: ws.lastRxAgeSec, lastAppliedAgeSec: ws.lastAppliedAgeSec, maxRxGapMs: ws.maxRxGapMs,
          rxPerSec: ws.rxPerSec, terrainRebuilding: particleRenderer.isRebuilding || terrain.isRebuildingIndexes,
          localMedium: contactComp?.medium ?? null,
        });
      }
    }
    worldRealtime.drainInboundQueue();
    remotePresence.update();
    healthHud.update(localHealth, localMaxHealth, localMana, localMaxMana, localInCombat, activeConditionIds, remotePresence.getHealthIndicators(), camera, cellSize);
    renderer.render(scene, camera);
  });
  loop.start();
  return { app: { world, loop, scene, camera, renderer, playerEntityId, playerMesh, terrain, particleRenderer, cameraController, worldRealtime }, health };
}
