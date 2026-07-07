/**
 * @file Cliente HTTP tipado hacia el backend FastAPI.
 *
 * No contiene lógica de juego; solo transporte y helpers de conectividad.
 */

import { API_BASE_URL, getBackendBaseUrl } from '@/api/config';

/**
 * Error lanzado cuando el servidor responde con un código distinto de 2xx.
 */
export class ApiError extends Error {
  /**
   * @param status - Código HTTP de la respuesta (ej. 404, 500)
   * @param message - Texto asociado (`statusText` o mensaje del servidor)
   */
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Opciones de una petición HTTP; el cuerpo se serializa a JSON automáticamente.
 */
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Objeto serializable que se envía como JSON en el cuerpo */
  body?: unknown;
}

/**
 * Cliente HTTP genérico para el API `/api/v1`.
 *
 * Los adapters de dominio (partículas, personajes, etc.) se construirán encima
 * en fases posteriores; por ahora expone verbos CRUD tipados.
 */
export class ApiClient {
  /**
   * @param baseUrl - Origen + `/api/v1`; por defecto {@link API_BASE_URL}
   */
  constructor(private readonly baseUrl: string = API_BASE_URL) {}

  /**
   * Ejecuta una petición y parsea la respuesta como JSON.
   *
   * @typeParam T - Forma esperada del JSON de respuesta
   * @param endpoint - Ruta relativa tras `baseUrl` (ej. `/bloques/1/particles`)
   * @param options - Método, cabeceras y cuerpo opcional
   * @returns Promesa con el cuerpo parseado
   * @throws {@link ApiError} si `response.ok` es falso
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers, ...rest } = options;
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    return (await response.json()) as T;
  }

  /**
   * Petición GET tipada.
   *
   * @typeParam T - Tipo del JSON de respuesta
   */
  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * Petición POST con cuerpo JSON.
   *
   * @typeParam T - Tipo del JSON de respuesta
   */
  post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  /**
   * Petición PUT con cuerpo JSON.
   *
   * @typeParam T - Tipo del JSON de respuesta
   */
  put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  /**
   * Petición DELETE tipada.
   *
   * @typeParam T - Tipo del JSON de respuesta (si el servidor devuelve cuerpo)
   */
  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

/**
 * Respuesta del endpoint `/health` (fuera de `/api/v1`).
 */
export interface HealthResponse {
  /** Estado global: `ok`, `degraded`, etc. */
  status: string;
  /** Estado de la conexión a base de datos, si el backend lo incluye */
  database?: { status: string; message: string };
}

/**
 * Comprueba que el backend está levantado llamando a `/health`.
 *
 * No usa {@link ApiClient} porque el health check no está bajo `/api/v1`.
 *
 * @param baseUrl - Origen del backend; por defecto {@link getBackendBaseUrl}
 * @returns Estado reportado por FastAPI
 * @throws {@link ApiError} si la petición falla
 */
export async function checkBackendHealth(
  baseUrl: string = getBackendBaseUrl(),
): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
  return (await response.json()) as HealthResponse;
}

/**
 * Respuesta mínima de `GET /api` (índice persistence-api greenfield).
 */
export interface ApiInfoResponse {
  message: string;
  version?: string;
}

/**
 * Prueba de humo: verifica que el enrutado `/api` responde.
 *
 * @param client - Cliente a reutilizar; por defecto crea uno nuevo
 * @returns Metadatos del índice del API
 */
export async function fetchApiInfo(client: ApiClient = new ApiClient()): Promise<ApiInfoResponse> {
  return client.get<ApiInfoResponse>('/');
}
