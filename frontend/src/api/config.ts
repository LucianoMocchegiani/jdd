/**
 * @file Configuración de URLs del backend compartido con v1.
 *
 * Detecta entorno (desarrollo con proxy Vite, Docker nginx en :8080, o backend directo).
 */

/**
 * Obtiene el origen del backend **sin** el sufijo `/api/v1`.
 *
 * Orden de resolución:
 * 1. `VITE_API_BASE_URL` si está definida en `.env`
 * 2. Cadena vacía en dev (proxy Vite → backend)
 * 3. Cadena vacía si el puerto es `8080` o `8081` (nginx v1 / v2 en Docker)
 * 4. `http://localhost:8000` en cualquier otro caso (ej. `vite preview` en :4173)
 *
 * Equivalente conceptual a `getBackendBaseUrl()` en `frontend/src/shared/config.js`.
 *
 * @returns Origen HTTP del backend (puede ser `''` para rutas relativas)
 */
export function getBackendBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return '';
  }

  if (typeof window !== 'undefined') {
    const port = window.location.port;
    // Mismo origen vía nginx (Docker): rutas relativas /api, /health, /ws
    if (!port || port === '80' || port === '443' || port === '8080' || port === '8081') {
      return '';
    }
  }

  return 'http://localhost:8000';
}

/**
 * URL base del API REST (`/api` — sin versión en URL, greenfield).
 *
 * Override monolito Python: `VITE_API_BASE=/api/v1` en `.env`.
 */
export const API_BASE_URL = `${getBackendBaseUrl()}${import.meta.env.VITE_API_BASE ?? '/api'}`;

/**
 * URL del WebSocket del backend (`/ws`).
 *
 * Prioridad:
 * 1. `VITE_WS_URL` explícita (ej. `ws://localhost:8082/ws` gateway)
 * 2. Dev con proxy Vite → `ws(s)://{window.host}/ws` → game-server :8001
 * 3. `VITE_API_BASE_URL` → reemplaza `http` por `ws` + `/ws`
 */
export function getWebSocketUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }
  const base = getBackendBaseUrl();
  if (base === '') {
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}/ws`;
  }
  return base.replace(/^http/, 'ws') + '/ws';
}

/** Preferencia M6 para negociar wire en `join_block`. */
export function getPreferredWireFormat(): 'json' | 'msgpack' {
  const v = import.meta.env.VITE_WS_WIRE_FORMAT;
  return v === 'msgpack' ? 'msgpack' : 'json';
}
