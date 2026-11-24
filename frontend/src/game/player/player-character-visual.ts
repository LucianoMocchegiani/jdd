import { buildRig, SkeletonPose } from '@/poc/character-studio/rig-math';
import { clipFromJson, createDefaultClipLibrary, sampleClip } from '@/poc/character-studio/studio-clip';
import { defaultBipedDocument } from '@/poc/character-studio/studio-document';
import { StudioRenderer } from '@/poc/character-studio/studio-renderer';
import type { StudioAnimationClip, StudioDocument } from '@/poc/character-studio/types';
import { DEFAULT_PALETTE } from '@/poc/shared';
import { BODY_ACTIONS } from '@/game-data/actions';
import { PARTICLE_SIZE_RATIO } from '@/game/terrain/particle-geometry';
import { resolveRemoteClipId } from '@/game/player/remote-animation';
import { createDirectionalPlayerClips } from '@/game/player/directional-clips';
import auraDeKiClipRaw from '@/game/player/animations/aura_de_ki.json?raw';
import escudoRadialClipRaw from '@/game/player/animations/escudo_radial_de_ki.json?raw';
import esquiveRapidoClipRaw from '@/game/player/animations/esquive_rapido.json?raw';
import rayoDeKiClipRaw from '@/game/player/animations/rayo_de_ki.json?raw';
import orbeExplosivoClipRaw from '@/game/player/animations/orbe_explosivo.json?raw';
import truenoClipRaw from '@/game/player/animations/trueno.json?raw';
import { Box3, CylinderGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, SphereGeometry, Vector3, type Scene } from 'three';

const UNIT_ELEMENT_BOUNDS = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));

function rigOriginOffset(doc: StudioDocument, pose: SkeletonPose): Vector3 {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const element of doc.elements) {
    const matrix = pose.elementWorldMatrix(element).clone().scale(new Vector3(...element.scale));
    const bounds = UNIT_ELEMENT_BOUNDS.clone().applyMatrix4(matrix);
    min.min(bounds.min);
    max.max(bounds.max);
  }
  if (!Number.isFinite(min.x)) throw new Error('El rig no tiene elementos renderizables');
  return new Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2).multiplyScalar(doc.gridStep);
}

export class PlayerCharacterVisual {
  private readonly doc = defaultBipedDocument();
  private readonly pose = new SkeletonPose(buildRig(this.doc), this.doc);
  private readonly rigOriginOffset = rigOriginOffset(this.doc, this.pose);
  private readonly renderer: StudioRenderer;
  private readonly clips = new Map<string, StudioAnimationClip>(
    createDefaultClipLibrary(this.doc.bones).clips.map((clip) => [clip.id, clip] as const),
  );
  private clipId = 'idle';
  private time = 0;
  private damageFlashUntilMs = 0;
  private beamActive = false;
  private beamLength = 28;
  private beamSeq = 0;
  private readonly auraRadius = BODY_ACTIONS.find((action) => action.id === 'aura_de_ki')?.impact?.radius ?? 3;
  private readonly auraRing = new Mesh(
    new RingGeometry(0.75, 1, 48),
    new MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.55, side: 2, depthWrite: false }),
  );
  private readonly auraGlow = new Mesh(
    new SphereGeometry(1, 16, 12),
    new MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.12, wireframe: true, depthWrite: false }),
  );
  private readonly beam = new Mesh(
    new CylinderGeometry(0.18, 0.3, 1, 10),
    new MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.88, depthWrite: false }),
  );

  constructor(scene: Scene, private readonly cellSize: number) {
    this.renderer = new StudioRenderer(scene, cellSize);
    this.clips.set('aura_de_ki', clipFromJson(auraDeKiClipRaw));
    this.clips.set('escudo_radial_de_ki', clipFromJson(escudoRadialClipRaw));
    this.clips.set('esquive_rapido', clipFromJson(esquiveRapidoClipRaw));
    for (const clip of createDirectionalPlayerClips(this.clips.get('walk')!, this.clips.get('esquive_rapido')!)) {
      this.clips.set(clip.id, clip);
    }
    this.clips.set('rayo_de_ki', clipFromJson(rayoDeKiClipRaw));
    this.clips.set('orbe_explosivo', clipFromJson(orbeExplosivoClipRaw));
    this.clips.set('trueno', clipFromJson(truenoClipRaw));
    this.auraRing.rotation.x = -Math.PI / 2;
    this.auraRing.visible = false;
    this.auraGlow.visible = false;
    this.beam.visible = false;
    scene.add(this.auraRing, this.auraGlow, this.beam);
  }

  update(
    deltaTime: number,
    requestedClip: string | null,
    x: number,
    y: number,
    z: number,
    yaw: number,
    tint: number | null,
  ): void {
    const current = this.clips.get(this.clipId)!;
    const resolvedClipId = resolveRemoteClipId(requestedClip, this.clips);
    const requestedAnimation = resolvedClipId ? this.clips.get(resolvedClipId) : undefined;
    const keepOneShot =
      !current.loop && this.time < current.duration && (!requestedAnimation || requestedAnimation.loop);
    const nextId = keepOneShot ? this.clipId : requestedAnimation ? resolvedClipId! : 'idle';

    if (nextId !== this.clipId) {
      this.clipId = nextId;
      this.time = 0;
    } else if (current.loop && current.duration > 0) {
      this.time = (this.time + deltaTime) % current.duration;
    } else {
      this.time = Math.min(this.time + deltaTime, current.duration);
    }

    const clip = this.clips.get(this.clipId)!;
    this.pose.setBoneRots(sampleClip(clip, this.time, this.doc.bones));
    const visualYaw = yaw + Math.PI / 2;
    const cosYaw = Math.cos(visualYaw);
    const sinYaw = Math.sin(visualYaw);
    this.renderer.sync(this.doc, this.pose, {
      x: x - cosYaw * this.rigOriginOffset.x - sinYaw * this.rigOriginOffset.z,
      y: y + sinYaw * this.rigOriginOffset.x - cosYaw * this.rigOriginOffset.z,
      z: z - (1 - PARTICLE_SIZE_RATIO / 2) - this.rigOriginOffset.y,
      yaw: visualYaw,
      showBones: false,
    });
    const beamActive = requestedClip === 'rayo_de_ki';
    if (beamActive && !this.beamActive) this.beamLength = 28;
    this.beamActive = beamActive;
    this.beam.visible = beamActive;
    if (beamActive) {
      const direction = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const rightHand = this.renderer.getBoneWorldPosition(this.pose, 'muneca-derecha');
      const leftHand = this.renderer.getBoneWorldPosition(this.pose, 'muneca-izquierda');
      const handCenter = rightHand.add(leftHand).multiplyScalar(0.5);
      const bodyOrigin = new Vector3(x * this.cellSize, z * this.cellSize, y * this.cellSize);
      const handOffset = handCenter.clone().sub(bodyOrigin).dot(direction);
      const length = Math.max(0, this.beamLength * this.cellSize - handOffset);
      this.beam.position.copy(handCenter).addScaledVector(direction, length / 2);
      this.beam.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
      const radius = (0.2 + 0.04 * Math.sin(this.time * 18)) * this.cellSize;
      this.beam.scale.set(radius, length, radius);
    }
    const auraActive = requestedClip === 'aura_de_ki';
    this.auraRing.visible = this.auraGlow.visible = auraActive;
    if (auraActive) {
      const pulse = 0.94 + 0.06 * Math.sin(this.time * 12);
      this.auraRing.position.set(x * this.cellSize, (z - 0.43) * this.cellSize, y * this.cellSize);
      this.auraRing.scale.setScalar(this.auraRadius * this.cellSize * pulse);
      this.auraGlow.position.set(x * this.cellSize, (z + 0.85) * this.cellSize, y * this.cellSize);
      this.auraGlow.scale.set(this.auraRadius * this.cellSize * 0.75, this.cellSize * 0.9, this.auraRadius * this.cellSize * 0.75);
      (this.auraRing.material as MeshBasicMaterial).opacity = 0.4 + 0.2 * pulse;
      (this.auraGlow.material as MeshBasicMaterial).opacity = 0.08 + 0.07 * pulse;
    }
    const color = this.damageFlashUntilMs > performance.now() ? 0xff5555 : tint;
    for (const mesh of this.renderer.getPickMeshes()) {
      const layer = String(mesh.userData.bucketKey).split(':')[0]! as keyof typeof DEFAULT_PALETTE;
      (mesh.material as MeshStandardMaterial).color.setHex(
        color ?? DEFAULT_PALETTE[layer] ?? DEFAULT_PALETTE.flesh,
      );
    }
  }

  /** Actualiza el alcance del rayo con el resultado autoritativo de un pulso. */
  setBeamLength(length: number, seq: number): void {
    if (!Number.isFinite(length) || length < 0 || !Number.isSafeInteger(seq) || seq <= this.beamSeq) return;
    this.beamSeq = seq;
    this.beamLength = Math.min(length, 28);
  }

  /** Mantiene un destello breve cuando el servidor confirma daño recibido. */
  flashDamage(): void {
    this.damageFlashUntilMs = performance.now() + 180;
  }

  /** Ajusta transparencia para usar el rig como fantasma de depuración. */
  setOpacity(opacity: number): void {
    for (const mesh of this.renderer.getPickMeshes()) {
      const material = mesh.material as MeshStandardMaterial;
      material.transparent = opacity < 1;
      material.opacity = opacity;
      material.depthWrite = opacity >= 1;
      material.needsUpdate = true;
    }
  }

  /** Libera el renderer al desaparecer una réplica remota. */
  dispose(): void {
    this.renderer.dispose();
    for (const mesh of [this.auraRing, this.auraGlow, this.beam]) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
  }
}
