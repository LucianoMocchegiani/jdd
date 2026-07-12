/**
 * @file Punto de entrada del cliente v2.
 */

import '@/style.css';
import { bootstrapApp } from '@/game/app';
import { bootstrapCharacterStudioPoc } from '@/poc/character-studio';
import { STUDIO_PANEL_W, TIMELINE_HEIGHT } from '@/poc/character-studio/studio-timeline';
import { bindInputStatsHud } from '@/game/debug/input-stats-debug';
import { bindPositionSyncHud } from '@/game/debug/position-sync-debug';
import { attachKeyboardInput } from '@/game/input/keyboard-state';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

const container = document.querySelector<HTMLDivElement>('#canvas-container');
const statusEl = document.querySelector<HTMLElement>('#status');
const debugMediumEl = document.querySelector<HTMLElement>('#debug-medium');
const debugConditionsEl = document.querySelector<HTMLElement>('#debug-conditions');
const debugCameraEl = document.querySelector<HTMLElement>('#debug-camera');
const debugMovementEl = document.querySelector<HTMLElement>('#debug-movement');
const debugInputStatsEl = document.querySelector<HTMLElement>('#debug-input-stats');
const debugPosSyncEl = document.querySelector<HTMLElement>('#debug-pos-sync');

bindInputStatsHud(debugInputStatsEl);
bindPositionSyncHud(debugPosSyncEl);

if (!container || !statusEl || !debugMediumEl || !debugConditionsEl || !debugCameraEl || !debugMovementEl) {
  throw new Error('Missing #canvas-container, #status or #debug-hud children');
}

const scene = new Scene();
scene.background = new Color(0x0a0a12);

const camera = new PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
camera.position.set(2, 2, 4);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const canvas = renderer.domElement;
canvas.tabIndex = 0;
canvas.setAttribute('aria-label', 'Vista del juego');
container.appendChild(canvas);
container.addEventListener('click', () => canvas.focus());

scene.add(new AmbientLight(0xffffff, 0.45));
const sun = new DirectionalLight(0xffffff, 1);
sun.position.set(12, 20, 8);
scene.add(sun);

attachKeyboardInput();

const pocMode = new URLSearchParams(window.location.search).get('poc');

if (pocMode === 'character-studio') {
  document.body.classList.add('character-studio-mode');
  statusEl.textContent = 'Character Studio — cargando…';
  try {
    bootstrapCharacterStudioPoc(scene, camera, renderer, statusEl);
    renderer.domElement.focus();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    statusEl.textContent = `Character Studio — error: ${msg}`;
    statusEl.dataset.state = 'warn';
    console.error('[main] character-studio', err);
  }
} else {
  statusEl.textContent = 'Conectando al backend…';

  void bootstrapApp(
    scene,
    camera,
    renderer,
    statusEl,
    debugMediumEl,
    debugConditionsEl,
    debugCameraEl,
    debugMovementEl,
    debugInputStatsEl,
    debugPosSyncEl,
  )
    .then(() => {
      canvas.focus();
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Error de conexión';
      statusEl.textContent = `No se pudo iniciar (online requerido): ${message}`;
      statusEl.dataset.state = 'warn';
      if (import.meta.env.DEV) {
        console.error('[bootstrap]', err);
      }
    });
}

window.addEventListener('resize', () => {
  const isStudio = document.body.classList.contains('character-studio-mode');
  const panelW = isStudio ? STUDIO_PANEL_W : 0;
  const timelineH = isStudio ? TIMELINE_HEIGHT : 0;
  const w = Math.max(1, window.innerWidth - panelW);
  const h = Math.max(1, window.innerHeight - timelineH);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (isStudio) {
    canvas.style.left = `${panelW}px`;
    canvas.style.height = `${h}px`;
    canvas.style.width = `${w}px`;
  }
});
