/**
 * @file Orquestador del cliente v2: ensambla API, terreno, ECS, cámara y game loop.
 *
 * **Responsabilidad:** este módulo no implementa reglas de juego; **conecta** piezas ya
 * definidas en dominios (`ecs/domains/*`, `game/camera`, `game/terrain`, etc.).
 *
 * **Arranque (`bootstrapApp`)**
 * 1. Mundo ECS vacío + HUD de debug.
 * 2. Backend (requerido): health, catálogo de tipos, bloque, viewport, WebSocket.
 * 3. Spawn jugador: entidad + mesh placeholder en la escena.
 * 4. {@link registerGameplaySystems} — cadena ECS por `priority`.
 * 5. {@link CameraController} + registro global ({@link setCameraController}).
 * 6. WebSocket: join, input (~30 Hz), `player_state`, eventos (`particle_destroyed`, `swing`).
 * 7. {@link GameLoop} — frame: WS → cámara → ECS → red → presentación Three.js.
 *
 * **Frame (cada `requestAnimationFrame`)**
 * ```text
 * drainInboundQueue (WS) → reconciler (player_state local)
 * tickInput(world)           // ratón, C inspect, facing (antes de intents en ECS)
 * world.update(dt)           // Input → ContactComponent → acciones → movement → daño → appearance
 * networkInput.tick          // ~30 Hz → WS input
 * syncPlayerMesh + updateCamera + HUDs debug
 * drainInboundQueue
 * renderer.render()
 * ```
 *
 * Entrada HTML/Three: `main.ts`. Diseño ECS: `Ideas/habilidades/frontend-v2-ecs.md`.
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
import {
  getOrCreatePlayerId,
  NetworkInputSender,
  WorldRealtimeClient,
} from '@/game/network';
import { InputHistory, LocalPlayerReconciler, RemotePresence } from '@/game/client-prediction';
import { PresenceHandler } from '@/game/network/presence-handler';
import type { SessionEvent } from '@/types/world-events';
import { findSpawnZ } from '@/game/player/find-spawn';
import { resolveSpawnCell } from '@/game/player/resolve-spawn-cell';
import { spawnPlayer, syncPlayerMesh } from '@/game/player/spawn-player';
import { SimpleParticleRenderer } from '@/game/terrain/simple-particle-renderer';
import { TerrainStore } from '@/game/terrain/terrain-store';
import { updateCameraHud } from '@/game/debug/camera-hud';
import { updateConditionsHud } from '@/game/debug/conditions-hud';
import {
  isMovementDebugEnabled,
  setMovementDebugHud,
} from '@/game/debug/movement-debug';
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

/**
 * Handles vivos tras {@link bootstrapApp}; `main.ts` puede guardarlos para resize o teardown futuro.
 */
export interface AppContext {
  /** Mundo ECS: entidad jugador, componentes y sistemas registrados. */
  world: World;
  /** Bucle `requestAnimationFrame`; llama al callback pasado en el constructor del loop. */
  loop: GameLoop;
  /** Escena Three.js (luces, partículas, jugador). */
  scene: Scene;
  /** Cámara perspectiva; posición la actualiza {@link CameraController} cada frame. */
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** Id numérico de la entidad creada en {@link spawnPlayer}. */
  playerEntityId: number;
  /** Grupo Three.js sincronizado con `PositionComponent` tras cada `world.update`. */
  playerMesh: Group;
  /** Cache de partículas del viewport, sólidos y `bloqueId` para daño API. */
  terrain: TerrainStore;
  /** Instancias visuales de partículas; se reconstruye en `terrain.onViewportLoaded`. */
  particleRenderer: SimpleParticleRenderer;
  /** Control de ratón, modos third_person/inspect; no es componente ECS. */
  cameraController: CameraController;
  /** WS de eventos de mundo (`particle_destroyed`, comandos `swing`). */
  worldRealtime: WorldRealtimeClient;
}

/**
 * Valor de retorno de {@link bootstrapApp} para la capa de entrada (`main.ts`).
 */
export interface BootstrapResult {
  app: AppContext;
  /** Respuesta de `GET /health` tras conexión exitosa. */
  health: HealthResponse;
}

/**
 * Registra todos los sistemas de gameplay en el {@link World}.
 *
 * El orden de ejecución lo define `System.priority` (no el orden de `registerSystem`).
 * Callbacks opcionales alimentan `#debug-medium` (medium + acción activa).
 *
 * | Sistema | Priority | Notas |
 * |---------|----------|--------|
 * | InputSystem | 0 | Teclado → intents; bloquea movimiento en modo inspect |
 * | ParticleContextSystem | 10 | Partículas en radio → `ContactComponent` |
 * | ActionOrchestratorSystem | 15 | Fichas → `ActionsComponent` |
 * | MovementSystem | 20 | Velocidad, gravedad, colisión (usa `terrain`) |
 * | WorldDamageSystem | 22 | `swing` por WS; terreno vía `particle_destroyed` |
 * | AppearanceSystem | 25 | Tint del mesh jugador (stub GLB) |
 *
 * @param worldRealtime - WS de mundo (swing + eventos de terreno).
 */
function registerGameplaySystems(
  world: World,
  terrain: TerrainStore,
  debugMediumEl: HTMLElement,
  playerEntityId: number,
  playerMesh: Group,
  worldRealtime: WorldRealtimeClient,
): PlayerSimulationRunner {
  // HUD de contacto/acción: dos líneas actualizadas por callbacks de sistemas.
  let mediumLine = 'medium: —';
  let actionLine = 'acción: —';

  const refreshContactHud = (): void => {
    debugMediumEl.textContent = `${mediumLine}\n${actionLine}`;
  };

  // --- Entrada y contexto de mundo (antes de resolver acciones) ---
  const inputSystem = new InputSystem();
  const particleContext = new ParticleContextSystem(terrain, (label) => {
    mediumLine = label;
    refreshContactHud();
  });
  const conditionSystem = new ConditionSystem(terrain);
  const actionOrchestrator = new ActionOrchestratorSystem((label) => {
    actionLine = label;
    refreshContactHud();
  });
  const movementSystem = new MovementSystem(terrain);

  world.registerSystem(inputSystem);
  world.registerSystem(particleContext);
  world.registerSystem(conditionSystem);
  world.registerSystem(actionOrchestrator);
  world.registerSystem(movementSystem);

  const simulationRunner = new PlayerSimulationRunner(
    particleContext,
    conditionSystem,
    actionOrchestrator,
    movementSystem,
  );
  movementSystem.setPitchSource(simulationRunner);

  // --- Efectos sobre el mundo y presentación ---
  world.registerSystem(new WorldDamageSystem(terrain, worldRealtime));
  world.registerSystem(new AppearanceSystem(playerEntityId, playerMesh));

  return simulationRunner;
}

/**
 * Bootstrap completo: conecta servicios, monta el mundo jugable y arranca el loop.
 *
 * **Solo online:** si falla backend, bloque o arranque, lanza error (ver `main.ts`).
 *
 * @param scene - Escena Three.js creada en `main.ts` (luces; luego terreno + jugador).
 * @param camera - `PerspectiveCamera` de la escena; posición la mueve {@link CameraController}.
 * @param renderer - WebGL renderer; `renderer.domElement` es el canvas de pointer lock.
 * @param statusEl - `#status` en HTML: conexión API, bloque cargado y atajos de control.
 * @param debugMediumEl - `#debug-medium`: `medium` + acción activa (callbacks de sistemas).
 * @param debugConditionsEl - `#debug-conditions`: condiciones activas del jugador.
 * @param debugCameraEl - `#debug-camera`: yaw/pitch y modo de cámara (cada frame).
 * @param debugMovementEl - `#debug-movement`: HUD opcional de velocidad/colisiones (`?debug=movement`).
 * @param debugInputStatsEl - `#debug-input-stats`: contadores input front/back (`?debug=input-stats`).
 * @param debugPosSyncEl - `#debug-pos-sync`: local vs servidor (`?debug=pos-sync`).
 * @throws Si no hay conexión al API, bloque en el índice configurado, o carga inicial del viewport.
 */
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
  // -------------------------------------------------------------------------
  // Fase A — Núcleo local (no depende del backend)
  // -------------------------------------------------------------------------
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

  /** Sincroniza Three.js cuando `TerrainStore` termina de cargar un viewport. */
  const rebuildTerrainMeshes = (): void => {
    particleRenderer.rebuildIncremental(
      terrain.getParticles(),
      terrain.getTypesByNombre(),
      terrain.cellSize,
    );
  };

  let spawnResolved = false;

  let playerEntityId = 0;
  let spawnX = 8;
  let spawnY = 8;
  let spawnZ = 4;
  // -------------------------------------------------------------------------
  // Fase B — Backend + viewport + WebSocket (requerido)
  // -------------------------------------------------------------------------
  const { health, client } = await verifyBackendConnectivity();

  const catalog = await syncParticleCatalog(client);
  const bloquesApi = new BloquesApi(client);
  const bloque = await resolveActiveBloque(bloquesApi);

  if (!bloque) {
    throw new Error('No se encontró bloque activo. Comprueba la base de datos o ?bloque= en la URL.');
  }

  cellSize = bloque.tamano_celda;
  const spawnCell = resolveSpawnCell(bloque);
  spawnX = spawnCell.x;
  spawnY = spawnCell.y;

  const bloqueId = bloque.id;
  const bloqueNombre = bloque.nombre;

  terrain = new TerrainStore(bloqueId, cellSize);
  spawnZ = 8;

  terrain.onViewportLoaded(() => {
    rebuildTerrainMeshes();
    if (!spawnResolved && terrain.isSimulationStable) {
      spawnResolved = true;
      const z = findSpawnZ(
        terrain.getParticles(),
        spawnX,
        spawnY,
        terrain.getTypesByNombre(),
      );
      spawnZ = z;
      const posComp = world.getComponent<PositionComponent>(playerEntityId, 'position');
      if (posComp) {
        posComp.z = z;
      }
      statusEl.textContent = `${formatBackendOkStatus(health.status, catalog.statusSuffix)} · ${bloqueNombre} · ${terrain.getParticles().length} partículas · clic canvas · WASD · C cámara · F atacar`;
    }
  });

  terrain.onParticlesRemoved((removed) => {
    particleRenderer.removeParticles(removed);
  });

  terrain.onParticlesAdded((added) => {
    particleRenderer.addParticles(added, terrain.getTypesByNombre(), terrain.cellSize);
  });

  const playerId = getOrCreatePlayerId();

  statusEl.textContent = `${formatBackendOkStatus(health.status, catalog.statusSuffix)} · ${bloqueNombre} · cargando terreno… · clic canvas · WASD · C cámara · F atacar`;
  statusEl.dataset.state = catalog.statusState;

  const worldRealtime = new WorldRealtimeClient();
  const remotePresence = new RemotePresence(scene, cellSize, playerId);
  const inputHistory = new InputHistory();
  const networkInput = new NetworkInputSender(worldRealtime, bloqueId, playerId, inputHistory);
  const presenceHandler = new PresenceHandler(worldRealtime, remotePresence, playerId, bloqueId);
  let inputSendClockSec = 0;
  let localReconciler: LocalPlayerReconciler | null = null;

  const handleSessionEvent = (event: SessionEvent): void => {
    if (event.type === 'player_state') {
      ingestLocalPlayerState(event, playerId);
      recordObservedPlayerState(event);
      if (localReconciler && playerEntityId > 0) {
        localReconciler.onPlayerState(world, playerEntityId, event);
      }
    }
    presenceHandler.onSessionEvent(event);
  };

  // -------------------------------------------------------------------------
  // Fase C — Jugador ECS + mesh en escena
  // -------------------------------------------------------------------------
  const { entityId, mesh: playerMesh } = spawnPlayer(
    world,
    scene,
    cellSize,
    spawnX,
    spawnY,
    spawnZ,
  );
  playerEntityId = entityId;

  if (posSyncDebug) {
    ensureServerGhost(scene, cellSize);
  }

  worldRealtime.connect(getWebSocketUrl(), {
    onWorldEvent: (event) => {
      if (event.bloque_id === bloqueId) {
        terrain.applyWorldEvent(event);
      }
    },
    onSessionEvent: handleSessionEvent,
    onOpen: () => presenceHandler.onOpen(spawnX, spawnY, spawnZ, playerEntityId),
  });

  // -------------------------------------------------------------------------
  // Fase D — Sistemas ECS + cámara (fuera del World pero acoplada al mismo entityId)
  // -------------------------------------------------------------------------
  const simulationRunner = registerGameplaySystems(
    world,
    terrain,
    debugMediumEl,
    playerEntityId,
    playerMesh,
    worldRealtime,
  );
  localReconciler = new LocalPlayerReconciler(playerId, inputHistory, simulationRunner);
  debugMediumEl.textContent = 'medium: —';

  const cameraController = new CameraController(camera, renderer.domElement, playerMesh);
  setCameraController(cameraController);

  if (isMovementDebugEnabled()) {
    console.info(
      '[movement:debug] Flujo: [input:key] → [input:intents] → [movement:vel] → [movement:apply]. HUD arriba-izq. Off: ?debug=movement-off',
    );
  }

  // -------------------------------------------------------------------------
  // Fase E — Game loop (presentación Three.js tras simular el frame ECS)
  // -------------------------------------------------------------------------
  const loop = new GameLoop((deltaTime) => {
    worldRealtime.drainInboundQueue();

    // 1) Ratón / toggle inspect / facing — debe ir ANTES de InputSystem en world.update.
    cameraController.tickInput(world, playerEntityId);

    // 2) Simulación: intents → medium → acciones → movimiento → daño → apariencia.
    world.update(deltaTime);

    inputSendClockSec += deltaTime;
    const inputComp = world.getComponent<InputComponent>(playerEntityId, 'input');
    const facingComp = world.getComponent<FacingComponent>(playerEntityId, 'facing');
    if (inputComp && facingComp) {
      networkInput.tick(
        inputSendClockSec,
        inputComp.intents,
        facingComp.yaw,
        cameraController.pitch,
      );
    }

    // 3) Copiar estado ECS al render (posición + órbita de cámara).
    const pos = world.getComponent<PositionComponent>(playerEntityId, 'position');
    if (pos) {
      syncPlayerMesh(playerMesh, pos.x, pos.y, pos.z, cellSize);
      cameraController.updateCamera(
        camera,
        world,
        playerEntityId,
        pos.x,
        pos.y,
        pos.z,
        cellSize,
      );
      updateCameraHud(
        debugCameraEl,
        cameraController.yaw,
        cameraController.pitch,
        cameraController.mode,
      );

      const conditions = world.getComponent<ConditionsComponent>(playerEntityId, 'conditions');
      updateConditionsHud(
        debugConditionsEl,
        conditions?.active ?? [],
        conditions?.debugDamageTotal ?? 0,
      );

      if (inputStatsDebug && debugInputStatsEl) {
        inputStatsPollClockSec += deltaTime;
        if (inputStatsPollClockSec >= 1 && !inputStatsPollInFlight) {
          inputStatsPollClockSec = 0;
          inputStatsPollInFlight = true;
          void fetchBackendInputStats(API_BASE_URL, playerId).then((stats) => {
            backendInputStats = stats;
            inputStatsPollInFlight = false;
          });
        }
        debugInputStatsEl.textContent = formatInputStatsHud(playerId, backendInputStats);
      }

      if (posSyncDebug && debugPosSyncEl) {
        const ws = worldRealtime.getWsDebugStats();
        const contactComp = world.getComponent<ContactComponent>(playerEntityId, 'contact');
        debugPosSyncEl.textContent = formatPositionSyncHud(pos.x, pos.y, pos.z, {
          lastRxAgeSec: ws.lastRxAgeSec,
          lastAppliedAgeSec: ws.lastAppliedAgeSec,
          maxRxGapMs: ws.maxRxGapMs,
          rxPerSec: ws.rxPerSec,
          terrainRebuilding: particleRenderer.isRebuilding || terrain.isRebuildingIndexes,
          localMedium: contactComp?.medium ?? null,
        });
      }
    }

    worldRealtime.drainInboundQueue();

    remotePresence.update();

    renderer.render(scene, camera);
  });

  loop.start();

  return {
    app: {
      world,
      loop,
      scene,
      camera,
      renderer,
      playerEntityId,
      playerMesh,
      terrain,
      particleRenderer,
      cameraController,
      worldRealtime,
    },
    health,
  };
}
