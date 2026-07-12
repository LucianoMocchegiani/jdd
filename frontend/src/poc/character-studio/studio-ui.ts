/**
 * Panel lateral de Character Studio — pestañas Editar / Animar.
 *
 * @module character-studio/studio-ui
 */

import { copyToClipboard } from '@/poc/character-studio/clipboard';
import { documentFromJson, documentToJson } from '@/poc/character-studio/studio-document';
import {
  addBone,
  addElement,
  canDeleteBone,
  findBone,
  findElement,
  reparentBone,
  updateBone,
  updateElement,
  type EditSelection,
  type GizmoMode,
} from '@/poc/character-studio/studio-document-ops';
import type { StudioAnimStore } from '@/poc/character-studio/studio-anim-store';
import { clipFromJson, clipToJson } from '@/poc/character-studio/studio-clip';
import { downloadJddBundle } from '@/poc/character-studio/studio-export';
import type { SkeletonPose } from '@/poc/character-studio/rig-math';
import type {
  BoneAxis,
  BoneRole,
  ElementLayer,
  StudioBone,
  StudioDocument,
  StudioMode,
  Vec3,
} from '@/poc/character-studio/types';
import type { ElementShape } from '@/poc/shared';

export interface StudioUiCallbacks {
  getDoc: () => StudioDocument;
  getPose: () => SkeletonPose;
  getStore: () => StudioAnimStore;
  getMode: () => StudioMode;
  setMode: (mode: StudioMode) => void;
  getShowBones: () => boolean;
  setShowBones: (v: boolean) => void;
  getPlaying: () => boolean;
  setPlaying: (v: boolean) => void;
  getTime: () => number;
  setTime: (t: number) => void;
  applyClipAtTime: () => void;
  reloadDocument: (doc: StudioDocument) => void;
  getSelection: () => EditSelection | null;
  setSelection: (sel: EditSelection | null) => void;
  getGizmoMode: () => GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;
  mutateDocument: (fn: (doc: StudioDocument) => void) => void;
  onStatus: (msg: string) => void;
  onBoneSelect: (boneId: string | null) => void;
  onRotChange: (boneId: string, rot: Vec3) => void;
  onClipImported: () => void;
  onEditChange: () => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onRenameSelection: (newId: string) => void;
}

const ROT_SLIDER_MAX = 314;
const SHAPES: ElementShape[] = ['box', 'sphere', 'cylinder', 'cone'];
const LAYERS: ElementLayer[] = ['core', 'flesh', 'gear', 'accent'];
const ROLES: BoneRole[] = ['root', 'neck', 'hip', 'knee', 'shoulder', 'elbow'];
const AXES: BoneAxis[] = ['x', 'y', 'z'];

function fmtNum(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : '0';
}

function parseNum(raw: string): number | null {
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

function boneChildren(doc: StudioDocument, parentId: string | null): StudioBone[] {
  return doc.bones
    .filter((b) => b.parentId === parentId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function boneAncestors(doc: StudioDocument, boneId: string): string[] {
  const out: string[] = [];
  let cur = findBone(doc, boneId)?.parentId ?? null;
  while (cur) {
    out.push(cur);
    cur = findBone(doc, cur)?.parentId ?? null;
  }
  return out;
}

export class StudioUi {
  readonly root: HTMLElement;
  private readonly cb: StudioUiCallbacks;

  private showBones = true;
  private selectedBoneId: string | null = null;
  private readonly expandedBones = new Set<string>();
  private suppressPropsSync = false;

  private tabEdit!: HTMLButtonElement;
  private tabAnim!: HTMLButtonElement;
  private panelEdit!: HTMLElement;
  private panelAnim!: HTMLElement;
  private outliner!: HTMLElement;
  private boneSelect!: HTMLSelectElement;
  private rotSliders!: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
  private rotLabels!: [HTMLElement, HTMLElement, HTMLElement];
  private importDoc!: HTMLTextAreaElement;
  private exportDoc!: HTMLTextAreaElement;
  private exportClip!: HTMLTextAreaElement;
  private importClip!: HTMLTextAreaElement;
  private showBonesCheck!: HTMLInputElement;
  private propsEmpty!: HTMLElement;
  private propsContent!: HTMLElement;
  private propsKindLabel!: HTMLElement;
  private propsIdInput!: HTMLInputElement;
  private propsSelKey = '';
  private propsElFields!: HTMLElement;
  private propsBoneFields!: HTMLElement;
  private propsScaleRow!: HTMLElement;
  private gizmoBtns!: Record<GizmoMode, HTMLButtonElement>;

  private propsElBone!: HTMLSelectElement;
  private propsElShape!: HTMLSelectElement;
  private propsElLayer!: HTMLSelectElement;
  private propsBoneParent!: HTMLSelectElement;
  private propsBoneRole!: HTMLSelectElement;
  private propsBoneAxis!: HTMLSelectElement;
  private propsDelBtn!: HTMLButtonElement;
  private propsPosBlock!: HTMLElement;
  private propsRotBlock!: HTMLElement;
  private propsPivotBlock!: HTMLElement;
  private propsBoneRotBlock!: HTMLElement;
  private propsPosInputs!: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
  private propsRotInputs!: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
  private propsScaleInputs!: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
  private propsPivotInputs!: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
  private propsBoneRotInputs!: [HTMLInputElement, HTMLInputElement, HTMLInputElement];

  constructor(callbacks: StudioUiCallbacks) {
    this.cb = callbacks;
    this.root = document.createElement('aside');
    this.root.id = 'character-studio-panel';
    this.build();
  }

  private build(): void {
    this.root.innerHTML = `
      <h2>Character Studio</h2>
      <p class="studio-hint">Outliner · Ctrl+Z/Y · Del · Ctrl+D · T/R/S · F · Esc</p>

      <nav class="studio-tabs">
        <button type="button" id="tab-edit" class="studio-tab active">Editar</button>
        <button type="button" id="tab-anim" class="studio-tab">Animar</button>
      </nav>

      <section id="panel-edit">
        <div class="studio-toolbar">
          <div class="studio-gizmo-modes">
            <button type="button" id="gizmo-translate" class="studio-btn active" title="Mover (T)">T</button>
            <button type="button" id="gizmo-rotate" class="studio-btn" title="Rotar (R)">R</button>
            <button type="button" id="gizmo-scale" class="studio-btn" title="Escalar (S)">S</button>
          </div>
          <div class="studio-add-bar">
            <button type="button" id="btn-add-element" class="studio-btn primary">+ Pieza</button>
            <button type="button" id="btn-add-bone" class="studio-btn primary">+ Hueso</button>
          </div>
        </div>

        <h3>Outliner</h3>
        <p id="studio-doc-summary" class="studio-hint studio-hint-sm"></p>
        <div id="studio-outliner" class="studio-outliner" role="tree"></div>

        <h3>Propiedades</h3>
        <div id="props-empty" class="studio-props-empty">
          Seleccioná un hueso o pieza en el outliner o en el viewport.
        </div>
        <div id="props-content" hidden>
          <p class="studio-hint studio-hint-sm"><span id="props-kind"></span></p>
          <label class="studio-field-block">ID
            <input type="text" id="props-id-input" class="studio-input" autocomplete="off" spellcheck="false" />
          </label>
          <div id="props-el-fields">
            <label class="studio-field-block">Hueso
              <select id="props-el-bone" class="studio-input"></select>
            </label>
            <label class="studio-field-block">Forma
              <select id="props-el-shape" class="studio-input"></select>
            </label>
            <label class="studio-field-block">Capa
              <select id="props-el-layer" class="studio-input"></select>
            </label>
          </div>
          <div id="props-bone-fields" hidden>
            <label class="studio-field-block">Padre
              <select id="props-bone-parent" class="studio-input"></select>
            </label>
            <label class="studio-field-block">Rol
              <select id="props-bone-role" class="studio-input"></select>
            </label>
            <label class="studio-field-block">Eje
              <select id="props-bone-axis" class="studio-input"></select>
            </label>
          </div>
          <div id="props-pos-block" class="studio-vec3-block">
            <span class="studio-vec3-label">Pos</span>
            <div class="studio-vec3-row">
              <input type="number" id="props-pos-0" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-pos-1" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-pos-2" class="studio-input studio-num" step="0.01" />
            </div>
          </div>
          <div id="props-rot-block" class="studio-vec3-block">
            <span class="studio-vec3-label">Rot</span>
            <div class="studio-vec3-row">
              <input type="number" id="props-rot-0" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-rot-1" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-rot-2" class="studio-input studio-num" step="0.01" />
            </div>
          </div>
          <div id="props-scale-row" class="studio-vec3-block">
            <span class="studio-vec3-label">Scale</span>
            <div class="studio-vec3-row">
              <input type="number" id="props-scale-0" class="studio-input studio-num" step="0.01" min="0.01" />
              <input type="number" id="props-scale-1" class="studio-input studio-num" step="0.01" min="0.01" />
              <input type="number" id="props-scale-2" class="studio-input studio-num" step="0.01" min="0.01" />
            </div>
          </div>
          <div id="props-pivot-block" class="studio-vec3-block" hidden>
            <span class="studio-vec3-label">Pivote</span>
            <div class="studio-vec3-row">
              <input type="number" id="props-pivot-0" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-pivot-1" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-pivot-2" class="studio-input studio-num" step="0.01" />
            </div>
          </div>
          <div id="props-bone-rot-block" class="studio-vec3-block" hidden>
            <span class="studio-vec3-label">Rot bind</span>
            <div class="studio-vec3-row">
              <input type="number" id="props-bone-rot-0" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-bone-rot-1" class="studio-input studio-num" step="0.01" />
              <input type="number" id="props-bone-rot-2" class="studio-input studio-num" step="0.01" />
            </div>
          </div>
          <div class="studio-props-actions">
            <button type="button" id="btn-props-duplicate" class="studio-btn">Duplicar</button>
            <button type="button" id="btn-props-delete" class="studio-btn">Borrar</button>
          </div>
        </div>

        <details class="studio-details">
          <summary>Avanzado</summary>
          <h3>Importar modelo</h3>
          <textarea id="studio-import-doc" class="studio-textarea" rows="3" placeholder="Pegar JSON v2…"></textarea>
          <button type="button" id="btn-import-doc" class="studio-btn primary">Importar JSON v2</button>
          <h3>Exportar modelo</h3>
          <textarea id="studio-export-doc" class="studio-textarea" rows="4" readonly></textarea>
          <button type="button" id="btn-copy-doc" class="studio-btn">Copiar JSON v2</button>
          <button type="button" id="btn-export-bundle" class="studio-btn">Descargar JDD bundle</button>
        </details>
      </section>

      <section id="panel-anim" hidden>
        <p class="studio-hint">Timeline abajo · clic en pieza → hueso · gizmo rotación</p>
        <label class="studio-field-block">Hueso
          <select id="studio-bone" class="studio-input"></select>
        </label>
        <label class="studio-field-block">Rx <span id="studio-rx-label">0</span>
          <input type="range" id="studio-rx" min="-${ROT_SLIDER_MAX}" max="${ROT_SLIDER_MAX}" value="0" />
        </label>
        <label class="studio-field-block">Ry <span id="studio-ry-label">0</span>
          <input type="range" id="studio-ry" min="-${ROT_SLIDER_MAX}" max="${ROT_SLIDER_MAX}" value="0" />
        </label>
        <label class="studio-field-block">Rz <span id="studio-rz-label">0</span>
          <input type="range" id="studio-rz" min="-${ROT_SLIDER_MAX}" max="${ROT_SLIDER_MAX}" value="0" />
        </label>
        <h3>Importar clip</h3>
        <textarea id="studio-import-clip" class="studio-textarea" rows="4" placeholder="Pegar walk.json o clip v2…"></textarea>
        <button type="button" id="btn-import-clip" class="studio-btn primary">Importar clip</button>
        <h3>Exportar clip</h3>
        <textarea id="studio-export-clip" class="studio-textarea" rows="4" readonly></textarea>
        <button type="button" id="btn-copy-clip" class="studio-btn">Copiar clip activo</button>
      </section>

      <section>
        <h3>Vista</h3>
        <label class="studio-check"><input type="checkbox" id="studio-bones" checked /> Mostrar huesos (editor)</label>
      </section>
    `;

    document.body.appendChild(this.root);
    this.bindRefs();
    this.fillStaticSelects();
    this.bindEvents();
    this.seedExpandedBones();
    this.root.addEventListener(
      'keydown',
      (ev) => {
        const t = ev.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
          ev.stopPropagation();
        }
      },
      true,
    );
  }

  private bindRefs(): void {
    this.tabEdit = this.root.querySelector('#tab-edit') as HTMLButtonElement;
    this.tabAnim = this.root.querySelector('#tab-anim') as HTMLButtonElement;
    this.panelEdit = this.root.querySelector('#panel-edit') as HTMLElement;
    this.panelAnim = this.root.querySelector('#panel-anim') as HTMLElement;
    this.outliner = this.root.querySelector('#studio-outliner') as HTMLElement;
    this.boneSelect = this.root.querySelector('#studio-bone') as HTMLSelectElement;
    this.rotSliders = [
      this.root.querySelector('#studio-rx') as HTMLInputElement,
      this.root.querySelector('#studio-ry') as HTMLInputElement,
      this.root.querySelector('#studio-rz') as HTMLInputElement,
    ];
    this.rotLabels = [
      this.root.querySelector('#studio-rx-label') as HTMLElement,
      this.root.querySelector('#studio-ry-label') as HTMLElement,
      this.root.querySelector('#studio-rz-label') as HTMLElement,
    ];
    this.importDoc = this.root.querySelector('#studio-import-doc') as HTMLTextAreaElement;
    this.exportDoc = this.root.querySelector('#studio-export-doc') as HTMLTextAreaElement;
    this.exportClip = this.root.querySelector('#studio-export-clip') as HTMLTextAreaElement;
    this.importClip = this.root.querySelector('#studio-import-clip') as HTMLTextAreaElement;
    this.showBonesCheck = this.root.querySelector('#studio-bones') as HTMLInputElement;
    this.propsEmpty = this.root.querySelector('#props-empty') as HTMLElement;
    this.propsContent = this.root.querySelector('#props-content') as HTMLElement;
    this.propsKindLabel = this.root.querySelector('#props-kind') as HTMLElement;
    this.propsIdInput = this.root.querySelector('#props-id-input') as HTMLInputElement;
    this.propsElFields = this.root.querySelector('#props-el-fields') as HTMLElement;
    this.propsBoneFields = this.root.querySelector('#props-bone-fields') as HTMLElement;
    this.propsScaleRow = this.root.querySelector('#props-scale-row') as HTMLElement;
    this.gizmoBtns = {
      translate: this.root.querySelector('#gizmo-translate') as HTMLButtonElement,
      rotate: this.root.querySelector('#gizmo-rotate') as HTMLButtonElement,
      scale: this.root.querySelector('#gizmo-scale') as HTMLButtonElement,
    };
    this.propsElBone = this.root.querySelector('#props-el-bone') as HTMLSelectElement;
    this.propsElShape = this.root.querySelector('#props-el-shape') as HTMLSelectElement;
    this.propsElLayer = this.root.querySelector('#props-el-layer') as HTMLSelectElement;
    this.propsBoneParent = this.root.querySelector('#props-bone-parent') as HTMLSelectElement;
    this.propsBoneRole = this.root.querySelector('#props-bone-role') as HTMLSelectElement;
    this.propsBoneAxis = this.root.querySelector('#props-bone-axis') as HTMLSelectElement;
    this.propsDelBtn = this.root.querySelector('#btn-props-delete') as HTMLButtonElement;
    this.propsPosBlock = this.root.querySelector('#props-pos-block') as HTMLElement;
    this.propsRotBlock = this.root.querySelector('#props-rot-block') as HTMLElement;
    this.propsPivotBlock = this.root.querySelector('#props-pivot-block') as HTMLElement;
    this.propsBoneRotBlock = this.root.querySelector('#props-bone-rot-block') as HTMLElement;
    this.propsPosInputs = [
      this.root.querySelector('#props-pos-0') as HTMLInputElement,
      this.root.querySelector('#props-pos-1') as HTMLInputElement,
      this.root.querySelector('#props-pos-2') as HTMLInputElement,
    ];
    this.propsRotInputs = [
      this.root.querySelector('#props-rot-0') as HTMLInputElement,
      this.root.querySelector('#props-rot-1') as HTMLInputElement,
      this.root.querySelector('#props-rot-2') as HTMLInputElement,
    ];
    this.propsScaleInputs = [
      this.root.querySelector('#props-scale-0') as HTMLInputElement,
      this.root.querySelector('#props-scale-1') as HTMLInputElement,
      this.root.querySelector('#props-scale-2') as HTMLInputElement,
    ];
    this.propsPivotInputs = [
      this.root.querySelector('#props-pivot-0') as HTMLInputElement,
      this.root.querySelector('#props-pivot-1') as HTMLInputElement,
      this.root.querySelector('#props-pivot-2') as HTMLInputElement,
    ];
    this.propsBoneRotInputs = [
      this.root.querySelector('#props-bone-rot-0') as HTMLInputElement,
      this.root.querySelector('#props-bone-rot-1') as HTMLInputElement,
      this.root.querySelector('#props-bone-rot-2') as HTMLInputElement,
    ];
  }

  private fillStaticSelects(): void {
    for (const s of SHAPES) this.propsElShape.appendChild(new Option(s, s));
    for (const l of LAYERS) this.propsElLayer.appendChild(new Option(l, l));
    for (const r of ROLES) this.propsBoneRole.appendChild(new Option(r, r));
    for (const a of AXES) this.propsBoneAxis.appendChild(new Option(a, a));
  }

  private seedExpandedBones(): void {
    for (const b of this.cb.getDoc().bones) this.expandedBones.add(b.id);
  }

  private bindEvents(): void {
    this.tabEdit.addEventListener('click', () => this.switchMode('edit'));
    this.tabAnim.addEventListener('click', () => this.switchMode('animate'));

    this.showBonesCheck.addEventListener('change', () => {
      this.showBones = this.showBonesCheck.checked;
      this.cb.setShowBones(this.showBones);
    });

    this.boneSelect.addEventListener('change', () => this.selectBone(this.boneSelect.value || null));

    for (let i = 0; i < 3; i++) {
      this.rotSliders[i]!.addEventListener('input', () => this.applyRotFromSliders());
    }

    for (const mode of ['translate', 'rotate', 'scale'] as GizmoMode[]) {
      this.gizmoBtns[mode].addEventListener('click', () => {
        this.cb.setGizmoMode(mode);
        this.syncGizmoModeUi();
        this.cb.onEditChange();
      });
    }

    this.root.querySelector('#btn-add-element')?.addEventListener('click', () => this.addElementQuick());
    this.root.querySelector('#btn-add-bone')?.addEventListener('click', () => this.addBoneQuick());

    this.outliner.addEventListener('click', (ev) => this.onOutlinerClick(ev));

    this.propsElBone.addEventListener('change', () => this.applyElementMeta());
    this.propsElShape.addEventListener('change', () => this.applyElementMeta());
    this.propsElLayer.addEventListener('change', () => this.applyElementMeta());

    this.propsBoneParent.addEventListener('change', () => this.applyBoneMeta());
    this.propsBoneRole.addEventListener('change', () => this.applyBoneMeta());
    this.propsBoneAxis.addEventListener('change', () => this.applyBoneMeta());

    for (const input of [
      ...this.propsPosInputs,
      ...this.propsRotInputs,
      ...this.propsScaleInputs,
      ...this.propsPivotInputs,
      ...this.propsBoneRotInputs,
    ]) {
      input.addEventListener('change', () => this.applyTransformFromInputs());
    }

    this.root.querySelector('#btn-props-duplicate')?.addEventListener('click', () => {
      this.cb.onDuplicateSelection();
    });
    this.root.querySelector('#btn-props-delete')?.addEventListener('click', () => {
      this.cb.onDeleteSelection();
    });

    this.propsIdInput.addEventListener('change', () => this.applyRename());
    this.propsIdInput.addEventListener('blur', () => this.applyRename());
    this.propsIdInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.applyRename();
        this.propsIdInput.blur();
      }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        const sel = this.cb.getSelection();
        if (sel) this.propsIdInput.value = sel.id;
        this.propsIdInput.blur();
      }
    });

    this.root.querySelector('#btn-import-doc')?.addEventListener('click', () => {
      try {
        const next = documentFromJson(this.importDoc.value.trim());
        this.cb.reloadDocument(next);
        this.selectedBoneId = null;
        this.cb.setSelection(null);
        this.cb.setPlaying(false);
        this.cb.setTime(0);
        this.seedExpandedBones();
        this.refresh();
        this.cb.onStatus(`Importado: ${next.label} · ${next.elements.length} elementos`);
      } catch (err) {
        this.cb.onStatus(err instanceof Error ? err.message : String(err));
      }
    });

    this.root.querySelector('#btn-copy-doc')?.addEventListener('click', async () => {
      const ok = await copyToClipboard(documentToJson(this.cb.getDoc()));
      this.cb.onStatus(ok ? 'JSON v2 copiado' : 'Error al copiar');
    });

    this.root.querySelector('#btn-export-bundle')?.addEventListener('click', () => {
      downloadJddBundle(this.cb.getDoc(), this.cb.getStore().library);
      this.cb.onStatus('Bundle JDD descargado');
    });

    this.root.querySelector('#btn-import-clip')?.addEventListener('click', () => {
      try {
        const clip = clipFromJson(this.importClip.value.trim());
        const { skippedBones } = this.cb.getStore().importClip(clip);
        this.cb.setPlaying(false);
        this.cb.setTime(0);
        this.cb.applyClipAtTime();
        this.refresh();
        this.cb.onClipImported();
        const skipMsg = skippedBones.length > 0 ? ` · ${skippedBones.length} huesos omitidos` : '';
        this.cb.onStatus(`Clip importado: ${clip.id} · ${clip.tracks.length} pistas${skipMsg}`);
      } catch (err) {
        this.cb.onStatus(err instanceof Error ? err.message : String(err));
      }
    });

    this.root.querySelector('#btn-copy-clip')?.addEventListener('click', async () => {
      const ok = await copyToClipboard(clipToJson(this.cb.getStore().activeClip));
      this.cb.onStatus(ok ? 'Clip copiado' : 'Error al copiar');
    });
  }

  private defaultBoneForAdd(): string {
    const sel = this.cb.getSelection();
    const doc = this.cb.getDoc();
    if (sel?.kind === 'bone') return sel.id;
    if (sel?.kind === 'element') {
      const el = findElement(doc, sel.id);
      if (el) return el.boneId;
    }
    return doc.bones.find((b) => b.id === 'cintura')?.id ?? doc.bones[0]?.id ?? 'controller';
  }

  private defaultParentForAdd(): string | null {
    const sel = this.cb.getSelection();
    if (sel?.kind === 'bone') return sel.id;
    if (sel?.kind === 'element') {
      const el = findElement(this.cb.getDoc(), sel.id);
      if (el) return el.boneId;
    }
    return docHasBone(this.cb.getDoc(), 'controller') ? 'controller' : null;
  }

  private applyRename(): void {
    const sel = this.cb.getSelection();
    if (!sel) return;
    const nextId = this.propsIdInput.value.trim();
    if (!nextId || nextId === sel.id) {
      this.propsIdInput.value = sel.id;
      return;
    }
    this.cb.onRenameSelection(nextId);
  }

  private syncPropsIdInput(sel: EditSelection): void {
    const key = `${sel.kind}:${sel.id}`;
    if (key === this.propsSelKey && document.activeElement === this.propsIdInput) return;
    this.propsSelKey = key;
    this.propsIdInput.value = sel.id;
    const locked = sel.kind === 'bone' && sel.id === 'controller';
    this.propsIdInput.disabled = locked;
    this.propsIdInput.title = locked ? 'controller no se puede renombrar' : '';
  }

  private transferExpandedBone(oldId: string, newId: string): void {
    if (this.expandedBones.has(oldId)) {
      this.expandedBones.delete(oldId);
      this.expandedBones.add(newId);
    }
  }

  /** Llamar tras renombrar desde fuera (p. ej. bootstrap). */
  notifyRenamed(oldId: string, newId: string, kind: EditSelection['kind']): void {
    if (kind === 'bone') this.transferExpandedBone(oldId, newId);
    this.propsSelKey = `${kind}:${newId}`;
    this.propsIdInput.value = newId;
  }

  private addElementQuick(): void {
    try {
      let newId = '';
      const boneId = this.defaultBoneForAdd();
      this.cb.mutateDocument((doc) => {
        const el = addElement(doc, { boneId, shape: 'box', layer: 'flesh' });
        newId = el.id;
      });
      this.selectFromUi({ kind: 'element', id: newId });
      this.cb.onStatus(`Pieza agregada: ${newId}`);
    } catch (err) {
      this.cb.onStatus(err instanceof Error ? err.message : String(err));
    }
  }

  private addBoneQuick(): void {
    try {
      let newId = '';
      const parentId = this.defaultParentForAdd();
      this.cb.mutateDocument((doc) => {
        const bone = addBone(doc, { parentId, role: 'hip', axis: 'y' });
        newId = bone.id;
      });
      this.expandedBones.add(newId);
      if (parentId) this.expandedBones.add(parentId);
      this.selectFromUi({ kind: 'bone', id: newId });
      this.cb.onStatus(`Hueso agregado: ${newId}`);
    } catch (err) {
      this.cb.onStatus(err instanceof Error ? err.message : String(err));
    }
  }

  private selectFromUi(sel: EditSelection): void {
    this.cb.setSelection(sel);
    this.ensureExpandedForSelection(sel);
    this.syncPropertiesPanel();
    this.syncGizmoModeUi();
    this.renderOutliner();
    this.cb.onEditChange();
  }

  private onOutlinerClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    const toggle = target.closest('[data-toggle-bone]') as HTMLElement | null;
    if (toggle) {
      ev.stopPropagation();
      const boneId = toggle.dataset.toggleBone;
      if (!boneId) return;
      if (this.expandedBones.has(boneId)) this.expandedBones.delete(boneId);
      else this.expandedBones.add(boneId);
      this.renderOutliner();
      return;
    }

    const row = target.closest('[data-kind][data-id]') as HTMLElement | null;
    if (!row) return;
    const kind = row.dataset.kind as 'bone' | 'element';
    const id = row.dataset.id;
    if (!id || (kind !== 'bone' && kind !== 'element')) return;
    this.selectFromUi({ kind, id });
  }

  private ensureExpandedForSelection(sel: EditSelection): void {
    const doc = this.cb.getDoc();
    const boneId = sel.kind === 'bone' ? sel.id : findElement(doc, sel.id)?.boneId;
    if (!boneId) return;
    this.expandedBones.add(boneId);
    for (const a of boneAncestors(doc, boneId)) this.expandedBones.add(a);
  }

  private renderOutliner(): void {
    const doc = this.cb.getDoc();
    const sel = this.cb.getSelection();
    const parts: string[] = [];
    const renderBone = (bone: StudioBone, depth: number): void => {
      const childBones = boneChildren(doc, bone.id);
      const elements = doc.elements.filter((e) => e.boneId === bone.id).sort((a, b) => a.id.localeCompare(b.id));
      const hasKids = childBones.length > 0 || elements.length > 0;
      const expanded = this.expandedBones.has(bone.id);
      const active = sel?.kind === 'bone' && sel.id === bone.id;
      const pad = depth * 14;
      const toggle = hasKids
        ? `<button type="button" class="studio-tree-toggle" data-toggle-bone="${bone.id}" aria-label="Expandir">${expanded ? '▼' : '▶'}</button>`
        : `<span class="studio-tree-toggle studio-tree-spacer"></span>`;
      parts.push(
        `<button type="button" class="studio-tree-row studio-tree-bone${active ? ' active' : ''}" data-kind="bone" data-id="${bone.id}" style="--depth:${pad}px">${toggle}<span class="studio-tree-icon">◎</span><span class="studio-tree-label">${bone.id}</span></button>`,
      );
      if (!expanded) return;
      for (const el of elements) {
        const elActive = sel?.kind === 'element' && sel.id === el.id;
        parts.push(
          `<button type="button" class="studio-tree-row studio-tree-element${elActive ? ' active' : ''}" data-kind="element" data-id="${el.id}" style="--depth:${pad + 14}px"><span class="studio-tree-toggle studio-tree-spacer"></span><span class="studio-tree-icon">◆</span><span class="studio-tree-label">${el.id}</span><span class="studio-tree-meta">${el.shape}</span></button>`,
        );
      }
      for (const child of childBones) renderBone(child, depth + 1);
    };

    for (const root of boneChildren(doc, null)) renderBone(root, 0);
    this.outliner.innerHTML = parts.join('');

    const activeRow = this.outliner.querySelector('.studio-tree-row.active');
    activeRow?.scrollIntoView({ block: 'nearest' });
  }

  private isPropsFieldFocused(): boolean {
    const el = document.activeElement;
    return !!el && this.propsContent.contains(el);
  }

  private setVec3Inputs(inputs: [HTMLInputElement, HTMLInputElement, HTMLInputElement], v: Vec3): void {
    this.suppressPropsSync = true;
    for (let i = 0; i < 3; i++) inputs[i]!.value = fmtNum(v[i]!);
    this.suppressPropsSync = false;
  }

  private readVec3(inputs: [HTMLInputElement, HTMLInputElement, HTMLInputElement]): Vec3 | null {
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const n = parseNum(inputs[i]!.value);
      if (n === null) return null;
      out.push(n);
    }
    return out as Vec3;
  }

  private syncPropertiesPanel(): void {
    const sel = this.cb.getSelection();
    const hasSel = !!sel;
    this.propsEmpty.hidden = hasSel;
    this.propsContent.hidden = !hasSel;
    if (!sel) {
      this.propsSelKey = '';
      return;
    }

    const doc = this.cb.getDoc();
    const skipNums = this.isPropsFieldFocused();

    if (sel.kind === 'element') {
      const el = findElement(doc, sel.id);
      if (!el) return;
      this.propsKindLabel.textContent = 'Pieza';
      this.syncPropsIdInput(sel);
      this.propsElFields.hidden = false;
      this.propsBoneFields.hidden = true;
      this.propsPosBlock.hidden = false;
      this.propsRotBlock.hidden = false;
      this.propsScaleRow.hidden = false;
      this.propsPivotBlock.hidden = true;
      this.propsBoneRotBlock.hidden = true;

      this.fillBoneSelect(this.propsElBone, false);
      this.propsElBone.value = el.boneId;
      this.propsElShape.value = el.shape;
      this.propsElLayer.value = el.layer;
      this.propsDelBtn.disabled = false;
      this.propsDelBtn.title = '';

      if (!skipNums) {
        this.setVec3Inputs(this.propsPosInputs, el.pos);
        this.setVec3Inputs(this.propsRotInputs, el.rot);
        this.setVec3Inputs(this.propsScaleInputs, el.scale);
      }
      return;
    }

    const bone = findBone(doc, sel.id);
    if (!bone) return;
    this.propsKindLabel.textContent = 'Hueso';
    this.syncPropsIdInput(sel);
    this.propsElFields.hidden = true;
    this.propsBoneFields.hidden = false;
    this.propsPosBlock.hidden = true;
    this.propsRotBlock.hidden = true;
    this.propsScaleRow.hidden = true;
    this.propsPivotBlock.hidden = false;
    this.propsBoneRotBlock.hidden = false;

    this.fillBoneSelect(this.propsBoneParent, true, bone.id);
    this.propsBoneParent.value = bone.parentId ?? '';
    this.propsBoneRole.value = bone.role;
    this.propsBoneAxis.value = bone.axis;
    const reason = canDeleteBone(doc, bone.id);
    this.propsDelBtn.disabled = reason !== null;
    this.propsDelBtn.title = reason ?? '';

    if (!skipNums) {
      this.setVec3Inputs(this.propsPivotInputs, bone.pivot);
      this.setVec3Inputs(this.propsBoneRotInputs, bone.rot ?? [0, 0, 0]);
    }
  }

  private applyElementMeta(): void {
    const sel = this.cb.getSelection();
    if (!sel || sel.kind !== 'element') return;
    this.cb.mutateDocument((doc) => {
      updateElement(doc, sel.id, {
        boneId: this.propsElBone.value,
        shape: this.propsElShape.value as ElementShape,
        layer: this.propsElLayer.value as ElementLayer,
      });
    });
    this.refresh();
    this.cb.onEditChange();
  }

  private applyBoneMeta(): void {
    const sel = this.cb.getSelection();
    if (!sel || sel.kind !== 'bone') return;
    try {
      const parentVal = this.propsBoneParent.value;
      this.cb.mutateDocument((doc) => {
        reparentBone(doc, sel.id, parentVal === '' ? null : parentVal);
        updateBone(doc, sel.id, {
          role: this.propsBoneRole.value as BoneRole,
          axis: this.propsBoneAxis.value as BoneAxis,
        });
      });
      this.refresh();
      this.cb.onEditChange();
    } catch (err) {
      this.cb.onStatus(err instanceof Error ? err.message : String(err));
      this.syncPropertiesPanel();
    }
  }

  private applyTransformFromInputs(): void {
    if (this.suppressPropsSync) return;
    const sel = this.cb.getSelection();
    if (!sel) return;

    if (sel.kind === 'element') {
      const el = findElement(this.cb.getDoc(), sel.id);
      if (!el) return;
      const pos = this.readVec3(this.propsPosInputs);
      const rot = this.readVec3(this.propsRotInputs);
      const scale = this.readVec3(this.propsScaleInputs);
      if (!pos || !rot || !scale) return;
      if (scale.some((s) => s <= 0)) {
        this.cb.onStatus('Scale debe ser > 0');
        this.syncPropertiesPanel();
        return;
      }
      this.cb.mutateDocument((doc) => updateElement(doc, sel.id, { pos, rot, scale }));
      this.renderOutliner();
      this.cb.onEditChange();
      return;
    }

    const bone = findBone(this.cb.getDoc(), sel.id);
    if (!bone) return;
    const pivot = this.readVec3(this.propsPivotInputs);
    const rot = this.readVec3(this.propsBoneRotInputs);
    if (!pivot || !rot) return;
    this.cb.mutateDocument((doc) => updateBone(doc, sel.id, { pivot, rot }));
    this.cb.onEditChange();
  }

  setEditSelection(sel: EditSelection | null): void {
    this.cb.setSelection(sel);
    if (sel) this.ensureExpandedForSelection(sel);
    this.syncPropertiesPanel();
    this.syncGizmoModeUi();
    this.renderOutliner();
  }

  selectBone(boneId: string | null): void {
    this.selectedBoneId = boneId;
    if (boneId) this.boneSelect.value = boneId;
    this.cb.onBoneSelect(boneId);
    this.syncRotUi();
  }

  private applyRotFromSliders(): void {
    const boneId = this.selectedBoneId;
    if (!boneId) return;
    const rot: Vec3 = this.rotSliders.map((s) => parseInt(s.value, 10) / 100) as Vec3;
    this.cb.onRotChange(boneId, rot);
    this.updateRotLabels(rot);
  }

  switchMode(mode: StudioMode): void {
    this.cb.setMode(mode);
    this.tabEdit.classList.toggle('active', mode === 'edit');
    this.tabAnim.classList.toggle('active', mode === 'animate');
    this.panelEdit.hidden = mode !== 'edit';
    this.panelAnim.hidden = mode !== 'animate';
    this.showBones = mode === 'edit' ? this.showBonesCheck.checked : false;
    this.cb.setShowBones(this.showBones);
    if (mode === 'edit') this.cb.onEditChange();
  }

  private syncGizmoModeUi(): void {
    const mode = this.cb.getGizmoMode();
    for (const m of ['translate', 'rotate', 'scale'] as GizmoMode[]) {
      this.gizmoBtns[m].classList.toggle('active', m === mode);
    }
  }

  private fillBoneSelect(select: HTMLSelectElement, includeEmpty: boolean, excludeId?: string): void {
    const doc = this.cb.getDoc();
    select.innerHTML = '';
    if (includeEmpty) select.appendChild(new Option('(ninguno)', ''));
    for (const b of doc.bones) {
      if (excludeId && b.id === excludeId) continue;
      select.appendChild(new Option(b.id, b.id));
    }
  }

  refresh(): void {
    const doc = this.cb.getDoc();
    const store = this.cb.getStore();
    const summary = this.root.querySelector('#studio-doc-summary') as HTMLElement;
    summary.textContent = `${doc.label} · ${doc.bones.length} huesos · ${doc.elements.length} piezas`;

    this.exportDoc.value = documentToJson(doc);
    this.exportClip.value = clipToJson(store.activeClip);

    this.boneSelect.innerHTML = '';
    for (const b of doc.bones) {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.id} (${b.role})`;
      this.boneSelect.appendChild(opt);
    }
    if (!this.selectedBoneId) this.selectedBoneId = store.selectedBoneId;
    if (this.selectedBoneId) this.boneSelect.value = this.selectedBoneId;

    this.renderOutliner();
    this.syncPropertiesPanel();
    this.syncGizmoModeUi();
    this.syncRotUi();
  }

  syncRotUi(): void {
    const boneId = this.selectedBoneId ?? this.cb.getStore().selectedBoneId;
    if (!boneId) return;
    const rot = this.cb.getPose().getBoneRot(boneId);
    for (let i = 0; i < 3; i++) {
      this.rotSliders[i]!.value = String(Math.round(rot[i]! * 100));
    }
    this.updateRotLabels(rot);
  }

  private updateRotLabels(rot: Vec3): void {
    const axes = ['rx', 'ry', 'rz'] as const;
    for (let i = 0; i < 3; i++) {
      this.rotLabels[i]!.textContent = `${rot[i]!.toFixed(2)} rad (${axes[i]})`;
    }
  }

  dispose(): void {
    this.root.remove();
  }
}

function docHasBone(doc: StudioDocument, id: string): boolean {
  return doc.bones.some((b) => b.id === id);
}
