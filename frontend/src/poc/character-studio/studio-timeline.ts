/**
 * Barra de timeline inferior — scrub, clips, play, auto-key.
 *
 * @module character-studio/studio-timeline
 */

import type { StudioAnimStore } from '@/poc/character-studio/studio-anim-store';
import type { SkeletonPose } from '@/poc/character-studio/rig-math';
import { snapTime } from '@/poc/character-studio/studio-clip';
import type { StudioAnimationClip, StudioFps } from '@/poc/character-studio/types';

export interface StudioTimelineCallbacks {
  getClip: () => StudioAnimationClip;
  getStore: () => StudioAnimStore;
  getPose: () => SkeletonPose;
  getPlaying: () => boolean;
  setPlaying: (v: boolean) => void;
  getTime: () => number;
  setTime: (t: number) => void;
  applyClipAtTime: () => void;
  onClipChange: () => void;
  onKeyframeSaved: () => void;
  onStatus: (msg: string) => void;
}

const FPS_OPTIONS: StudioFps[] = [24, 30, 60];

export class StudioTimeline {
  readonly root: HTMLElement;
  private readonly cb: StudioTimelineCallbacks;

  private playBtn!: HTMLButtonElement;
  private timeSlider!: HTMLInputElement;
  private timeLabel!: HTMLElement;
  private clipSelect!: HTMLSelectElement;
  private fpsSelect!: HTMLSelectElement;
  private autoKeyCheck!: HTMLInputElement;
  private keyframeBtn!: HTMLButtonElement;
  private deleteKeyframeBtn!: HTMLButtonElement;
  private keyframeTrack!: HTMLElement;
  private boneLabel!: HTMLElement;
  private playhead!: HTMLElement;

  constructor(callbacks: StudioTimelineCallbacks) {
    this.cb = callbacks;
    this.root = document.createElement('footer');
    this.root.id = 'character-studio-timeline';
    this.build();
  }

  private build(): void {
    this.root.innerHTML = `
      <div class="studio-tl-toolbar">
        <div class="studio-tl-row studio-tl-row-main">
          <button type="button" id="tl-play" class="studio-btn tl-btn primary">▶</button>
          <label class="studio-tl-time">T <span id="tl-time-label">0.00s</span>
            <input type="range" id="tl-time" min="0" max="1000" value="0" />
          </label>
          <label class="studio-tl-field">Clip
            <select id="tl-clip" class="studio-input"></select>
          </label>
          <label class="studio-tl-field">FPS
            <select id="tl-fps" class="studio-input"></select>
          </label>
        </div>
        <div class="studio-tl-row studio-tl-row-actions">
          <label class="studio-check studio-tl-autokey">
            <input type="checkbox" id="tl-autokey" /> Auto-key
          </label>
          <button type="button" id="tl-keyframe" class="studio-btn tl-btn primary">◆ Guardar pose</button>
          <button type="button" id="tl-del-keyframe" class="studio-btn tl-btn">✕ Borrar pose</button>
          <button type="button" id="tl-clear-clip" class="studio-btn tl-btn">↺ Limpiar</button>
        </div>
      </div>
      <div class="studio-tl-track-wrap">
        <span id="tl-bone-label" class="studio-tl-bone-label">—</span>
        <div id="tl-keyframes" class="studio-tl-keyframes">
          <div id="tl-playhead" class="studio-tl-playhead"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.playBtn = this.root.querySelector('#tl-play') as HTMLButtonElement;
    this.timeSlider = this.root.querySelector('#tl-time') as HTMLInputElement;
    this.timeLabel = this.root.querySelector('#tl-time-label') as HTMLElement;
    this.clipSelect = this.root.querySelector('#tl-clip') as HTMLSelectElement;
    this.fpsSelect = this.root.querySelector('#tl-fps') as HTMLSelectElement;
    this.autoKeyCheck = this.root.querySelector('#tl-autokey') as HTMLInputElement;
    this.keyframeBtn = this.root.querySelector('#tl-keyframe') as HTMLButtonElement;
    this.deleteKeyframeBtn = this.root.querySelector('#tl-del-keyframe') as HTMLButtonElement;
    this.keyframeTrack = this.root.querySelector('#tl-keyframes') as HTMLElement;
    this.boneLabel = this.root.querySelector('#tl-bone-label') as HTMLElement;
    this.playhead = this.root.querySelector('#tl-playhead') as HTMLElement;

    for (const fps of FPS_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = String(fps);
      opt.textContent = String(fps);
      this.fpsSelect.appendChild(opt);
    }
    this.fpsSelect.value = String(this.cb.getStore().fps);

    this.playBtn.addEventListener('click', () => {
      const next = !this.cb.getPlaying();
      this.cb.setPlaying(next);
      this.playBtn.textContent = next ? '⏸' : '▶';
    });

    this.timeSlider.addEventListener('input', () => {
      const clip = this.cb.getClip();
      const store = this.cb.getStore();
      const u = parseInt(this.timeSlider.value, 10) / 1000;
      const raw = u * clip.duration;
      const t = snapTime(raw, store.fps);
      this.cb.setTime(t);
      this.cb.applyClipAtTime();
      this.syncTimeUi();
      this.syncPlayhead();
    });

    this.clipSelect.addEventListener('change', () => {
      this.cb.getStore().setActiveClip(this.clipSelect.value);
      this.cb.setTime(0);
      this.cb.applyClipAtTime();
      this.cb.onClipChange();
      this.refresh();
      this.cb.onStatus(`Clip: ${this.clipSelect.value}`);
    });

    this.fpsSelect.addEventListener('change', () => {
      const fps = parseInt(this.fpsSelect.value, 10) as StudioFps;
      this.cb.getStore().fps = fps;
      for (const clip of this.cb.getStore().library.clips) clip.fps = fps;
      this.syncTimeUi();
    });

    this.autoKeyCheck.addEventListener('change', () => {
      this.cb.getStore().autoKey = this.autoKeyCheck.checked;
    });

    this.keyframeBtn.addEventListener('click', () => {
      const store = this.cb.getStore();
      store.bakePoseAt(this.cb.getPose(), this.cb.getTime());
      this.refreshKeyframes();
      this.cb.onKeyframeSaved();
      this.cb.onStatus('Pose completa guardada');
    });

    this.deleteKeyframeBtn.addEventListener('click', () => {
      const store = this.cb.getStore();
      store.deletePoseAt(this.cb.getTime());
      this.cb.applyClipAtTime();
      this.refreshKeyframes();
      this.cb.onKeyframeSaved();
      this.cb.onStatus('Pose borrada en este tiempo');
    });

    this.root.querySelector('#tl-clear-clip')?.addEventListener('click', () => {
      const clip = this.cb.getClip();
      const ok = window.confirm(
        `¿Limpiar "${clip.label}"? Queda solo pose bind en t=0. No se puede deshacer.`,
      );
      if (!ok) return;
      this.cb.setPlaying(false);
      this.playBtn.textContent = '▶';
      this.cb.getStore().clearActiveClip();
      this.cb.setTime(0);
      this.cb.applyClipAtTime();
      this.refresh();
      this.cb.onKeyframeSaved();
      this.cb.onStatus(`Clip "${clip.label}" limpiado · solo t=0`);
    });
  }

  refresh(): void {
    const store = this.cb.getStore();

    this.clipSelect.innerHTML = '';
    for (const c of store.library.clips) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      this.clipSelect.appendChild(opt);
    }
    this.clipSelect.value = store.library.activeId;

    this.fpsSelect.value = String(store.fps);
    this.autoKeyCheck.checked = store.autoKey;
    this.syncTimeUi();
    this.refreshKeyframes();
    this.syncPlayhead();
    this.playBtn.textContent = this.cb.getPlaying() ? '⏸' : '▶';
  }

  syncTimeUi(): void {
    const clip = this.cb.getClip();
    const store = this.cb.getStore();
    const t = this.cb.getTime();
    const snapped = snapTime(t, store.fps);
    const frame = Math.round(snapped * store.fps);
    this.timeLabel.textContent = `${snapped.toFixed(2)}s (f${frame}) / ${clip.duration.toFixed(2)}s`;
    const u = clip.duration > 0 ? t / clip.duration : 0;
    this.timeSlider.value = String(Math.round(u * 1000));

    const boneId = store.selectedBoneId;
    const hasPose = store.hasPoseKeyframeAt(t);
    this.keyframeBtn.textContent = hasPose ? '◆ Pisar pose' : '◆ Guardar pose';
    void boneId;
  }

  setTimeFromPlayback(_t: number): void {
    this.syncTimeUi();
    this.syncPlayhead();
  }

  private syncPlayhead(): void {
    const clip = this.cb.getClip();
    const t = this.cb.getTime();
    const pct = clip.duration > 0 ? (t / clip.duration) * 100 : 0;
    this.playhead.style.left = `${pct}%`;
  }

  /** Actualiza diamantes de keyframes y etiqueta de hueso. */
  refreshKeyframes(): void {
    const store = this.cb.getStore();
    const clip = this.cb.getClip();
    const boneId = store.selectedBoneId;

    this.boneLabel.textContent = boneId ?? '—';

    const diamonds = this.keyframeTrack.querySelectorAll('.studio-tl-diamond');
    for (const d of diamonds) d.remove();

    if (!boneId || clip.duration <= 0) return;

    const times = store.keyTimesForBone(boneId);
    const snappedNow = snapTime(this.cb.getTime(), store.fps);

    for (const kt of times) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'studio-tl-diamond';
      const pct = (kt / clip.duration) * 100;
      el.style.left = `${pct}%`;
      el.title = `${kt.toFixed(3)}s`;
      if (Math.abs(kt - snappedNow) < 0.001) el.classList.add('active');
      el.addEventListener('click', () => {
        this.cb.setTime(kt);
        this.cb.applyClipAtTime();
        this.syncTimeUi();
        this.syncPlayhead();
        this.timeSlider.value = String(Math.round((kt / clip.duration) * 1000));
      });
      this.keyframeTrack.appendChild(el);
    }
  }

  dispose(): void {
    this.root.remove();
  }
}

export const STUDIO_PANEL_W = 340;
export const TIMELINE_HEIGHT = 168;
