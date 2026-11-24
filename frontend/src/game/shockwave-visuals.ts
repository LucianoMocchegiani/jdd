import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, Scene } from 'three';
import { isNewActionSequence } from '@/game/player/remote-animation';
import type { PlayerStateEvent } from '@/types/world-events';

const DURATION = 0.45;

export function shockwaveRadius(progress: number, radius: number): number {
  return radius * Math.max(0, Math.min(1, progress));
}

/** Muestra la expansión radial al recibir el estado autoritativo de la acción. */
export class ShockwaveVisuals {
  private readonly effects: Array<{ ring: Mesh; elapsed: number }> = [];
  private readonly actionSeqs = new Map<string, number>();

  constructor(private readonly scene: Scene, private readonly cellSize: number) {}

  apply(event: PlayerStateEvent): void {
    if (event.action_id !== 'onda_de_choque' || event.action_seq === undefined) return;
    if (!isNewActionSequence(this.actionSeqs.get(event.player_id) ?? null, event.action_seq)) return;
    this.actionSeqs.set(event.player_id, event.action_seq);

    const ring = new Mesh(
      new RingGeometry(0.88, 1, 48),
      new MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.95, side: DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 5;
    ring.position.set(event.x * this.cellSize, (event.z + 0.08) * this.cellSize, event.y * this.cellSize);
    this.scene.add(ring);
    this.effects.push({ ring, elapsed: 0 });
  }

  update(deltaTime: number): void {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i]!;
      effect.elapsed += deltaTime;
      const progress = Math.min(1, effect.elapsed / DURATION);
      effect.ring.scale.setScalar(shockwaveRadius(0.1 + 0.9 * progress, 3.5 * this.cellSize));
      (effect.ring.material as MeshBasicMaterial).opacity = 0.95 * (1 - progress);
      if (progress >= 1) {
        this.scene.remove(effect.ring);
        effect.ring.geometry.dispose();
        (effect.ring.material as MeshBasicMaterial).dispose();
        this.effects.splice(i, 1);
      }
    }
  }
}
