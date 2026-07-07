/**
 * @file Tipos de variables de entorno Vite.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_WS_WIRE_FORMAT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
