/**
 * @file Constantes de juego compartidas (contacto, chunks, red).
 *
 * Tuning de sesión desde `@shared/game/session.json`.
 * Red multijugador: {@link NETWORK_SIM_HZ} / {@link INPUT_SEND_INTERVAL_SEC} (30 Hz).
 */

import sessionData from '@shared/game/session.json';

/** Re-export de símbolos del módulo. */
export { GRAVITY_CELLS, PLAYER_MOVE_SPEED_CELLS } from '@/game-data/movement/profiles';

/**
 * Índice en `GET /bloques` (orden `creado_en DESC` del backend).
 * `0` = más reciente (default greenfield).
 */
export const DEFAULT_BLOQUE_LIST_INDEX = 0;

/**
 * Mapa base de desarrollo (monolito). En greenfield suele ser null → índice o primer bloque.
 * Mapas grandes: `?bloque=lago` o `?bloque=bosque`.
 */
export const DEV_BASELINE_BLOQUE_NAME = 'Arena 10x10';

/**
 * Si está definido, se busca bloque por substring en el nombre antes del índice.
 * `?bloque=` en la URL tiene prioridad. `null` = usar índice / primer bloque disponible.
 */
export const DEFAULT_BLOQUE_NAME_MATCH: string | null = null;

/** Radio esférico de muestreo para `medium` y tipo dominante (celdas). */
export const CONTACT_SAMPLE_RADIUS_CELLS = sessionData.contactSampleRadiusCells;

/** Tamaño de chunk XY en mensajes WS (espejo `session.json`). */
export const CHUNK_SIZE_CELLS = sessionData.chunkSizeCells;

/** Radio de colisión / ventana server (celdas). */
export const TERRAIN_COLLISION_LOAD_RADIUS_CELLS = sessionData.terrainCollisionLoadRadiusCells;

/**
 * Límite Z inferior en mensajes `terrain_chunk`.
 * @see {@link TERRAIN_Z_MAX}
 */
export const TERRAIN_Z_MIN = sessionData.terrainZMin;

/** Límite Z superior en chunks WS. */
export const TERRAIN_Z_MAX = sessionData.terrainZMax;

/** Toggle modo cámara / inspect (`KeyboardEvent.code`). */
export const CAMERA_INSPECT_TOGGLE_KEY = 'KeyC';

/** Sensibilidad ratón (rad por px de `movementX` / `movementY`). */
export const CAMERA_MOUSE_SENSITIVITY = 0.003;

/** Export `CAMERA_DEFAULT_PITCH` — camera_default_pitch. */
export const CAMERA_DEFAULT_PITCH = sessionData.cameraDefaultPitch;
/** Export `CAMERA_PITCH_MIN` — camera_pitch_min. */
export const CAMERA_PITCH_MIN = -Math.PI / 3;
/** Export `CAMERA_PITCH_MAX` — camera_pitch_max. */
export const CAMERA_PITCH_MAX = Math.PI / 3;

/** Distancia órbita en celdas (multiplicar por `cellSize` para Three.js). */
export const CAMERA_DISTANCE_DEFAULT_CELLS = 10;
/** Export `CAMERA_DISTANCE_MIN_CELLS` — camera_distance_min_cells. */
export const CAMERA_DISTANCE_MIN_CELLS = 2;
/** Export `CAMERA_DISTANCE_MAX_CELLS` — camera_distance_max_cells. */
export const CAMERA_DISTANCE_MAX_CELLS = 20;
/** Export `CAMERA_ZOOM_SPEED_CELLS` — camera_zoom_speed_cells. */
export const CAMERA_ZOOM_SPEED_CELLS = 0.8;

/** Altura del punto de mira sobre `position.z` (celdas). */
export const CAMERA_LOOK_HEIGHT_CELLS = 2;

/** Lerp posición cámara por frame (~60 fps). */
export const CAMERA_POSITION_SMOOTHING = 0.12;

/** Tick autoritativo servidor + envío de input (Hz). */
export const NETWORK_SIM_HZ = 30;
/** Export `INPUT_SEND_INTERVAL_SEC` — input_send_interval_sec. */
export const INPUT_SEND_INTERVAL_SEC = 1 / NETWORK_SIM_HZ;
