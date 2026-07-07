/**
 * @file Cliente HTTP de bloques (dimensiones / mundos).
 */

import type { ApiClient } from '@/api/client';

/**
 * Dimensión jugable (bloque) devuelta por `GET /bloques`.
 */
export interface BloqueDimension {
  id: string;
  nombre: string;
  ancho_metros: number;
  alto_metros: number;
  profundidad_maxima: number;
  altura_maxima: number;
  tamano_celda: number;
  origen_x: number;
  origen_y: number;
  origen_z: number;
}

/**
 * Acceso a listado de bloques para elegir mundo en bootstrap / fase 2.
 */
export class BloquesApi {
  constructor(private readonly client: ApiClient) {}

  /** Lista todas las dimensiones disponibles. */
  listBloques(): Promise<BloqueDimension[]> {
    return this.client.get<BloqueDimension[]>('/bloques');
  }

  /**
   * Bloque en la posición indicada de la lista API (`creado_en DESC` en backend).
   *
   * @param listIndex - Índice 0-based (ver {@link DEFAULT_BLOQUE_LIST_INDEX})
   */
  async getBloqueAtListIndex(listIndex: number): Promise<BloqueDimension | null> {
    const bloques = await this.listBloques();
    return bloques[listIndex] ?? null;
  }

  /** Primer bloque cuyo `nombre` contiene el substring (case-sensitive). */
  async getBloqueByNombreIncludes(substring: string): Promise<BloqueDimension | null> {
    const bloques = await this.listBloques();
    return bloques.find((b) => b.nombre.includes(substring)) ?? null;
  }
}
