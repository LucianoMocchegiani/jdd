/**
 * Atajos de teclado del Character Studio.
 *
 * @module character-studio/studio-keyboard
 */

import type { GizmoMode } from '@/poc/character-studio/studio-document-ops';
import type { StudioMode } from '@/poc/character-studio/types';

export interface StudioKeyboardCallbacks {
  isTyping: () => boolean;
  getMode: () => StudioMode;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onDeselect: () => void;
  onGizmoMode: (mode: GizmoMode) => void;
  onSaveCopy: () => void;
  onTogglePlay: () => void;
  onFocusSelection: () => void;
}

function isMod(ev: KeyboardEvent): boolean {
  return ev.ctrlKey || ev.metaKey;
}

/** Registra listeners globales; devuelve función de limpieza. */
export function attachStudioKeyboard(cb: StudioKeyboardCallbacks): () => void {
  const onKeyDown = (ev: KeyboardEvent): void => {
    if (cb.isTyping()) return;

    const key = ev.key.toLowerCase();

    if (isMod(ev) && key === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      cb.onUndo();
      return;
    }
    if (isMod(ev) && (key === 'y' || (key === 'z' && ev.shiftKey))) {
      ev.preventDefault();
      cb.onRedo();
      return;
    }
    if (isMod(ev) && key === 's') {
      ev.preventDefault();
      cb.onSaveCopy();
      return;
    }
    if (isMod(ev) && key === 'd') {
      ev.preventDefault();
      if (cb.getMode() === 'edit') cb.onDuplicateSelection();
      return;
    }

    if (key === 'delete' || key === 'backspace') {
      if (cb.getMode() === 'edit') {
        ev.preventDefault();
        cb.onDeleteSelection();
      }
      return;
    }

    if (key === 'escape') {
      cb.onDeselect();
      return;
    }

    if (key === ' ' && cb.getMode() === 'animate') {
      ev.preventDefault();
      cb.onTogglePlay();
      return;
    }

    if (key === 'f' && !isMod(ev) && !ev.altKey) {
      cb.onFocusSelection();
      return;
    }

    if (cb.getMode() === 'edit' && !isMod(ev) && !ev.altKey) {
      if (key === 't') {
        cb.onGizmoMode('translate');
        return;
      }
      if (key === 'r') {
        cb.onGizmoMode('rotate');
        return;
      }
      if (key === 's') {
        cb.onGizmoMode('scale');
        return;
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
