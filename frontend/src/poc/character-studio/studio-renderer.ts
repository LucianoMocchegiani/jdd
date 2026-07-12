/**
 * Renderer 3D de Character Studio — elementos instanciados + gizmos de huesos.
 *
 * @module character-studio/studio-renderer
 */

import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { DEFAULT_PALETTE, type ElementShape, type LayerPalette } from '@/poc/shared';
import type { SkeletonPose } from '@/poc/character-studio/rig-math';
import type { StudioBone, StudioDocument, StudioElement } from '@/poc/character-studio/types';

/** Máximo de instancias por bucket layer+shape. */
const MAX = 256;

/** Clave de agrupación: `capa:forma` para InstancedMesh. */
type BucketKey = `${StudioElement['layer']}:${ElementShape}`;

/**
 * Dibuja el personaje con `InstancedMesh` por capa/forma.
 * Los huesos son esferas debug opcionales (solo modo editor).
 */
export class StudioRenderer {
  private readonly root = new Group();
  private readonly buckets = new Map<BucketKey, InstancedMesh>();
  private readonly boneMeshes: InstancedMesh;
  /** Índice instancia → id de hueso (sync con showBones). */
  private boneInstanceIds: string[] = [];
  private readonly geometries = new Map<ElementShape, BufferGeometry>();
  private readonly matrix = new Matrix4();
  private readonly pos = new Vector3();
  private readonly quat = new Quaternion();
  private readonly scl = new Vector3();
  private readonly charWorld = new Matrix4();
  private readonly yawQuat = new Quaternion();
  private readonly axis = new Vector3();
  private palette: LayerPalette;
  private readonly cellSize: number;

  /**
   * @param scene - Escena Three donde colgar el grupo raíz.
   * @param cellSize - Tamaño de celda del mundo (típicamente 1).
   * @param palette - Colores por capa; default {@link DEFAULT_PALETTE}.
   */
  constructor(scene: Scene, cellSize: number, palette: LayerPalette = DEFAULT_PALETTE) {
    this.cellSize = cellSize;
    this.palette = { ...palette };
    this.geometries.set('box', new BoxGeometry(1, 1, 1));
    this.geometries.set('sphere', new SphereGeometry(0.5, 10, 8));
    this.geometries.set('cylinder', new CylinderGeometry(0.5, 0.5, 1, 10));
    this.geometries.set('cone', new ConeGeometry(0.5, 1, 8));

    const boneMat = new MeshStandardMaterial({
      color: new Color(DEFAULT_PALETTE.bone),
      transparent: true,
      opacity: 0.45,
      emissive: new Color(DEFAULT_PALETTE.bone).multiplyScalar(0.2),
      emissiveIntensity: 0.4,
    });
    this.boneMeshes = new InstancedMesh(new SphereGeometry(0.5, 8, 6), boneMat, MAX);
    this.boneMeshes.count = 0;
    this.boneMeshes.frustumCulled = false;

    scene.add(this.root);
    this.root.add(this.boneMeshes);
    this.root.frustumCulled = false;
    this.ensureBuckets();
  }

  /** Crea buckets vacíos para todas las combinaciones layer×shape. @internal */
  private ensureBuckets(): void {
    const layers = ['core', 'flesh', 'gear', 'accent'] as const;
    const shapes: ElementShape[] = ['box', 'sphere', 'cylinder', 'cone'];
    for (const layer of layers) {
      for (const shape of shapes) {
        const key: BucketKey = `${layer}:${shape}`;
        if (this.buckets.has(key)) continue;
        const geom = this.geometries.get(shape)!;
        const mat = new MeshStandardMaterial({
          color: new Color(this.palette[layer]),
          side: DoubleSide,
        });
        const mesh = new InstancedMesh(geom, mat, MAX);
        mesh.count = 0;
        mesh.frustumCulled = false;
        this.root.add(mesh);
        this.buckets.set(key, mesh);
      }
    }
  }

  /**
   * Sincroniza matrices de instancias con la pose actual.
   *
   * @param doc - Documento (elementos y `gridStep`).
   * @param pose - Pose FK del esqueleto.
   * @param opts - Posición personaje en celdas, yaw y visibilidad de gizmos.
   */
  sync(
    doc: StudioDocument,
    pose: SkeletonPose,
    opts: {
      /** Celda X del personaje en el mundo. */
      x: number;
      /** Celda Y del personaje (eje Z Three). */
      y: number;
      /** Celda Z / altura (eje Y Three). */
      z: number;
      /** Yaw del personaje en radianes. */
      yaw: number;
      /** Si true, dibuja esferas en pivotes de huesos (modo editor). */
      showBones: boolean;
    },
  ): void {
    const base = this.cellSize * doc.gridStep;
    this.yawQuat.setFromAxisAngle(this.axis.set(0, 1, 0), opts.yaw);
    this.charWorld.compose(
      new Vector3(opts.x * this.cellSize, opts.z * this.cellSize, opts.y * this.cellSize),
      this.yawQuat,
      new Vector3(1, 1, 1),
    );

    const grouped = new Map<BucketKey, StudioElement[]>();
    for (const el of doc.elements) {
      const key: BucketKey = `${el.layer}:${el.shape}`;
      const list = grouped.get(key) ?? [];
      list.push(el);
      grouped.set(key, list);
    }

    for (const [key, mesh] of this.buckets) {
      mesh.userData.bucketKey = key;
      const list = grouped.get(key) ?? [];
      const count = Math.min(list.length, MAX);
      mesh.count = count;
      for (let i = 0; i < count; i++) {
        const el = list[i]!;
        const world = pose.elementWorldMatrix(el).clone().premultiply(this.charWorld);
        world.decompose(this.pos, this.quat, this.scl);
        this.scl.set(base * el.scale[0], base * el.scale[1], base * el.scale[2]);
        this.matrix.compose(this.pos, this.quat, this.scl);
        mesh.setMatrixAt(i, this.matrix);
      }
      mesh.instanceMatrix.needsUpdate = count > 0;
    }

    if (opts.showBones) {
      const bones = doc.bones.filter((b) => b.id !== 'controller');
      const count = Math.min(bones.length, MAX);
      this.boneMeshes.count = count;
      this.boneInstanceIds = bones.slice(0, count).map((b) => b.id);
      this.boneMeshes.userData.boneIds = this.boneInstanceIds;
      for (let i = 0; i < count; i++) {
        const bone = bones[i]!;
        this.drawBoneGizmo(bone, pose, base);
        this.boneMeshes.setMatrixAt(i, this.matrix);
      }
      this.boneMeshes.instanceMatrix.needsUpdate = true;
    } else {
      this.boneMeshes.count = 0;
      this.boneInstanceIds = [];
      this.boneMeshes.userData.boneIds = [];
    }
  }

  /** Coloca una esfera pequeña en el pivote mundo del hueso. @internal */
  private drawBoneGizmo(bone: StudioBone, pose: SkeletonPose, base: number): void {
    const world = pose.boneWorldMatrix(bone.id).clone().premultiply(this.charWorld);
    world.decompose(this.pos, this.quat, this.scl);
    const s = base * 0.12;
    this.scl.set(s, s, s);
    this.matrix.compose(this.pos, this.quat, this.scl);
  }

  /** Meshes instanciados de elementos (raycast). */
  getPickMeshes(): InstancedMesh[] {
    return [...this.buckets.values()];
  }

  /** Esferas de huesos para pick en modo Editar. */
  getBonePickMesh(): InstancedMesh {
    return this.boneMeshes;
  }

  /** Libera geometrías, materiales y quita el grupo de la escena. */
  dispose(): void {
    this.root.removeFromParent();
    for (const g of this.geometries.values()) g.dispose();
    for (const m of this.buckets.values()) {
      if (!Array.isArray(m.material)) m.material.dispose();
    }
    if (!Array.isArray(this.boneMeshes.material)) this.boneMeshes.material.dispose();
  }
}
