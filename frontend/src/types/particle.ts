/**
 * @file Contratos de partículas y tipos (cliente + wire WS).
 */

/** Familia física en BD (`tipos_particulas.tipo_fisico`). */
export type PhysicsType = 'solido' | 'liquido' | 'gas' | 'energia';

/**
 * Tipo de partícula con estilo y propiedades físicas.
 * Catálogo vía mensaje WS ``terrain_types``.
 */
export interface ParticleType {
  id: string;
  nombre: string;
  color: string | null;
  geometria: Record<string, unknown> | null;
  opacidad: number | null;
  tipo_fisico: PhysicsType;
  viscosidad: number | null;
  dureza: number | null;
  propiedades_fisicas: Record<string, unknown>;
}

/**
 * Instancia de partícula en el mundo (cache local / wire WS).
 */
export interface Particle {
  id: string;
  bloque_id: string;
  celda_x: number;
  celda_y: number;
  celda_z: number;
  tipo: string;
  estado: string;
  tipo_nombre: string;
  estado_nombre: string;
  tipo_particula_id: string;
  estado_materia_id: string;
  cantidad: number;
  temperatura: number;
  energia: number;
  extraida: boolean;
  agrupacion_id: string | null;
  es_nucleo: boolean;
  propiedades: Record<string, unknown>;
  creado_en: string;
  modificado_en: string;
  creado_por: string | null;
}
