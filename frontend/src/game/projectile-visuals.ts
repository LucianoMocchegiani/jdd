import { Mesh, MeshBasicMaterial, Scene, SphereGeometry } from 'three';
import type { ProjectileStateEvent } from '@/types/world-events';

export class ProjectileVisuals {
  private readonly geometry = new SphereGeometry(1, 10, 8);
  private readonly material = new MeshBasicMaterial({ color: 0x45e7ff });
  private readonly meshes = new Map<string, Mesh>();

  constructor(private readonly scene: Scene, private readonly cellSize: number) {}

  apply(event: ProjectileStateEvent): void {
    if (!event.active) {
      const mesh = this.meshes.get(event.id);
      if (mesh) this.scene.remove(mesh);
      this.meshes.delete(event.id);
      return;
    }
    let mesh = this.meshes.get(event.id);
    if (!mesh) {
      mesh = new Mesh(this.geometry, this.material);
      mesh.scale.setScalar(0.55 * this.cellSize);
      this.scene.add(mesh);
      this.meshes.set(event.id, mesh);
    }
    mesh.position.set(event.x * this.cellSize, event.z * this.cellSize, event.y * this.cellSize);
  }
}
