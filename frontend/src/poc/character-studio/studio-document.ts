/**
 * Carga y serialización del documento v2 de Character Studio.
 *
 * @module character-studio/studio-document
 */

import type { ElementLayer, StudioDocument, StudioElement } from '@/poc/character-studio/types';
import bipedDocRaw from '@/poc/biped.md?raw';

const ELEMENT_LAYERS: readonly ElementLayer[] = ['core', 'flesh', 'gear', 'accent'];

function normalizeElementLayer(layer: unknown): ElementLayer {
  if (layer === 'limb') return 'gear';
  if (typeof layer === 'string' && (ELEMENT_LAYERS as readonly string[]).includes(layer)) {
    return layer as ElementLayer;
  }
  throw new Error(`Capa de elemento desconocida: ${String(layer)}`);
}

function normalizeDocument(doc: StudioDocument): StudioDocument {
  return {
    ...doc,
    elements: doc.elements.map((el) => normalizeElement(el)),
  };
}

function normalizeElement(el: StudioElement & { layer?: unknown }): StudioElement {
  return { ...el, layer: normalizeElementLayer(el.layer) };
}

function assertDocumentV2(parsed: unknown): StudioDocument {
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON inválido');
  const o = parsed as Record<string, unknown>;
  if (o.version !== 2 || !Array.isArray(o.bones) || !Array.isArray(o.elements)) {
    throw new Error('Se espera documento v2 (bones + elements)');
  }
  return normalizeDocument(parsed as StudioDocument);
}

/** Serializa un documento v2 a JSON. */
export function documentToJson(doc: StudioDocument, pretty = true): string {
  return JSON.stringify(doc, null, pretty ? 2 : 0);
}

/**
 * Parsea JSON v2 desde texto (panel import o archivo `.md`/`.json`).
 * Acepta export JDD `{ type: 'character-model', model }` o documento directo.
 * Migra capas legacy `limb` → `gear`.
 */
export function documentFromJson(raw: string): StudioDocument {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('JSON vacío');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('JSON mal formado');
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    if (o.type === 'character-model' && o.model) return assertDocumentV2(o.model);
  }
  return assertDocumentV2(parsed);
}

/** Documento por defecto — `src/poc/biped.md` (v2). */
export function defaultBipedDocument(): StudioDocument {
  return documentFromJson(bipedDocRaw);
}
