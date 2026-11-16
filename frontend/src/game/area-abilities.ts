import type { AreaSpellEvent } from '@/types/world-events';
import {
  CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  RingGeometry, Scene, SphereGeometry,
} from 'three';

interface EffectView { group: Group; ring: Mesh; core: Mesh; elapsed: number; duration: number; }
export class AreaSpellVisuals {
  private readonly effects: EffectView[] = [];
  constructor(private readonly scene: Scene, private readonly cellSize: number) {}

  apply(event: AreaSpellEvent): void {
    const group = new Group();
    const color = event.effect === 'thunder' ? 0xa78bfa : 0x55ddff;
    const ring = new Mesh(
      new RingGeometry(0.08, 1, 40),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(event.x * this.cellSize, event.z * this.cellSize + 0.04 * this.cellSize, event.y * this.cellSize);
    const core = event.effect === 'thunder'
      ? new Mesh(new CylinderGeometry(0.12 * this.cellSize, 0.28 * this.cellSize, 1, 8), new MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.95, depthWrite: false }))
      : new Mesh(new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
    const groundY = event.z * this.cellSize;
    core.position.set(event.x * this.cellSize, groundY + (event.effect === 'thunder' ? 6 : 1.4) * this.cellSize, event.y * this.cellSize);
    if (event.effect === 'thunder') core.scale.y = 12 * this.cellSize;
    else core.scale.setScalar(0.45 * this.cellSize);
    group.userData = { effect: event.effect, radius: event.radius, groundY };
    group.add(ring, core);
    this.scene.add(group);
    this.effects.push({ group, ring, core, elapsed: 0, duration: event.effect === 'thunder' ? 0.45 : 0.6 });
  }

  update(deltaTime: number): void {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i]!;
      effect.elapsed += deltaTime;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      const radius = Number(effect.group.userData.radius);
      effect.ring.scale.setScalar((0.1 + 0.9 * progress) * radius * this.cellSize);
      (effect.ring.material as MeshBasicMaterial).opacity = 0.9 * (1 - progress);
      (effect.core.material as MeshBasicMaterial).opacity = 0.95 * (1 - progress);
      if (effect.group.userData.effect === 'orb') {
        effect.core.position.y = Number(effect.group.userData.groundY) + 1.4 * (1 - progress) * this.cellSize;
        effect.core.scale.setScalar((0.25 + 0.55 * progress) * this.cellSize);
      } else {
        effect.core.position.y = Number(effect.group.userData.groundY) + 6 * (1 - progress) * this.cellSize;
        effect.core.scale.y = Math.max(0.01, 12 * (1 - progress)) * this.cellSize;
      }
      if (effect.elapsed >= effect.duration) {
        this.scene.remove(effect.group);
        effect.group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        });
        this.effects.splice(i, 1);
      }
    }
  }
}
