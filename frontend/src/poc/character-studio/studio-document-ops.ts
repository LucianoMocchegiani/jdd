/**
 * Operaciones de edición sobre el documento v2 (huesos + elementos).
 *
 * @module character-studio/studio-document-ops
 */

import type {
  BoneAxis,
  BoneRole,
  ElementLayer,
  StudioBone,
  StudioDocument,
  StudioElement,
  Vec3,
} from '@/poc/character-studio/types';
import type { ElementShape } from '@/poc/shared';

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export type EditSelection =
  | { kind: 'element'; id: string }
  | { kind: 'bone'; id: string };

const ZERO: Vec3 = [0, 0, 0];

function nextElementId(doc: StudioDocument): string {
  let n = doc.elements.length + 1;
  while (doc.elements.some((e) => e.id === `pieza-${n}`)) n++;
  return `pieza-${n}`;
}

function nextBoneId(doc: StudioDocument): string {
  let n = doc.bones.length + 1;
  while (doc.bones.some((b) => b.id === `hueso-${n}`)) n++;
  return `hueso-${n}`;
}

export function findElement(doc: StudioDocument, id: string): StudioElement | undefined {
  return doc.elements.find((e) => e.id === id);
}

export function findBone(doc: StudioDocument, id: string): StudioBone | undefined {
  return doc.bones.find((b) => b.id === id);
}

const ENTITY_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Valida un id de hueso o pieza; devuelve mensaje de error o `null` si es válido. */
function validateEntityId(
  doc: StudioDocument,
  id: string,
  currentId?: string,
): string | null {
  const trimmed = id.trim();
  if (!trimmed) return 'ID vacío';
  if (trimmed !== id) return 'Sin espacios al inicio o al final';
  if (!ENTITY_ID_PATTERN.test(trimmed)) {
    return 'Solo letras, números, _ y -; debe empezar con letra';
  }
  if (trimmed !== currentId) {
    if (findBone(doc, trimmed)) return `Ya existe el hueso "${trimmed}"`;
    if (findElement(doc, trimmed)) return `Ya existe la pieza "${trimmed}"`;
  }
  return null;
}

export function renameElement(doc: StudioDocument, oldId: string, newId: string): void {
  if (oldId === newId) return;
  const el = findElement(doc, oldId);
  if (!el) throw new Error(`Pieza no encontrada: ${oldId}`);
  const err = validateEntityId(doc, newId, oldId);
  if (err) throw new Error(err);
  el.id = newId.trim();
}

export function renameBone(doc: StudioDocument, oldId: string, newId: string): void {
  if (oldId === newId) return;
  const bone = findBone(doc, oldId);
  if (!bone) throw new Error(`Hueso no encontrado: ${oldId}`);
  if (oldId === 'controller') throw new Error('No se puede renombrar controller');
  const trimmed = newId.trim();
  const err = validateEntityId(doc, trimmed, oldId);
  if (err) throw new Error(err);

  bone.id = trimmed;
  for (const b of doc.bones) {
    if (b.parentId === oldId) b.parentId = trimmed;
  }
  for (const el of doc.elements) {
    if (el.boneId === oldId) el.boneId = trimmed;
  }
}

export function addElement(
  doc: StudioDocument,
  opts: {
    boneId: string;
    shape?: ElementShape;
    layer?: ElementLayer;
    id?: string;
    pos?: Vec3;
    scale?: Vec3;
    rot?: Vec3;
  },
): StudioElement {
  if (!findBone(doc, opts.boneId)) throw new Error(`Hueso inexistente: ${opts.boneId}`);
  const el: StudioElement = {
    id: opts.id ?? nextElementId(doc),
    boneId: opts.boneId,
    shape: opts.shape ?? 'box',
    layer: opts.layer ?? 'flesh',
    pos: opts.pos ? [...opts.pos] : [...ZERO],
    scale: opts.scale ? [...opts.scale] : [0.2, 0.2, 0.2],
    rot: opts.rot ? [...opts.rot] : [...ZERO],
  };
  if (doc.elements.some((e) => e.id === el.id)) throw new Error(`Elemento duplicado: ${el.id}`);
  doc.elements.push(el);
  return el;
}

export function updateElement(doc: StudioDocument, id: string, patch: Partial<Omit<StudioElement, 'id'>>): void {
  const el = findElement(doc, id);
  if (!el) throw new Error(`Elemento no encontrado: ${id}`);
  if (patch.boneId !== undefined) {
    if (!findBone(doc, patch.boneId)) throw new Error(`Hueso inexistente: ${patch.boneId}`);
    el.boneId = patch.boneId;
  }
  if (patch.shape !== undefined) el.shape = patch.shape;
  if (patch.layer !== undefined) el.layer = patch.layer;
  if (patch.pos !== undefined) el.pos = [...patch.pos];
  if (patch.scale !== undefined) el.scale = [...patch.scale];
  if (patch.rot !== undefined) el.rot = [...patch.rot];
  if (patch.isCore !== undefined) el.isCore = patch.isCore;
}

export function removeElement(doc: StudioDocument, id: string): void {
  const idx = doc.elements.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error(`Elemento no encontrado: ${id}`);
  doc.elements.splice(idx, 1);
}

/** Duplica una pieza con offset leve en posición. */
export function duplicateElement(doc: StudioDocument, id: string): StudioElement {
  const src = findElement(doc, id);
  if (!src) throw new Error(`Elemento no encontrado: ${id}`);
  const el = addElement(doc, {
    boneId: src.boneId,
    shape: src.shape,
    layer: src.layer,
    pos: [src.pos[0] + 0.05, src.pos[1], src.pos[2]],
    scale: [...src.scale],
    rot: [...src.rot],
  });
  if (src.isCore) el.isCore = true;
  return el;
}

/** Duplica un hueso como hermano (mismo padre), con pivote desplazado. No copia hijos ni piezas. */
export function duplicateBone(doc: StudioDocument, id: string): StudioBone {
  const src = findBone(doc, id);
  if (!src) throw new Error(`Hueso no encontrado: ${id}`);
  if (id === 'controller') throw new Error('No se puede duplicar controller');
  return addBone(doc, {
    parentId: src.parentId,
    pivot: [src.pivot[0] + 0.05, src.pivot[1], src.pivot[2]],
    axis: src.axis,
    role: src.role,
    rot: src.rot ? [...src.rot] : [...ZERO],
  });
}

export function addBone(
  doc: StudioDocument,
  opts: {
    parentId: string | null;
    id?: string;
    pivot?: Vec3;
    axis?: BoneAxis;
    role?: BoneRole;
    rot?: Vec3;
  },
): StudioBone {
  if (opts.parentId && !findBone(doc, opts.parentId)) {
    throw new Error(`Hueso padre inexistente: ${opts.parentId}`);
  }
  const parent = opts.parentId ? findBone(doc, opts.parentId) : null;
  const bone: StudioBone = {
    id: opts.id ?? nextBoneId(doc),
    parentId: opts.parentId,
    pivot: opts.pivot ? [...opts.pivot] : parent ? [...parent.pivot] : [...ZERO],
    axis: opts.axis ?? 'y',
    role: opts.role ?? 'hip',
    rot: opts.rot ? [...opts.rot] : [...ZERO],
  };
  if (doc.bones.some((b) => b.id === bone.id)) throw new Error(`Hueso duplicado: ${bone.id}`);
  doc.bones.push(bone);
  return bone;
}

export function boneDescendants(doc: StudioDocument, boneId: string): Set<string> {
  const out = new Set<string>();
  const queue = [boneId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const b of doc.bones) {
      if (b.parentId === id && !out.has(b.id)) {
        out.add(b.id);
        queue.push(b.id);
      }
    }
  }
  return out;
}

export function canDeleteBone(doc: StudioDocument, id: string): string | null {
  if (id === 'controller') return 'No se puede borrar controller';
  if (!findBone(doc, id)) return 'Hueso no encontrado';
  if (doc.bones.some((b) => b.parentId === id)) return 'Tiene huesos hijos';
  if (doc.elements.some((e) => e.boneId === id)) return 'Tiene elementos colgados';
  return null;
}

export function removeBone(doc: StudioDocument, id: string): void {
  const reason = canDeleteBone(doc, id);
  if (reason) throw new Error(reason);
  const idx = doc.bones.findIndex((b) => b.id === id);
  doc.bones.splice(idx, 1);
}

export function updateBone(doc: StudioDocument, id: string, patch: Partial<Omit<StudioBone, 'id'>>): void {
  const bone = findBone(doc, id);
  if (!bone) throw new Error(`Hueso no encontrado: ${id}`);
  if (patch.pivot !== undefined) bone.pivot = [...patch.pivot];
  if (patch.axis !== undefined) bone.axis = patch.axis;
  if (patch.role !== undefined) bone.role = patch.role;
  if (patch.rot !== undefined) bone.rot = [...patch.rot];
}

export function reparentBone(doc: StudioDocument, boneId: string, newParentId: string | null): void {
  const bone = findBone(doc, boneId);
  if (!bone) throw new Error(`Hueso no encontrado: ${boneId}`);
  if (boneId === 'controller') throw new Error('No se puede reparentar controller');
  if (newParentId === boneId) throw new Error('Un hueso no puede ser padre de sí mismo');
  if (newParentId) {
    if (!findBone(doc, newParentId)) throw new Error(`Hueso padre inexistente: ${newParentId}`);
    if (boneDescendants(doc, boneId).has(newParentId)) throw new Error('Ciclo en jerarquía de huesos');
  }
  bone.parentId = newParentId;
}

export function applyBindPoseToSkeleton(
  doc: StudioDocument,
  setBoneRot: (id: string, rot: Vec3) => void,
): void {
  for (const bone of doc.bones) {
    setBoneRot(bone.id, bone.rot ? [...bone.rot] : [...ZERO]);
  }
}
