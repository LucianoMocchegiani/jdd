import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, Scene, Shape, ShapeGeometry, SphereGeometry } from 'three';
import { isNewActionSequence } from '@/game/player/remote-animation';
import type { PlayerStateEvent } from '@/types/world-events';

const DURATION = 0.45;
const SHIELD_DURATION = 5;

export function shockwaveRadius(progress: number, radius: number): number {
  return radius * Math.max(0, Math.min(1, progress));
}

export function kiShieldForward(yaw: number): { x: number; y: number } {
  return { x: -Math.sin(yaw), y: -Math.cos(yaw) };
}

/** Renderiza la onda radial y los objetos escudo desde snapshots autoritativos. */
export class ShockwaveVisuals {
  private readonly effects: Array<{ ring: Mesh; elapsed: number }> = [];
  private readonly shields = new Map<string, { mesh: Mesh; elapsed: number; shape: 'cone' | 'radial'; remaining: number }>();
  private readonly actionSeqs = new Map<string, number>();

  constructor(private readonly scene: Scene, private readonly cellSize: number) {}

  apply(event: PlayerStateEvent): void {
    this.applyShieldState(event);
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
    for (const [playerId, shield] of this.shields) {
      shield.elapsed += deltaTime;
      const pulse = 1 + 0.025 * Math.sin(shield.elapsed * 8);
      if (shield.shape === 'radial') shield.mesh.scale.set(1.25 * this.cellSize * pulse, 1.05 * this.cellSize * pulse, 1.25 * this.cellSize * pulse);
      (shield.mesh.material as MeshBasicMaterial).opacity = (shield.shape === 'radial' ? 0.13 : 0.25) + (shield.shape === 'radial' ? 0.14 : 0.37) * shield.remaining / 50;
      if (shield.elapsed >= SHIELD_DURATION) this.removeShield(playerId);
    }
  }

  private applyShieldState(event: PlayerStateEvent): void {
    if (event.shield_active !== true) { this.removeShield(event.player_id); return; }
    const shape = event.shield_shape === 'radial' ? 'radial' : 'cone';
    let shield = this.shields.get(event.player_id);
    if (shield && shield.shape !== shape) { this.removeShield(event.player_id); shield = undefined; }
    if (!shield) {
      const geometry = shape === 'radial' ? new SphereGeometry(1, 24, 16) : this.coneGeometry();
      const material = new MeshBasicMaterial({
        color: 0x55ddff, transparent: true, opacity: shape === 'radial' ? 0.27 : 0.62,
        side: DoubleSide, depthWrite: false, wireframe: shape === 'radial',
      });
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = 6;
      this.scene.add(mesh);
      shield = { mesh, elapsed: 0, shape, remaining: event.shield_remaining ?? 50 };
      this.shields.set(event.player_id, shield);
    }
    shield.remaining = Math.max(0, Math.min(50, event.shield_remaining ?? 50));
    if (shape === 'radial') {
      shield.mesh.position.set(event.x * this.cellSize, (event.z + 0.9) * this.cellSize, event.y * this.cellSize);
    } else {
      const forward = kiShieldForward(event.yaw);
      shield.mesh.scale.setScalar(this.cellSize);
      shield.mesh.position.set((event.x + forward.x * 0.65) * this.cellSize, (event.z + 0.9) * this.cellSize, (event.y + forward.y * 0.65) * this.cellSize);
      shield.mesh.rotation.y = Math.PI + event.yaw;
    }
  }

  private coneGeometry(): ShapeGeometry {
    const shape = new Shape();
    shape.moveTo(-0.65, -0.75);
    shape.lineTo(0.65, -0.75);
    shape.lineTo(0.6, 0.42);
    shape.lineTo(0, 0.82);
    shape.lineTo(-0.6, 0.42);
    shape.closePath();
    return new ShapeGeometry(shape);
  }

  private removeShield(playerId: string): void {
    const shield = this.shields.get(playerId);
    if (!shield) return;
    this.scene.remove(shield.mesh);
    shield.mesh.geometry.dispose();
    (shield.mesh.material as MeshBasicMaterial).dispose();
    this.shields.delete(playerId);
  }
}
