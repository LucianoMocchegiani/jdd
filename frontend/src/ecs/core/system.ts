/**
 * @file Contrato base de sistemas ECS.
 */

import type { Component } from '@/ecs/core/component';
import type { World } from '@/ecs/core/world';

/**
 * Clase base de sistemas: lógica por frame sobre entidades con componentes concretos.
 *
 * Las subclases implementan `update`. El orden de ejecución lo define `priority`
 * (prioridad de sistema ECS, no del Action Registry).
 */
export abstract class System {
  /** Referencia al mundo que registró este sistema; `null` si fue dado de baja */
  protected world: World | null = null;

  /**
   * Orden de ejecución entre sistemas (menor número = se ejecuta antes).
   *
   * No confundir con `priority` de acciones en fichas YAML (eliminada en v2).
   */
  readonly priority: number = 0;

  /** Si es `false`, {@link World.update} omite este sistema */
  enabled = true;

  /**
   * Tipos de componente ({@link Component}) que debe tener una entidad
   * para entrar en `getEntities()` (consulta AND vía {@link World.query}).
   *
   * Vacío = todas las entidades del mundo.
   */
  readonly requiredComponents: readonly string[] = [];

  /**
   * Enlaza o desenlaza el mundo al registrar/desregistrar el sistema.
   *
   * @param world - Instancia de {@link World} o `null` al desregistrar
   */
  setWorld(world: World | null): void {
    this.world = world;
  }

  /**
   * Devuelve las entidades que cumplen `requiredComponents`.
   *
   * @returns Conjunto de IDs de entidad (vacío si el sistema no está registrado)
   */
  getEntities(): ReadonlySet<number> {
    if (!this.world) {
      return new Set();
    }
    return this.world.query(...this.requiredComponents);
  }

  /**
   * Actualiza el sistema para el frame actual.
   *
   * @param deltaTime - Segundos transcurridos desde el frame anterior (ver `GameLoop`)
   */
  abstract update(deltaTime: number): void;

  /**
   * Hook opcional tras el registro en el mundo.
   * Sobrescribir para precargar recursos o suscripciones.
   */
  init(): void {
    // hook opcional
  }

  /**
   * Hook opcional al desregistrar o destruir la aplicación.
   * Sobrescribir para liberar listeners o referencias Three.js.
   */
  destroy(): void {
    // hook opcional
  }
}
