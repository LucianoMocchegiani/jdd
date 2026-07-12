/**
 * Bootstrap de Character Studio — una app con pestañas Editar / Animar.
 *
 * @module character-studio/bootstrap
 */

import { computePlanarVelocityFromInput } from '@/game/camera/movement-relative';
import { isKeyHeld, isTextInputFocused } from '@/game/input/keyboard-state';
import { StudioAnimStore } from '@/poc/character-studio/studio-anim-store';
import { buildRig, SkeletonPose } from '@/poc/character-studio/rig-math';
import { defaultBipedDocument } from '@/poc/character-studio/studio-document';
import { copyToClipboard } from '@/poc/character-studio/clipboard';
import { documentToJson } from '@/poc/character-studio/studio-document';
import {
  applyBindPoseToSkeleton,
  duplicateElement,
  duplicateBone,
  findBone,
  findElement,
  removeBone,
  removeElement,
  renameBone,
  renameElement,
  updateBone,
  updateElement,
  type EditSelection,
  type GizmoMode,
} from '@/poc/character-studio/studio-document-ops';
import { StudioDocumentHistory } from '@/poc/character-studio/studio-history';
import { attachStudioKeyboard } from '@/poc/character-studio/studio-keyboard';
import { StudioEditGizmo } from '@/poc/character-studio/studio-edit-gizmo';
import { sampleClip } from '@/poc/character-studio/studio-clip';
import { StudioBoneGizmo } from '@/poc/character-studio/studio-gizmo';
import {
  pickBoneFromPointer,
  pickBoneSphereFromPointer,
  pickElementFromPointer,
} from '@/poc/character-studio/studio-pick';
import { StudioRenderer } from '@/poc/character-studio/studio-renderer';
import { StudioTimeline, STUDIO_PANEL_W, TIMELINE_HEIGHT } from '@/poc/character-studio/studio-timeline';
import { StudioUi } from '@/poc/character-studio/studio-ui';
import type { StudioDocument, StudioMode } from '@/poc/character-studio/types';
import { StudioOrbitCamera } from '@/poc/character-studio/studio-orbit-camera';
import { DEFAULT_PALETTE } from '@/poc/shared';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

const CELL_SIZE = 1;
const MOVE_SPEED = 4;

export function bootstrapCharacterStudioPoc(
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  statusEl: HTMLElement,
): () => void {
  try {
    return runBootstrap(scene, camera, renderer, statusEl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    statusEl.textContent = `Character Studio — error: ${msg}`;
    statusEl.dataset.state = 'warn';
    console.error('[character-studio]', err);
    return () => {};
  }
}

function runBootstrap(
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  statusEl: HTMLElement,
): () => void {
  scene.background = new Color(0x0a0a12);

  const fill = new AmbientLight(0xb8c8e8, 0.55);
  scene.add(fill);
  const key = new DirectionalLight(0xfff4e8, 1.1);
  key.position.set(6, 14, 10);
  scene.add(key);

  const grid = new GridHelper(24, 24, 0x333355, 0x222233);
  grid.position.set(8, 0, 8);
  scene.add(grid);

  let doc: StudioDocument = structuredClone(defaultBipedDocument());
  let rig = buildRig(doc);
  let pose = new SkeletonPose(rig, doc);
  const animStore = new StudioAnimStore({ doc });
  let mode: StudioMode = 'edit';
  let showBones = true;
  let playing = false;
  let time = 0;
  let selection: EditSelection | null = null;
  let gizmoMode: GizmoMode = 'translate';
  const docHistory = new StudioDocumentHistory(doc);

  const setStatus = (msg: string): void => {
    statusEl.textContent = msg;
    delete statusEl.dataset.state;
  };

  const pruneSelection = (): void => {
    if (!selection) return;
    const sel = selection;
    if (sel.kind === 'element' && !findElement(doc, sel.id)) selection = null;
    if (sel.kind === 'bone' && !findBone(doc, sel.id)) selection = null;
  };

  const refreshRig = (): void => {
    rig = buildRig(doc);
    pose = new SkeletonPose(rig, doc);
    applyBindPose();
  };

  const restoreDoc = (next: StudioDocument): void => {
    doc = structuredClone(next);
    pruneSelection();
    refreshRig();
    ui.refresh();
    editGizmo.sync();
  };

  const applyDocMutation = (fn: (d: StudioDocument) => void, recordHistory = true): void => {
    fn(doc);
    refreshRig();
    if (recordHistory) docHistory.commit(doc);
  };

  let x = 8;
  let y = 8;
  let z = 1;
  let yaw = 0;

  const charWorld = new Matrix4();
  const yawQuat = new Quaternion();
  const charPos = new Vector3();
  const _selPos = new Vector3();
  const _selQuat = new Quaternion();
  const _selScale = new Vector3();

  const updateCharWorld = (): void => {
    yawQuat.setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    charPos.set(x * CELL_SIZE, z * CELL_SIZE, y * CELL_SIZE);
    charWorld.compose(charPos, yawQuat, new Vector3(1, 1, 1));
  };

  const applyBindPose = (): void => {
    applyBindPoseToSkeleton(doc, (id, rot) => pose.setBoneRot(id, rot));
  };

  const applyClipAtTime = (): void => {
    const clip = animStore.activeClip;
    pose.setBoneRots(sampleClip(clip, time, doc.bones));
  };

  const getSelectionWorldPoint = (): Vector3 | null => {
    if (!selection) return null;
    updateCharWorld();
    if (selection.kind === 'element') {
      const el = findElement(doc, selection.id);
      if (!el) return null;
      pose.elementWorldMatrix(el).clone().premultiply(charWorld).decompose(_selPos, _selQuat, _selScale);
      return _selPos;
    }
    const bone = findBone(doc, selection.id);
    if (!bone) return null;
    pose.boneWorldMatrix(bone.id).clone().premultiply(charWorld).decompose(_selPos, _selQuat, _selScale);
    return _selPos;
  };

  applyBindPose();

  const orbitCam = new StudioOrbitCamera(renderer.domElement);
  orbitCam.bindCamera(camera);
  const bodyRenderer = new StudioRenderer(scene, CELL_SIZE, DEFAULT_PALETTE);

  let ui!: StudioUi;
  let timeline!: StudioTimeline;
  let gizmo!: StudioBoneGizmo;
  let editGizmo!: StudioEditGizmo;

  const refreshEditUi = (): void => {
    ui.refresh();
    editGizmo.sync();
  };

  const applyGizmoMode = (m: GizmoMode): void => {
    gizmoMode = m;
    editGizmo.setMode(m);
    ui.refresh();
  };

  const duplicateSelection = (): void => {
    if (mode !== 'edit' || !selection) return;
    let newId = '';
    try {
      applyDocMutation((d) => {
        if (selection!.kind === 'element') newId = duplicateElement(d, selection!.id).id;
        else newId = duplicateBone(d, selection!.id).id;
      });
      selection = selection.kind === 'element'
        ? { kind: 'element', id: newId }
        : { kind: 'bone', id: newId };
      ui.setEditSelection(selection);
      refreshEditUi();
      setStatus(`Duplicado: ${newId}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteSelection = (): void => {
    if (mode !== 'edit' || !selection) return;
    try {
      const id = selection.id;
      applyDocMutation((d) => {
        if (selection!.kind === 'element') removeElement(d, id);
        else removeBone(d, id);
      });
      selection = null;
      ui.setEditSelection(null);
      refreshEditUi();
      setStatus('Borrado');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const renameSelection = (newId: string): void => {
    if (mode !== 'edit' || !selection) return;
    const oldId = selection.id;
    const kind = selection.kind;
    try {
      applyDocMutation((d) => {
        if (kind === 'element') renameElement(d, oldId, newId);
        else renameBone(d, oldId, newId);
      });
      const trimmed = newId.trim();
      if (kind === 'bone') {
        animStore.renameBone(oldId, trimmed);
        if (animStore.selectedBoneId === oldId) ui.selectBone(trimmed);
      }
      selection = { kind, id: trimmed };
      ui.notifyRenamed(oldId, trimmed, kind);
      ui.setEditSelection(selection);
      refreshEditUi();
      timeline.refresh();
      setStatus(`Renombrado: ${oldId} → ${trimmed}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      ui.setEditSelection(selection);
    }
  };

  ui = new StudioUi({
    getDoc: () => doc,
    getPose: () => pose,
    getStore: () => animStore,
    getMode: () => mode,
    setMode: (m) => {
      mode = m;
      const check = ui.root.querySelector<HTMLInputElement>('#studio-bones');
      showBones = m === 'edit' ? (check?.checked ?? true) : false;
      if (m === 'edit') {
        playing = false;
        applyBindPose();
      } else {
        applyClipAtTime();
      }
    },
    getShowBones: () => showBones,
    setShowBones: (v) => {
      showBones = v;
    },
    getPlaying: () => playing,
    setPlaying: (v) => {
      playing = v;
    },
    getTime: () => time,
    setTime: (t) => {
      time = t;
    },
    applyClipAtTime,
    reloadDocument: (next) => {
      doc = structuredClone(next);
      docHistory.reset(doc);
      selection = null;
      refreshRig();
      animStore.reloadDocument(doc);
      time = 0;
      playing = false;
      applyClipAtTime();
      timeline.refresh();
      ui.refresh();
      editGizmo.sync();
    },
    getSelection: () => selection,
    setSelection: (sel) => {
      selection = sel;
    },
    getGizmoMode: () => gizmoMode,
    setGizmoMode: applyGizmoMode,
    mutateDocument: (fn) => applyDocMutation(fn, true),
    onStatus: setStatus,
    onBoneSelect: (boneId) => {
      animStore.selectBone(boneId);
      timeline.refresh();
      ui.syncRotUi();
    },
    onRotChange: (boneId, rot) => {
      animStore.setBoneRot(pose, boneId, rot, time);
      ui.syncRotUi();
      timeline.refreshKeyframes();
      timeline.syncTimeUi();
    },
    onClipImported: () => {
      timeline.refresh();
      ui.syncRotUi();
    },
    onEditChange: () => {
      ui.refresh();
      editGizmo.sync();
    },
    onDuplicateSelection: duplicateSelection,
    onDeleteSelection: deleteSelection,
    onRenameSelection: renameSelection,
  });

  timeline = new StudioTimeline({
    getClip: () => animStore.activeClip,
    getStore: () => animStore,
    getPose: () => pose,
    getPlaying: () => playing,
    setPlaying: (v) => {
      playing = v;
    },
    getTime: () => time,
    setTime: (t) => {
      time = t;
    },
    applyClipAtTime,
    onClipChange: () => ui.refresh(),
    onKeyframeSaved: () => ui.refresh(),
    onStatus: setStatus,
  });

  gizmo = new StudioBoneGizmo(scene, camera, renderer, {
    getSelectedBoneId: () => animStore.selectedBoneId,
    getBone: (id) => doc.bones.find((b) => b.id === id),
    getPose: () => pose,
    getCharWorld: () => {
      updateCharWorld();
      return charWorld;
    },
    onRotChange: (boneId, rot) => {
      animStore.setBoneRot(pose, boneId, rot, time);
      ui.syncRotUi();
      timeline.refreshKeyframes();
    },
    isEnabled: () => mode === 'animate',
  });

  editGizmo = new StudioEditGizmo(scene, camera, renderer, {
    getSelection: () => selection,
    getGizmoMode: () => gizmoMode,
    getDoc: () => doc,
    getPose: () => pose,
    getCharWorld: () => {
      updateCharWorld();
      return charWorld;
    },
    isEnabled: () => mode === 'edit',
    onElementChange: (id, patch) => {
      applyDocMutation((d) => updateElement(d, id, patch), false);
      ui.refresh();
      editGizmo.sync();
    },
    onBonePivotChange: (id, pivot) => {
      applyDocMutation((d) => updateBone(d, id, { pivot }), false);
      ui.refresh();
      editGizmo.sync();
    },
    onBoneRotChange: (id, rot) => {
      applyDocMutation((d) => updateBone(d, id, { rot }), false);
      ui.refresh();
      editGizmo.sync();
    },
    onDragEnd: () => {
      docHistory.commit(doc);
    },
  });
  editGizmo.setMode(gizmoMode);

  ui.refresh();
  timeline.refresh();

  const canvas = renderer.domElement;
  canvas.classList.add('character-studio-canvas');

  const onPointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest('#character-studio-timeline')) return;
    if ((ev.target as HTMLElement).closest('#character-studio-panel')) return;
    updateCharWorld();

    if (mode === 'edit') {
      if (showBones) {
        const boneId = pickBoneSphereFromPointer(ev, camera, renderer, bodyRenderer.getBonePickMesh());
        if (boneId) {
          selection = { kind: 'bone', id: boneId };
          ui.setEditSelection(selection);
          editGizmo.sync();
          return;
        }
      }
      const elementId = pickElementFromPointer(ev, camera, renderer, doc, bodyRenderer.getPickMeshes());
      if (elementId) {
        selection = { kind: 'element', id: elementId };
        ui.setEditSelection(selection);
        editGizmo.sync();
      }
      return;
    }

    const boneId = pickBoneFromPointer(ev, camera, renderer, doc, charWorld, bodyRenderer.getPickMeshes());
    if (boneId) {
      animStore.selectBone(boneId);
      ui.selectBone(boneId);
      timeline.refresh();
    }
  };
  canvas.addEventListener('pointerdown', onPointerDown);

  const detachKeyboard = attachStudioKeyboard({
    isTyping: isTextInputFocused,
    getMode: () => mode,
    onUndo: () => {
      if (mode !== 'edit') return;
      const prev = docHistory.undo();
      if (prev) {
        restoreDoc(prev);
        setStatus('Deshacer');
      }
    },
    onRedo: () => {
      if (mode !== 'edit') return;
      const next = docHistory.redo();
      if (next) {
        restoreDoc(next);
        setStatus('Rehacer');
      }
    },
    onDeleteSelection: deleteSelection,
    onDuplicateSelection: duplicateSelection,
    onDeselect: () => {
      if (mode !== 'edit') return;
      selection = null;
      ui.setEditSelection(null);
      editGizmo.sync();
    },
    onGizmoMode: (m) => {
      if (mode !== 'edit') return;
      applyGizmoMode(m);
    },
    onSaveCopy: () => {
      void copyToClipboard(documentToJson(doc)).then((ok) => {
        setStatus(ok ? 'JSON copiado (Ctrl+S)' : 'Error al copiar');
      });
    },
    onTogglePlay: () => {
      if (mode !== 'animate') return;
      playing = !playing;
      timeline.refresh();
      setStatus(playing ? 'Reproduciendo' : 'Pausa');
    },
    onFocusSelection: () => {
      const wp = getSelectionWorldPoint();
      if (wp) {
        orbitCam.focusWorldPoint(wp);
        setStatus('Enfocado');
      } else {
        orbitCam.resetFocus();
        setStatus('Vista al torso');
      }
    },
  });

  let lastTime = performance.now();

  const tick = (): void => {
    requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    orbitCam.tickInput();

    const vel = isTextInputFocused()
      ? { vx: 0, vy: 0 }
      : computePlanarVelocityFromInput(
          isKeyHeld('KeyW'),
          isKeyHeld('KeyS'),
          isKeyHeld('KeyA'),
          isKeyHeld('KeyD'),
          MOVE_SPEED,
          orbitCam.yaw,
        );
    x += vel.vx * dt;
    y += vel.vy * dt;
    if (vel.vx !== 0 || vel.vy !== 0) {
      yaw = Math.PI - orbitCam.yaw;
    }

    if (playing && mode === 'animate') {
      const clip = animStore.activeClip;
      time += dt;
      if (clip.loop && clip.duration > 0) time %= clip.duration;
      applyClipAtTime();
      timeline.setTimeFromPlayback(time);
      ui.syncRotUi();
    }

    updateCharWorld();
    orbitCam.updateCamera(camera, x, y, z, CELL_SIZE);
    bodyRenderer.sync(doc, pose, { x, y, z, yaw, showBones });
    editGizmo.sync();
    gizmo.sync();
    renderer.render(scene, camera);
  };

  const onResize = (): void => {
    const w = Math.max(1, window.innerWidth - STUDIO_PANEL_W);
    const h = Math.max(1, window.innerHeight - TIMELINE_HEIGHT);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = `${STUDIO_PANEL_W}px`;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };

  onResize();
  window.addEventListener('resize', onResize);
  statusEl.textContent = 'Editar: Ctrl+Z/Y · Del · Ctrl+D · T/R/S · F · Esc · rueda=zoom al cursor';
  delete statusEl.dataset.state;
  tick();

  return () => {
    window.removeEventListener('resize', onResize);
    detachKeyboard();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.classList.remove('character-studio-canvas');
    canvas.style.position = '';
    canvas.style.top = '';
    canvas.style.left = '';
    canvas.style.width = '';
    canvas.style.height = '';
    orbitCam.dispose();
    ui.dispose();
    timeline.dispose();
    gizmo.dispose();
    editGizmo.dispose();
    bodyRenderer.dispose();
    scene.remove(grid);
    scene.remove(fill);
    scene.remove(key);
  };
}
