/**
 * Raycast en viewport — selección de elementos y huesos.
 *
 * @module character-studio/studio-pick
 */

import type { StudioDocument } from '@/poc/character-studio/types';
import { Camera, InstancedMesh, Matrix4, Raycaster, Vector2, type WebGLRenderer } from 'three';

const _ndc = new Vector2();
const _ray = new Raycaster();

type BucketKey = string;

function pointerRay(event: PointerEvent, camera: Camera, renderer: WebGLRenderer): void {
  const rect = renderer.domElement.getBoundingClientRect();
  _ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);
}

/**
 * Devuelve `elementId` del cubo más cercano bajo el cursor, o `null`.
 */
export function pickElementFromPointer(
  event: PointerEvent,
  camera: Camera,
  renderer: WebGLRenderer,
  doc: StudioDocument,
  meshes: InstancedMesh[],
): string | null {
  pointerRay(event, camera, renderer);
  const grouped = groupElementsByMeshKey(doc);

  let bestDist = Infinity;
  let bestElementId: string | null = null;

  for (const mesh of meshes) {
    const key = mesh.userData.bucketKey as BucketKey | undefined;
    if (!key) continue;
    const elements = grouped.get(key);
    if (!elements?.length) continue;

    const hits = _ray.intersectObject(mesh, false);
    if (hits.length === 0) continue;

    const hit = hits[0]!;
    if (hit.instanceId === undefined) continue;
    const el = elements[hit.instanceId];
    if (!el) continue;

    if (hit.distance < bestDist) {
      bestDist = hit.distance;
      bestElementId = el.id;
    }
  }

  return bestElementId;
}

/**
 * Devuelve `boneId` del elemento más cercano bajo el cursor (modo Animar).
 */
export function pickBoneFromPointer(
  event: PointerEvent,
  camera: Camera,
  renderer: WebGLRenderer,
  doc: StudioDocument,
  _charWorld: Matrix4,
  meshes: InstancedMesh[],
): string | null {
  const elementId = pickElementFromPointer(event, camera, renderer, doc, meshes);
  if (!elementId) return null;
  return doc.elements.find((e) => e.id === elementId)?.boneId ?? null;
}

/**
 * Devuelve `boneId` de la esfera de hueso más cercana (modo Editar).
 */
export function pickBoneSphereFromPointer(
  event: PointerEvent,
  camera: Camera,
  renderer: WebGLRenderer,
  boneMesh: InstancedMesh,
): string | null {
  if (boneMesh.count === 0) return null;
  pointerRay(event, camera, renderer);
  const hits = _ray.intersectObject(boneMesh, false);
  if (hits.length === 0) return null;
  const hit = hits[0]!;
  if (hit.instanceId === undefined) return null;
  const ids = boneMesh.userData.boneIds as string[] | undefined;
  return ids?.[hit.instanceId] ?? null;
}

function groupElementsByMeshKey(doc: StudioDocument): Map<BucketKey, typeof doc.elements> {
  const grouped = new Map<BucketKey, typeof doc.elements>();
  for (const el of doc.elements) {
    const key: BucketKey = `${el.layer}:${el.shape}`;
    const list = grouped.get(key) ?? [];
    list.push(el);
    grouped.set(key, list);
  }
  return grouped;
}
