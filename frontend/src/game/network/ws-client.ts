/**
 * @file Conexión WebSocket de bajo nivel — abre, cierra y reconecta el socket.
 *
 * Parseo y dispatch de mensajes: ver `ws-dispatcher.ts`.
 * Presencia y join_block: ver `presence-handler.ts`.
 */

import type { RealtimeInboundMessage, WorldCommand } from '@/types/world-events';
import { decodeWsFrame } from '@/game/network/decode-ws-frame';
import {
  type WorldRealtimeHandlers,
  dispatchMessage,
} from '@/game/network/ws-dispatcher';

/** Espera entre reintentos de conexión tras un cierre inesperado (ms). */
const RECONNECT_DELAY_MS = 3000;

/**
 * Cliente WebSocket de bajo nivel para el juego online.
 *
 * **Responsabilidades**
 * - Mantener una conexión a `/ws` y reconectar si se cae (salvo tras {@link disconnect}).
 * - Parsear JSON entrante de forma defensiva.
 * - Serializar {@link WorldCommand} saliente.
 *
 * **No hace**
 * - Cola de mensajes salientes si el socket no está `OPEN` ( {@link send} devuelve `false` ).
 * - Suscripción por bloque en el wire (la sala se define con `join_block`).
 * - Predicción ni reconciliación de movimiento (capas ECS / `RemotePresence`).
 */
export class WorldRealtimeClient {
  private ws: WebSocket | null = null;
  private handlers: WorldRealtimeHandlers | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Si es `true`, no se programa reconexión tras `onclose`. */
  private disposed = false;
  private inboundQueue: Array<{ msg: RealtimeInboundMessage; receivedAtMs: number }> = [];
  private peakQueueDepth = 0;
  private lastRxAtMs = 0;
  private lastAppliedAtMs = 0;
  private maxRxGapMs = 0;
  private rxCountWindow = 0;
  private rxWindowStartMs = 0;

  /** Métricas WS para debug pos-sync (cola suele ser 0 si drain va al día). */
  getWsDebugStats(): {
    queue: number;
    peak: number;
    lastRxAgeSec: number | null;
    lastAppliedAgeSec: number | null;
    maxRxGapMs: number;
    rxPerSec: number;
  } {
    const now = performance.now();
    if (now - this.rxWindowStartMs >= 1000) {
      this.rxCountWindow = 0;
      this.rxWindowStartMs = now;
      this.maxRxGapMs = 0;
      this.peakQueueDepth = 0;
    }
    return {
      queue: this.inboundQueue.length,
      peak: this.peakQueueDepth,
      lastRxAgeSec: this.lastRxAtMs > 0 ? (now - this.lastRxAtMs) / 1000 : null,
      lastAppliedAgeSec: this.lastAppliedAtMs > 0 ? (now - this.lastAppliedAtMs) / 1000 : null,
      maxRxGapMs: this.maxRxGapMs,
      rxPerSec: this.rxCountWindow,
    };
  }

  /** @deprecated Usar {@link getWsDebugStats}. */
  get inboundQueueDepth(): number {
    return this.inboundQueue.length;
  }

  /** @deprecated Usar {@link getWsDebugStats}. */
  get inboundQueuePeak(): number {
    return this.peakQueueDepth;
  }

  /**
   * Procesa mensajes WS encolados. Llamar al inicio de cada frame del game loop.
   *
   * `onmessage` solo encola (rápido); el trabajo pesado va aquí, antes de sim/render.
   */
  drainInboundQueue(): number {
    if (!this.handlers || this.inboundQueue.length === 0) {
      return 0;
    }
    const batch = this.inboundQueue.splice(0);
    // Aplicar solo el último player_state por jugador (descarta backlog).
    const latestStateByPlayer = new Map<string, { msg: RealtimeInboundMessage; receivedAtMs: number }>();
    const rest: Array<{ msg: RealtimeInboundMessage; receivedAtMs: number }> = [];

    for (const entry of batch) {
      if (entry.msg.type === 'player_state') {
        latestStateByPlayer.set(entry.msg.player_id, entry);
      } else {
        rest.push(entry);
      }
    }

    for (const entry of rest) {
      dispatchMessage(entry.msg, this.handlers);
    }
    for (const { msg, receivedAtMs } of latestStateByPlayer.values()) {
      if (msg.type === 'player_state') {
        this.lastAppliedAtMs = performance.now();
        this.handlers.onSessionEvent?.({ ...msg, receivedAtMs });
      }
    }

    return batch.length;
  }

  private enqueueInbound(msg: RealtimeInboundMessage, receivedAtMs: number): void {
    const now = performance.now();
    if (this.lastRxAtMs > 0) {
      this.maxRxGapMs = Math.max(this.maxRxGapMs, now - this.lastRxAtMs);
    }
    this.lastRxAtMs = now;
    if (now - this.rxWindowStartMs >= 1000) {
      this.rxCountWindow = 0;
      this.rxWindowStartMs = now;
      this.maxRxGapMs = 0;
      this.peakQueueDepth = 0;
    }
    if (msg.type === 'player_state') {
      this.rxCountWindow += 1;
    }

    if (msg.type === 'player_state') {
      const playerId = msg.player_id;
      const existing = this.inboundQueue.findIndex(
        (e) => e.msg.type === 'player_state' && e.msg.player_id === playerId,
      );
      if (existing >= 0) {
        this.inboundQueue.splice(existing, 1);
      }
    }
    this.inboundQueue.push({ msg, receivedAtMs });
    this.peakQueueDepth = Math.max(this.peakQueueDepth, this.inboundQueue.length);
  }

  /**
   * Abre (o reabre) la conexión WebSocket y registra callbacks.
   *
   * Si ya había una conexión, esta llamada reemplaza handlers y llama a `openSocket`
   * de nuevo; usar {@link disconnect} antes si necesitás un cierre limpio.
   *
   * @param url - URL completa del WS (ej. `getWebSocketUrl()` → `ws://host/ws`).
   * @param handlers - Callbacks para mundo, sesión y apertura de socket.
   */
  connect(url: string, handlers: WorldRealtimeHandlers): void {
    this.handlers = handlers;
    this.disposed = false;
    this.openSocket(url);
  }

  /**
   * Envía un comando JSON al servidor.
   *
   * @param command - `join_block`, `swing`, etc. (ver {@link WorldCommand}).
   * @returns `true` si el mensaje se encoló en un socket `OPEN`; `false` si no hay conexión.
   */
  send(command: WorldCommand): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify(command));
    return true;
  }

  /**
   * Cierra el socket y cancela reconexiones automáticas.
   *
   * Debe llamarse al desmontar la partida (p. ej. salir del canvas) para evitar
   * sockets y timers huérfanos.
   */
  disconnect(): void {
    this.disposed = true;
    this.handlers = null;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Crea el `WebSocket`, enlaza listeners y guarda la referencia interna.
   *
   * No hace nada si {@link disposed} es `true` o si `WebSocket` no existe (SSR/tests).
   *
   * @param url - Misma URL pasada a {@link connect}.
   */
  private openSocket(url: string): void {
    if (this.disposed || typeof WebSocket === 'undefined') {
      return;
    }
    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.handlers?.onOpen?.();
      };

      ws.onmessage = async (event) => {
        const receivedAtMs = performance.now();
        try {
          let frame: string | ArrayBuffer;
          if (typeof event.data === 'string') {
            frame = event.data;
          } else if (event.data instanceof ArrayBuffer) {
            frame = event.data;
          } else if (event.data instanceof Blob) {
            frame = await event.data.arrayBuffer();
          } else {
            return;
          }
          const parsed = decodeWsFrame(frame);
          if (parsed) {
            this.enqueueInbound(parsed, receivedAtMs);
          }
        } catch {
          // Frame inválido: ignorar sin tumbar el loop de juego.
        }
      };

      ws.onerror = () => {
        if (import.meta.env.DEV) {
          console.warn('[world-realtime] error de conexión');
        }
      };

      ws.onclose = () => {
        this.ws = null;
        if (!this.disposed) {
          this.scheduleReconnect(url);
        }
      };
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[world-realtime] no se pudo conectar', err);
      }
    }
  }

  /**
   * Programa un único reintento de {@link openSocket} tras {@link RECONNECT_DELAY_MS}.
   *
   * @param url - URL a reutilizar en la reconexión.
   */
  private scheduleReconnect(url: string): void {
    if (this.reconnectTimer != null || this.disposed) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket(url);
    }, RECONNECT_DELAY_MS);
  }
}
