/**
 * Export JDD — modelo `.json` separado de clips individuales.
 *
 * @module character-studio/studio-export
 */

import type { StudioAnimationClip, StudioClipLibrary, StudioDocument } from '@/poc/character-studio/types';

interface JddModelExport {
  version: 2;
  type: 'character-model';
  model: StudioDocument;
}

interface JddClipExport {
  version: 2;
  type: 'character-clip';
  clip: StudioAnimationClip;
}

function exportModelPayload(doc: StudioDocument): JddModelExport {
  return { version: 2, type: 'character-model', model: doc };
}

function exportModelJson(doc: StudioDocument): string {
  return JSON.stringify(exportModelPayload(doc), null, 2);
}

function exportClipJson(clip: StudioAnimationClip): string {
  return JSON.stringify(
    { version: 2, type: 'character-clip', clip } satisfies JddClipExport,
    null,
    2,
  );
}

function downloadTextFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga modelo + todos los clips de la librería. */
export function downloadJddBundle(doc: StudioDocument, library: StudioClipLibrary): void {
  const slug = doc.label.replace(/\s+/g, '-').toLowerCase() || 'character';
  downloadTextFile(`${slug}.json`, exportModelJson(doc));
  for (const clip of library.clips) {
    downloadTextFile(`${clip.id}.json`, exportClipJson(clip));
  }
}
