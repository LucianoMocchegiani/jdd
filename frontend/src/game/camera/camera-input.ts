/**
 * @file Entrada de ratón para la cámara: pointer lock, deltas y rueda.
 *
 * Capa DOM aislada del ECS. {@link CameraController} llama {@link CameraInputBinding.drain}
 * una vez por frame (antes de `world.update`) y aplica los acumulados a yaw/pitch/distancia.
 *
 * No lee teclado ni intents; el toggle `inspect` (**C**) vive en el controlador.
 */

/**
 * Deltas de ratón consumidos en un frame por {@link CameraInputBinding.drain}.
 *
 * Tras `drain()`, los acumuladores internos vuelven a cero.
 */
export interface CameraInputFrame {
  /** Suma de `MouseEvent.movementX` desde el último `drain` (px; solo con pointer lock). */
  movementX: number;
  /** Suma de `MouseEvent.movementY` desde el último `drain` (px; positivo = ratón hacia abajo). */
  movementY: number;
  /**
   * Pasos de rueda acumulados: `+1` alejar (scroll down), `-1` acercar.
   * Informativo; el zoom efectivo lo aplica `onWheelStep` en el constructor.
   */
  wheelDelta: number;
}

/**
 * Registra listeners en el canvas WebGL y acumula entrada por frame.
 *
 * **Flujo**
 * 1. Clic en canvas → {@link requestPointerLock} si aún no está activo (**R4**: mirar solo con movimiento, no con clic sostenido).
 * 2. Con lock, `mousemove` suma `movementX` / `movementY` (no usa `clientX` absoluto).
 * 3. `wheel` → `preventDefault`, notifica `onWheelStep(±1)` y acumula `wheelDelta`.
 * 4. {@link CameraController.tickInput} invoca `drain()` y traduce px → radianes.
 *
 * **Ciclo de vida:** crear una instancia por sesión; {@link dispose} al destruir la app
 * (quita listeners; no llama `exitPointerLock` — eso lo hace el usuario con Esc o el controlador).
 */
export class CameraInputBinding {
  private movementX = 0;
  private movementY = 0;
  private wheelDelta = 0;

  /**
   * @param canvas - `renderer.domElement`; debe ser el mismo elemento que recibe pointer lock.
   * @param onWheelStep - Callback síncrono por notch de rueda (`+1` / `-1`); recibe el `WheelEvent` para zoom al cursor u otras variantes.
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onWheelStep: (direction: number, ev: WheelEvent) => void,
  ) {
    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** Elimina listeners del canvas (idempotente si ya se llamó). */
  dispose(): void {
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  /**
   * Lee y resetea los acumuladores del frame.
   *
   * @returns Copia de los deltas desde el `drain` anterior; seguro llamar una vez por frame.
   */
  drain(): CameraInputFrame {
    const frame = {
      movementX: this.movementX,
      movementY: this.movementY,
      wheelDelta: this.wheelDelta,
    };
    this.movementX = 0;
    this.movementY = 0;
    this.wheelDelta = 0;
    return frame;
  }

  /** Solicita pointer lock en el canvas si el juego aún no lo tiene. */
  private readonly onClick = (): void => {
    if (document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock();
    }
  };

  /**
   * Acumula movimiento relativo del ratón (requiere pointer lock en este canvas).
   *
   * Ignora eventos si `document.pointerLockElement !== canvas` (menú, Esc, otra pestaña).
   */
  private readonly onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) {
      return;
    }
    this.movementX += e.movementX;
    this.movementY += e.movementY;
  };

  /**
   * Zoom discreto: un paso por evento de rueda según el signo de `deltaY`.
   *
   * `passive: false` en el listener permite `preventDefault` y evitar scroll de página.
   */
  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
    if (direction !== 0) {
      this.onWheelStep(direction, e);
      this.wheelDelta += direction;
    }
  };
}
