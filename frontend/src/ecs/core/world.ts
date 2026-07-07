/**
 * @file Mundo ECS: entidades, componentes, consultas y sistemas.
 */

import type { Component } from '@/ecs/core/component';
import type { System } from '@/ecs/core/system';

/**
 * Identificador numérico único de una entidad en el mundo.
 */
export type EntityId = number;

/**
 * Contenedor ECS: crea entidades, almacena componentes y ejecuta sistemas ordenados.
 *
 * Índices internos (todos privados, ver campos de clase):
 * - Por tipo de componente → entidad → instancia
 * - Por entidad → conjunto de tipos presentes
 * - Consultas `query` cacheadas hasta mutar componentes
 */
export class World {
  /** Siguiente id libre al llamar `createEntity` (autoincremental desde 1). */
  private nextEntityId = 1;

  /**
   * Almacén principal: `componentType` → (`entityId` → componente).
   * Permite `getComponent` O(1) por tipo.
   */
  private readonly components = new Map<string, Map<EntityId, Component>>();

  /**
   * Índice inverso: qué tipos tiene cada entidad.
   * Se mantiene alineado con `addComponent` / `removeComponent`.
   */
  private readonly entities = new Map<EntityId, Set<string>>();

  /** Sistemas registrados; el orden de ejecución no es el de inserción. */
  private readonly systems: System[] = [];

  /**
   * Copia de `systems` ordenada por `priority` ascendente.
   * `null` si hay que recalcular tras register/unregister.
   */
  private sortedSystems: System[] | null = null;

  /** `true` cuando cambió la lista de sistemas y falta reordenar. */
  private systemsDirty = true;

  /**
   * Cache de `query(...)`: clave = tipos ordenados unidos por coma.
   * Se invalida en cualquier cambio de composición de entidades.
   */
  private readonly queryCache = new Map<string, Set<EntityId>>();

  /**
   * Crea una entidad vacía (sin componentes).
   *
   * @returns ID de la nueva entidad
   */
  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.entities.set(id, new Set());
    return id;
  }

  /**
   * Elimina una entidad y todos sus componentes.
   *
   * @param entityId - Entidad a destruir (no hace nada si no existe)
   */
  destroyEntity(entityId: EntityId): void {
    const types = this.entities.get(entityId);
    if (!types) {
      return;
    }
    for (const type of types) {
      this.removeComponent(entityId, type);
    }
    this.entities.delete(entityId);
    this.queryCache.clear();
  }

  /**
   * Añade o reemplaza un componente en una entidad existente.
   *
   * @param entityId - Entidad destino
   * @param component - Instancia del componente (usa su `type` como clave)
   * @throws Error si la entidad no existe
   */
  addComponent(entityId: EntityId, component: Component): void {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    const { type } = component;
    let map = this.components.get(type);
    if (!map) {
      map = new Map();
      this.components.set(type, map);
    }
    map.set(entityId, component);
    this.entities.get(entityId)?.add(type);
    this.queryCache.clear();
  }

  /**
   * Obtiene un componente de una entidad por tipo.
   *
   * @typeParam T - Subtipo esperado del componente
   * @returns Instancia o `undefined` si la entidad no lo tiene
   */
  getComponent<T extends Component>(entityId: EntityId, type: string): T | undefined {
    return this.components.get(type)?.get(entityId) as T | undefined;
  }

  /**
   * Indica si una entidad tiene un componente del tipo dado.
   */
  hasComponent(entityId: EntityId, type: string): boolean {
    return this.components.get(type)?.has(entityId) ?? false;
  }

  /**
   * Quita un componente de una entidad sin destruir la entidad.
   *
   * @param entityId - Entidad a modificar
   * @param type - `Component.type` a eliminar
   */
  removeComponent(entityId: EntityId, type: string): void {
    this.components.get(type)?.delete(entityId);
    this.entities.get(entityId)?.delete(type);
    this.queryCache.clear();
  }

  /**
   * Entidades que tienen **todos** los tipos de componente indicados (AND lógico).
   *
   * Sin argumentos devuelve todas las entidades vivas.
   * El resultado está cacheado hasta el próximo cambio de componentes.
   *
   * @param componentTypes - Lista de `Component.type` (ej. `'position'`, `'input'`)
   * @returns Conjunto de IDs (puede estar vacío)
   */
  query(...componentTypes: string[]): Set<EntityId> {
    const cacheKey = [...componentTypes].sort().join(',');
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (componentTypes.length === 0) {
      const all = new Set(this.entities.keys());
      this.queryCache.set(cacheKey, all);
      return all;
    }

    const [first, ...rest] = componentTypes;
    const firstMap = this.components.get(first ?? '');
    if (!firstMap || firstMap.size === 0) {
      const empty = new Set<EntityId>();
      this.queryCache.set(cacheKey, empty);
      return empty;
    }

    let result = new Set(firstMap.keys());
    for (const type of rest) {
      const map = this.components.get(type);
      if (!map || map.size === 0) {
        const empty = new Set<EntityId>();
        this.queryCache.set(cacheKey, empty);
        return empty;
      }
      result = new Set([...result].filter((id) => map.has(id)));
    }

    this.queryCache.set(cacheKey, result);
    return result;
  }

  /**
   * Registra un sistema y lo asocia a este mundo.
   *
   * El orden de ejecución se recalcula en el próximo `update`.
   */
  registerSystem(system: System): void {
    this.systems.push(system);
    system.setWorld(this);
    this.systemsDirty = true;
  }

  /**
   * Da de baja un sistema y limpia su referencia al mundo.
   */
  unregisterSystem(system: System): void {
    const index = this.systems.indexOf(system);
    if (index === -1) {
      return;
    }
    this.systems.splice(index, 1);
    system.setWorld(null);
    this.systemsDirty = true;
  }

  /**
   * Ejecuta un frame: todos los sistemas habilitados, ordenados por `priority` (menor primero).
   *
   * @param deltaTime - Delta en segundos (proveniente del game loop)
   */
  update(deltaTime: number): void {
    if (this.systemsDirty || !this.sortedSystems) {
      this.sortedSystems = [...this.systems].sort((a, b) => a.priority - b.priority);
      this.systemsDirty = false;
    }

    for (const system of this.sortedSystems) {
      if (system.enabled) {
        system.update(deltaTime);
      }
    }
  }

  /**
   * Contadores simples para depuración o overlay de desarrollo.
   */
  getStats(): { entities: number; systems: number } {
    return {
      entities: this.entities.size,
      systems: this.systems.length,
    };
  }
}
