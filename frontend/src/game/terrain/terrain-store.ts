/**
 * @file Cache en memoria de partículas/tipos — solo ingest WebSocket (`terrain_*`).
 *
 * El servidor empuja chunks al join y al alejarse del centro cargado.
 * Merge incremental por celda; rebuild visual en `terrain_chunk_done`.
 * Destrucción (`particle_destroyed`): índices y renderer se actualizan O(1) por celda.
 */

import { validateAndStoreParticleTypes } from '@/game-data';
import {
  mergeParticlesIntoCellCache,
  particleFromWsWire,
} from '@/game/terrain/terrain-cell-cache';
import { cellKey } from '@/game/utils/cell-key';
import type { Particle, ParticleType } from '@/types/particle';
import type { TerrainWsTypeEntry, WorldEvent } from '@/types/world-events';

/** Partícula eliminada del viewport (para quitar instancias Three.js sin rebuild). */
export interface RemovedParticleView {
  id: string;
  celda_x: number;
  celda_y: number;
  celda_z: number;
}

function isTipoFisicoSolido(
  p: Particle,
  typesByNombre: ReadonlyMap<string, ParticleType>,
): boolean {
  return typesByNombre.get(p.tipo_nombre)?.tipo_fisico === 'solido';
}

function wsTypeToParticleType(t: TerrainWsTypeEntry): ParticleType {
  return {
    id: t.nombre,
    nombre: t.nombre,
    color: t.color ?? null,
    geometria: null,
    opacidad: t.opacidad ?? null,
    tipo_fisico: t.tipo_fisico,
    viscosidad: t.viscosidad ?? null,
    dureza: null,
    propiedades_fisicas: {},
  };
}

/**
 * Almacén de partículas del mundo visible (un bloque + ventana WS).
 */
export class TerrainStore {
  private particles: Particle[] = [];
  private particlesById = new Map<string, Particle>();
  private particleIndexInArray = new Map<string, number>();
  private particlesByCell = new Map<string, Particle>();
  private typesByNombre = new Map<string, ParticleType>();
  private occupiedSolid = new Set<string>();
  private readonly viewportListeners = new Set<() => void>();
  private readonly removedListeners = new Set<(removed: readonly RemovedParticleView[]) => void>();
  private readonly addedListeners = new Set<(added: readonly Particle[]) => void>();
  private viewportNotifyScheduled = false;
  private removalNotifyScheduled = false;
  private additionNotifyScheduled = false;
  private pendingRemovals: RemovedParticleView[] = [];
  private pendingAdditions: Particle[] = [];
  private currentRoundNewParticles: Particle[] = [];
  private indexRebuildGeneration = 0;
  private _rebuildingIndexes = false;
  private wsCellCache = new Map<string, Particle>();
  private wsLoading = true;
  private wsSimulationStable = false;

  get isRebuildingIndexes(): boolean {
    return this._rebuildingIndexes;
  }

  get isWsLoading(): boolean {
    return this.wsLoading;
  }

  /** `true` tras el primer `terrain_chunk_done` (y tras cada ronda de refresh). */
  get isSimulationStable(): boolean {
    return this.wsSimulationStable;
  }

  constructor(
    readonly bloqueId: string,
    readonly cellSize: number,
  ) {}

  static empty(cellSize = 1): TerrainStore {
    return new TerrainStore('', cellSize);
  }

  getParticles(): readonly Particle[] {
    return this.particles;
  }

  getTypesByNombre(): ReadonlyMap<string, ParticleType> {
    return this.typesByNombre;
  }

  getOccupiedSolidCells(): ReadonlySet<string> {
    return this.occupiedSolid;
  }

  getParticleAtCell(x: number, y: number, z: number): Particle | undefined {
    return this.particlesByCell.get(cellKey(x, y, z));
  }

  isCellSolid(x: number, y: number, z: number): boolean {
    return this.occupiedSolid.has(cellKey(x, y, z));
  }

  getParticlesInRadius(
    centerX: number,
    centerY: number,
    centerZ: number,
    radiusCells: number,
  ): Particle[] {
    const out: Particle[] = [];
    const radiusSq = radiusCells * radiusCells;
    const minX = Math.floor(centerX) - radiusCells;
    const maxX = Math.floor(centerX) + radiusCells;
    const minY = Math.floor(centerY) - radiusCells;
    const maxY = Math.floor(centerY) + radiusCells;
    const minZ = Math.floor(centerZ) - radiusCells;
    const maxZ = Math.floor(centerZ) + radiusCells;

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dz = z - centerZ;
          if (dx * dx + dy * dy + dz * dz > radiusSq) {
            continue;
          }
          const p = this.particlesByCell.get(cellKey(x, y, z));
          if (p) {
            out.push(p);
          }
        }
      }
    }
    return out;
  }

  onViewportLoaded(listener: () => void): () => void {
    this.viewportListeners.add(listener);
    return () => this.viewportListeners.delete(listener);
  }

  /** Destrucciones batched (un frame); el renderer quita instancias sin rebuild total. */
  onParticlesRemoved(listener: (removed: readonly RemovedParticleView[]) => void): () => void {
    this.removedListeners.add(listener);
    return () => this.removedListeners.delete(listener);
  }

  /** Chunks nuevos al caminar (refresh WS): añade meshes sin borrar el viewport. */
  onParticlesAdded(listener: (added: readonly Particle[]) => void): () => void {
    this.addedListeners.add(listener);
    return () => this.addedListeners.delete(listener);
  }

  private notifyViewportLoaded(): void {
    for (const listener of this.viewportListeners) {
      listener();
    }
  }

  private notifyParticlesRemoved(removed: readonly RemovedParticleView[]): void {
    if (removed.length === 0) {
      return;
    }
    for (const listener of this.removedListeners) {
      listener(removed);
    }
  }

  private notifyParticlesAdded(added: readonly Particle[]): void {
    if (added.length === 0) {
      return;
    }
    for (const listener of this.addedListeners) {
      listener(added);
    }
  }

  private scheduleViewportNotify(): void {
    if (this.viewportNotifyScheduled) {
      return;
    }
    this.viewportNotifyScheduled = true;
    requestAnimationFrame(() => {
      this.viewportNotifyScheduled = false;
      this.notifyViewportLoaded();
    });
  }

  private scheduleRemovalNotify(): void {
    if (this.removalNotifyScheduled) {
      return;
    }
    this.removalNotifyScheduled = true;
    requestAnimationFrame(() => {
      this.removalNotifyScheduled = false;
      const batch = this.pendingRemovals;
      this.pendingRemovals = [];
      this.notifyParticlesRemoved(batch);
    });
  }

  private scheduleAdditionNotify(): void {
    if (this.additionNotifyScheduled) {
      return;
    }
    this.additionNotifyScheduled = true;
    requestAnimationFrame(() => {
      this.additionNotifyScheduled = false;
      const batch = this.pendingAdditions;
      this.pendingAdditions = [];
      this.notifyParticlesAdded(batch);
    });
  }

  private appendParticlesToStore(added: readonly Particle[]): void {
    for (const p of added) {
      if (this.particlesById.has(p.id)) {
        continue;
      }
      const idx = this.particles.length;
      this.particles.push(p);
      this.particlesById.set(p.id, p);
      this.particleIndexInArray.set(p.id, idx);
    }
  }

  private unindexParticle(p: Particle): void {
    this.particlesById.delete(p.id);
    this.particleIndexInArray.delete(p.id);
    const key = cellKey(p.celda_x, p.celda_y, p.celda_z);
    this.particlesByCell.delete(key);
    this.occupiedSolid.delete(key);
  }

  private rebuildIndexesIncremental(
    particles: Particle[],
    onComplete: () => void,
  ): void {
    const gen = ++this.indexRebuildGeneration;
    this._rebuildingIndexes = true;
    const nextById = new Map<string, Particle>();
    const nextIndexInArray = new Map<string, number>();
    const nextByCell = new Map<string, Particle>();
    const nextSolid = new Set<string>();
    let i = 0;
    const batchSize = 8000;

    const step = (): void => {
      if (gen !== this.indexRebuildGeneration) {
        return;
      }
      const end = Math.min(i + batchSize, particles.length);
      for (; i < end; i += 1) {
        const p = particles[i];
        if (!p) {
          continue;
        }
        nextById.set(p.id, p);
        nextIndexInArray.set(p.id, i);
        const key = cellKey(p.celda_x, p.celda_y, p.celda_z);
        nextByCell.set(key, p);
        if (isTipoFisicoSolido(p, this.typesByNombre)) {
          nextSolid.add(key);
        }
      }
      if (i < particles.length) {
        requestAnimationFrame(step);
        return;
      }
      this.particlesById = nextById;
      this.particleIndexInArray = nextIndexInArray;
      this.particlesByCell = nextByCell;
      this.occupiedSolid = nextSolid;
      this._rebuildingIndexes = false;
      onComplete();
    };

    requestAnimationFrame(step);
  }

  private removeParticleFromStore(p: Particle): boolean {
    const idx = this.particleIndexInArray.get(p.id);
    if (idx === undefined) {
      return false;
    }

    const lastIdx = this.particles.length - 1;
    if (idx !== lastIdx) {
      const last = this.particles[lastIdx];
      if (last) {
        this.particles[idx] = last;
        this.particleIndexInArray.set(last.id, idx);
      }
    }
    this.particles.pop();
    this.unindexParticle(p);
    this.wsCellCache.delete(cellKey(p.celda_x, p.celda_y, p.celda_z));
    return true;
  }

  private resolveParticleForRemoval(
    particleId: string,
    position?: { x: number; y: number; z: number },
  ): Particle | undefined {
    const byId = this.particlesById.get(particleId);
    if (byId) {
      return byId;
    }
    if (position) {
      return this.particlesByCell.get(cellKey(position.x, position.y, position.z));
    }
    return undefined;
  }

  removeParticle(particleId: string, options?: { notify?: boolean }): void {
    const particle = this.resolveParticleForRemoval(particleId);
    if (!particle || !this.removeParticleFromStore(particle)) {
      return;
    }
    const view: RemovedParticleView = {
      id: particle.id,
      celda_x: particle.celda_x,
      celda_y: particle.celda_y,
      celda_z: particle.celda_z,
    };
    if (options?.notify !== false) {
      this.notifyParticlesRemoved([view]);
    }
  }

  applyWorldEvent(event: WorldEvent): boolean {
    if (!this.bloqueId || event.bloque_id !== this.bloqueId) {
      return false;
    }
    if (event.type === 'particle_destroyed') {
      const particle = this.resolveParticleForRemoval(
        event.particle_id,
        event.position,
      );
      if (!particle || !this.removeParticleFromStore(particle)) {
        if (event.position) {
          this.wsCellCache.delete(
            cellKey(event.position.x, event.position.y, event.position.z),
          );
        }
        return false;
      }
      this.pendingRemovals.push({
        id: particle.id,
        celda_x: particle.celda_x,
        celda_y: particle.celda_y,
        celda_z: particle.celda_z,
      });
      this.scheduleRemovalNotify();
      return true;
    }
    if (event.type === 'terrain_types') {
      const mapped = event.types.map(wsTypeToParticleType);
      validateAndStoreParticleTypes(mapped);
      for (const t of mapped) {
        this.typesByNombre.set(t.nombre, t);
      }
      return true;
    }
    if (event.type === 'terrain_chunk') {
      const merged: Particle[] = event.particles.map((p) =>
        particleFromWsWire(p, this.bloqueId),
      );
      mergeParticlesIntoCellCache(this.wsCellCache, merged);
      this.mergeParticlesIntoIndexes(merged);
      if (this.wsSimulationStable) {
        for (const p of merged) {
          if (!this.particlesById.has(p.id)) {
            this.currentRoundNewParticles.push(p);
          }
        }
      }
      return true;
    }
    if (event.type === 'terrain_chunk_done') {
      this.wsLoading = false;
      if (!this.wsSimulationStable) {
        this.particles = Array.from(this.wsCellCache.values());
        this.wsSimulationStable = true;
        this.rebuildIndexesIncremental(this.particles, () => {
          this.scheduleViewportNotify();
        });
      } else {
        const added = this.currentRoundNewParticles;
        this.currentRoundNewParticles = [];
        if (added.length > 0) {
          this.appendParticlesToStore(added);
          this.pendingAdditions.push(...added);
          this.scheduleAdditionNotify();
        }
      }
      return true;
    }
    return false;
  }

  private mergeParticlesIntoIndexes(particles: readonly Particle[]): void {
    for (const p of particles) {
      const key = cellKey(p.celda_x, p.celda_y, p.celda_z);
      this.particlesByCell.set(key, p);
      if (isTipoFisicoSolido(p, this.typesByNombre)) {
        this.occupiedSolid.add(key);
      } else {
        this.occupiedSolid.delete(key);
      }
    }
  }
}
