/**
 * @file Bucle principal del juego basado en `requestAnimationFrame`.
 */

/**
 * Función invocada cada frame con el delta de tiempo en segundos.
 *
 * @param deltaTime - Segundos desde el frame anterior (acotado por {@link MAX_DELTA_SECONDS})
 */
export type FrameCallback = (deltaTime: number) => void;

/** Tope de delta por frame para evitar saltos tras pausas o pestaña en segundo plano */
const MAX_DELTA_SECONDS = 0.1;

/**
 * Bucle de juego: agenda frames con el navegador y notifica el delta acotado.
 *
 * Típicamente el callback actualiza {@link World} y renderiza la escena Three.js.
 * No impone fixed timestep; eso se añadirá en sistemas de física si hace falta.
 */
export class GameLoop {
  private rafId = 0;
  private running = false;
  private lastTime = 0;

  /**
   * @param onFrame - Lógica por frame (ECS + render, etc.)
   */
  constructor(private readonly onFrame: FrameCallback) {}

  /**
   * Arranca el bucle si no estaba activo.
   * Idempotente: llamadas repetidas no crean múltiples cadenas de `rAF`.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  /**
   * Detiene el bucle y cancela el siguiente frame programado.
   */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Callback interno de `requestAnimationFrame` */
  private readonly tick = (now: number): void => {
    if (!this.running) {
      return;
    }

    const deltaTime = Math.min((now - this.lastTime) / 1000, MAX_DELTA_SECONDS);
    this.lastTime = now;
    this.onFrame(deltaTime);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
