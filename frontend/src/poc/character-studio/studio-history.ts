/**
 * Historial deshacer / rehacer del documento (modo Editar).
 *
 * @module character-studio/studio-history
 */

import type { StudioDocument } from '@/poc/character-studio/types';

const MAX_STEPS = 50;

export class StudioDocumentHistory {
  private stack: StudioDocument[] = [];
  private index = 0;

  constructor(initial: StudioDocument) {
    this.stack = [structuredClone(initial)];
    this.index = 0;
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  /** Guarda el estado actual del documento como nuevo paso. */
  commit(doc: StudioDocument): void {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(structuredClone(doc));
    while (this.stack.length > MAX_STEPS) {
      this.stack.shift();
    }
    this.index = this.stack.length - 1;
  }

  undo(): StudioDocument | null {
    if (!this.canUndo) return null;
    this.index--;
    return structuredClone(this.stack[this.index]!);
  }

  redo(): StudioDocument | null {
    if (!this.canRedo) return null;
    this.index++;
    return structuredClone(this.stack[this.index]!);
  }

  /** Reinicia tras importar un documento nuevo. */
  reset(doc: StudioDocument): void {
    this.stack = [structuredClone(doc)];
    this.index = 0;
  }
}
