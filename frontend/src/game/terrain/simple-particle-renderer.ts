/**
 * @file Renderer mínimo de partículas (instanced boxes por color).
 */

import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Scene,
} from 'three';
import type { RemovedParticleView } from '@/game/terrain/terrain-store';
import type { Particle, ParticleType } from '@/types/particle';

const MAX_INSTANCES_PER_MESH = 8000;
/** Partículas agrupadas por frame antes de crear meshes (evita bloquear WS). */
const GROUP_BATCH_SIZE = 6000;

interface InstanceSlot {
  mesh: InstancedMesh;
  index: number;
}

/**
 * Dibuja partículas del viewport como cajas instanciadas agrupadas por color.
 */
export class SimpleParticleRenderer {
  private readonly root = new Group();
  private disposed = false;
  private rebuildGeneration = 0;
  private rebuilding = false;
  private readonly instanceIndex = new Map<string, InstanceSlot>();
  private readonly meshSlotToId = new Map<InstancedMesh, Map<number, string>>();
  private readonly swapMatrix = new Matrix4();
  private sharedGeometry: BoxGeometry | null = null;
  private lastCellSize = 1;

  constructor(scene: Scene) {
    scene.add(this.root);
  }

  /** `true` mientras un rebuild incremental está en curso. */
  get isRebuilding(): boolean {
    return this.rebuilding;
  }

  /**
   * Reconstruye meshes de forma síncrona (solo arranque inicial).
   */
  rebuild(
    particles: readonly Particle[],
    typesByNombre: ReadonlyMap<string, ParticleType>,
    cellSize: number,
  ): void {
    this.rebuildGeneration += 1;
    this.rebuilding = false;
    this.clear();
    this.buildAllMeshes(particles, typesByNombre, cellSize);
  }

  /**
   * Reconstruye en varios frames para no bloquear `onmessage` del WebSocket.
   */
  rebuildIncremental(
    particles: readonly Particle[],
    typesByNombre: ReadonlyMap<string, ParticleType>,
    cellSize: number,
  ): void {
    const gen = ++this.rebuildGeneration;
    this.rebuilding = true;
    this.clear();

    const particlesArr = [...particles];
    const byColor = new Map<string, Particle[]>();
    let particleIndex = 0;
    let meshIndex = 0;
    let meshEntries: Array<[string, Particle[]]> = [];
    const geometry = this.ensureGeometry(cellSize);
    const matrix = new Matrix4();

    const buildMeshes = (): void => {
      if (gen !== this.rebuildGeneration || this.disposed) {
        this.rebuilding = false;
        return;
      }
      const entry = meshEntries[meshIndex];
      if (entry) {
        for (let offset = 0; offset < entry[1].length; offset += MAX_INSTANCES_PER_MESH) {
          const slice = entry[1].slice(offset, offset + MAX_INSTANCES_PER_MESH);
          this.addColorMesh(entry[0], slice, geometry, matrix, cellSize);
        }
      }
      meshIndex += 1;
      if (meshIndex < meshEntries.length) {
        requestAnimationFrame(buildMeshes);
      } else {
        this.rebuilding = false;
      }
    };

    const groupBatch = (): void => {
      if (gen !== this.rebuildGeneration || this.disposed) {
        this.rebuilding = false;
        return;
      }
      const end = Math.min(particleIndex + GROUP_BATCH_SIZE, particlesArr.length);
      for (; particleIndex < end; particleIndex += 1) {
        const p = particlesArr[particleIndex];
        if (!p) {
          continue;
        }
        const tipo = typesByNombre.get(p.tipo_nombre);
        const hex = tipo?.color ?? '#6b7280';
        const list = byColor.get(hex) ?? [];
        list.push(p);
        byColor.set(hex, list);
      }
      if (particleIndex < particlesArr.length) {
        requestAnimationFrame(groupBatch);
        return;
      }
      meshEntries = [...byColor.entries()];
      if (meshEntries.length === 0) {
        this.rebuilding = false;
        return;
      }
      requestAnimationFrame(buildMeshes);
    };

    requestAnimationFrame(groupBatch);
  }

  /**
   * Quita instancias destruidas (swap-with-last por mesh) sin rebuild del viewport.
   */
  removeParticles(removed: readonly RemovedParticleView[]): void {
    if (removed.length === 0 || this.disposed) {
      return;
    }

    const byMesh = new Map<InstancedMesh, number[]>();
    for (const p of removed) {
      const slot = this.instanceIndex.get(p.id);
      if (!slot) {
        continue;
      }
      const indices = byMesh.get(slot.mesh) ?? [];
      indices.push(slot.index);
      byMesh.set(slot.mesh, indices);
      this.instanceIndex.delete(p.id);
    }

    for (const [mesh, indices] of byMesh) {
      this.removeInstancesFromMesh(mesh, indices);
    }
  }

  /**
   * Añade instancias nuevas (refresh de terreno al caminar) sin borrar las existentes.
   */
  addParticles(
    added: readonly Particle[],
    typesByNombre: ReadonlyMap<string, ParticleType>,
    cellSize: number,
  ): void {
    if (added.length === 0 || this.disposed) {
      return;
    }

    const geometry = this.ensureGeometry(cellSize);
    const matrix = new Matrix4();
    const byColor = groupParticlesByColor(added, typesByNombre);

    for (const [hex, list] of byColor) {
      for (let offset = 0; offset < list.length; offset += MAX_INSTANCES_PER_MESH) {
        const slice = list.slice(offset, offset + MAX_INSTANCES_PER_MESH);
        this.addColorMesh(hex, slice, geometry, matrix, cellSize);
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.rebuildGeneration += 1;
    this.rebuilding = false;
    this.clear();
    this.disposeSharedGeometry();
    this.root.removeFromParent();
    this.disposed = true;
  }

  private buildAllMeshes(
    particles: readonly Particle[],
    typesByNombre: ReadonlyMap<string, ParticleType>,
    cellSize: number,
  ): void {
    const byColor = groupParticlesByColor(particles, typesByNombre);
    const geometry = this.ensureGeometry(cellSize);
    const matrix = new Matrix4();
    for (const [hex, list] of byColor) {
      for (let offset = 0; offset < list.length; offset += MAX_INSTANCES_PER_MESH) {
        const slice = list.slice(offset, offset + MAX_INSTANCES_PER_MESH);
        this.addColorMesh(hex, slice, geometry, matrix, cellSize);
      }
    }
  }

  private ensureGeometry(cellSize: number): BoxGeometry {
    if (!this.sharedGeometry || this.lastCellSize !== cellSize) {
      this.sharedGeometry?.dispose();
      this.sharedGeometry = new BoxGeometry(cellSize * 0.92, cellSize * 0.92, cellSize * 0.92);
      this.lastCellSize = cellSize;
    }
    return this.sharedGeometry;
  }

  private addColorMesh(
    hex: string,
    list: Particle[],
    geometry: BoxGeometry,
    matrix: Matrix4,
    cellSize: number,
  ): void {
    const count = list.length;
    if (count === 0) {
      return;
    }
    const material = new MeshStandardMaterial({ color: new Color(hex) });
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.castShadow = false;
    mesh.receiveShadow = true;

    const slots = new Map<number, string>();
    for (let i = 0; i < count; i += 1) {
      const p = list[i];
      if (!p) {
        continue;
      }
      matrix.makeTranslation(
        p.celda_x * cellSize,
        p.celda_z * cellSize,
        p.celda_y * cellSize,
      );
      mesh.setMatrixAt(i, matrix);
      this.instanceIndex.set(p.id, { mesh, index: i });
      slots.set(i, p.id);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    this.meshSlotToId.set(mesh, slots);
    this.root.add(mesh);
  }

  private removeInstancesFromMesh(mesh: InstancedMesh, indices: number[]): void {
    const slots = this.meshSlotToId.get(mesh);
    if (!slots) {
      return;
    }

    indices.sort((a, b) => b - a);
    let count = mesh.count;

    for (const idx of indices) {
      if (idx >= count) {
        continue;
      }
      count -= 1;
      if (idx < count) {
        mesh.getMatrixAt(count, this.swapMatrix);
        mesh.setMatrixAt(idx, this.swapMatrix);
        const movedId = slots.get(count);
        if (movedId) {
          slots.set(idx, movedId);
          slots.delete(count);
          this.instanceIndex.set(movedId, { mesh, index: idx });
        }
      } else {
        slots.delete(idx);
      }
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;

    if (count === 0) {
      this.disposeMesh(mesh);
    }
  }

  private disposeMesh(mesh: InstancedMesh): void {
    for (const [id, slot] of this.instanceIndex) {
      if (slot.mesh === mesh) {
        this.instanceIndex.delete(id);
      }
    }
    this.meshSlotToId.delete(mesh);
    this.root.remove(mesh);
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose());
    } else {
      mat.dispose();
    }
  }

  private clear(): void {
    this.instanceIndex.clear();
    this.meshSlotToId.clear();
    const toRemove = [...this.root.children];
    for (const child of toRemove) {
      this.root.remove(child);
      if (child instanceof InstancedMesh) {
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    }
  }

  private disposeSharedGeometry(): void {
    this.sharedGeometry?.dispose();
    this.sharedGeometry = null;
  }
}

function groupParticlesByColor(
  particles: readonly Particle[],
  typesByNombre: ReadonlyMap<string, ParticleType>,
): Map<string, Particle[]> {
  const byColor = new Map<string, Particle[]>();
  for (const p of particles) {
    const tipo = typesByNombre.get(p.tipo_nombre);
    const hex = tipo?.color ?? '#6b7280';
    const list = byColor.get(hex) ?? [];
    list.push(p);
    byColor.set(hex, list);
  }
  return byColor;
}
