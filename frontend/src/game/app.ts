/*
 * @file Orquestador del cliente v2: ensambla API, terreno, ECS, cámara y game loop.
 */

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
import { ActionOrchestratorSystem } from '@/ecs/domains/action/action-orchestrator-system';
import { AppearanceSystem } from '@/ecs/domains/appearance/appearance-system';
import { ConditionSystem } from '@/ecs/domains/condition/condition-system';
import { ParticleContextSystem } from '@/ecs/domains/contact/particle-context-system';
import { WorldDamageSystem } from '@/ecs/domains/impact/world-damage-system';
import { InputSystem } from '@/ecs/domains/input/input-system';
import { MovementSystem } from '@/ecs/domains/movement/movement-system';
import { PlayerSimulationRunner } from '@/game/client-prediction/replay-runner';
import { formatBackendOkStatus, syncParticleCatalog, verifyBackendConnectivity } from '@/game/bootstrap';
import { CameraController, setCameraController } from '@/game/camera';
import { GameLoop } from '@/game/game-loop';
import { getOrCreatePlayerId, NetworkInputSender, WorldRealtimeClient } from '@/game/network';
import { InputHistory, LocalPlayerReconciler, RemotePresence } from '@/game/client-prediction';
import { PresenceHandler } from '@/game/network/presence-handler';
import { HealthHud } from '@/game/health-hud';
import { ProjectileVisuals } from '@/game/projectile-visuals';
import type { PlayerCharacterVisual } from '@/game/player/player-character-visual';
import type { SessionEvent } from '@/types/world-events';
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
  playerEntityId: number,
  playerMesh: Group,
  worldRealtime: WorldRealtimeClient,
  playerId: string,
): PlayerSimulationRunner {
  let mediumLine = 'medium: —';
  let actionLine = 'acción: —';
  const refreshContactHud = (): void => { debugMediumEl.textContent = `${mediumLine}\n${actionLine}`; };
  const inputSystem = new InputSystem();
  const particleContext = new ParticleContextSystem(terrain, (label) => { mediumLine = label; refreshContactHud(); });
  const conditionSystem = new ConditionSystem(terrain);
  const actionOrchestrator = new ActionOrchestratorSystem((label) => { actionLine = label; refreshContactHud(); });
  const movementSystem = new MovementSystem(terrain);
  world.registerSystem(inputSystem);
  world.registerSystem(particleContext);
  world.registerSystem(conditionSystem);
  world.registerSystem(actionOrchestrator);
  world.registerSystem(movementSystem);
  const simulationRunner = new PlayerSimulationRunner(particleContext, conditionSystem, actionOrchestrator, movementSystem);
  movementSystem.setPitchSource(simulationRunner);
  world.registerSystem(new WorldDamageSystem(terrain, worldRealtime, playerId));
  world.registerSystem(new AppearanceSystem(playerEntityId, playerMesh));
  return simulationRunner;
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
  const inputHistory = new InputHistory();
  const networkInput = new NetworkInputSender(worldRealtime, bloqueId, playerId, inputHistory);
  const presenceHandler = new PresenceHandler(worldRealtime, remotePresence, playerId, bloqueId);
  let inputSendClockSec = 0;
  let localReconciler: LocalPlayerReconciler | null = null;
  let localHealth: number | null = null;
  let localMaxHealth = 100;
  let localMana: number | null = null;
  let localMaxMana = 100;
  let localInCombat = false;
  let activeConditionIds: string[] = [];
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
      if (event.player_id === playerId && Number.isFinite(event.health)) {
        const nextHealth = event.health!;
        if (localHealth !== null && nextHealth < localHealth) localCharacter?.flashDamage();
        localHealth = nextHealth;
        if (Number.isFinite(event.max_health) && event.max_health! > 0) localMaxHealth = event.max_health!;
      }
      if (event.player_id === playerId) {
        if (Number.isFinite(event.mana)) localMana = event.mana!;
        if (Number.isFinite(event.max_mana) && event.max_mana! > 0) localMaxMana = event.max_mana!;
        localInCombat = event.in_combat === true;
      }
      if (localReconciler && playerEntityId > 0) localReconciler.onPlayerState(world, playerEntityId, event);
    } else if (event.type === 'join_ok') {
      playerActive = true;
      setPlayerVisible(true);
      statusEl.textContent = `${formatBackendOkStatus(health.status, catalog.statusSuffix)} · ${bloqueNombre} · ${terrain.getParticles().length} partículas · clic canvas · WASD · C cámara · F atacar`;
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

  const simulationRunner = registerGameplaySystems(world, terrain, debugMediumEl, playerEntityId, playerMesh, worldRealtime, playerId);
  localReconciler = new LocalPlayerReconciler(playerId, inputHistory, simulationRunner);
  debugMediumEl.textContent = 'medium: —';
  const cameraController = new CameraController(camera, renderer.domElement, playerMesh);
  setCameraController(cameraController);
  if (isMovementDebugEnabled()) console.info('[movement:debug] Flujo: [input:key] → [input:intents] → [movement:vel] → [movement:apply]. HUD arriba-izq. Off: ?debug=movement-off');

  const loop = new GameLoop((deltaTime) => {
    worldRealtime.drainInboundQueue();
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
