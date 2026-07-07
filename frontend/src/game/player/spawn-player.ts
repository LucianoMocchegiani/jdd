/**
 * @file Crea la entidad jugador con componentes base.
 */

import {
  ActionsComponent,
  ConditionsComponent,
  FacingComponent,
  InputComponent,
  KinematicsComponent,
  ContactComponent,
  PositionComponent,
} from '@/ecs/components';
import type { World } from '@/ecs/core';
import { createPlayerBodyMesh } from '@/game/player/player-body-visual';
import { Group, MeshStandardMaterial, type Scene } from 'three';

/**
 * Spawnea jugador en ECS y un marcador visual en la escena.
 *
 * @returns Id de entidad y grupo Three.js del marcador
 */
export function spawnPlayer(
  world: World,
  scene: Scene,
  cellSize: number,
  x: number,
  y: number,
  z: number,
): { entityId: number; mesh: Group } {
  const entityId = world.createEntity();
  world.addComponent(entityId, new PositionComponent(x, y, z));
  world.addComponent(entityId, new KinematicsComponent());
  world.addComponent(entityId, new InputComponent());
  world.addComponent(entityId, new ContactComponent());
  world.addComponent(entityId, new ConditionsComponent());
  world.addComponent(entityId, new FacingComponent(0));
  world.addComponent(entityId, new ActionsComponent());

  const group = new Group();
  const body = createPlayerBodyMesh(
    cellSize,
    new MeshStandardMaterial({ color: 0xfbbf24 }),
  );
  group.add(body);
  scene.add(group);

  return { entityId, mesh: group };
}

/** Sincroniza el mesh del jugador con {@link PositionComponent}. */
export function syncPlayerMesh(
  mesh: Group,
  x: number,
  y: number,
  z: number,
  cellSize: number,
): void {
  mesh.position.set(x * cellSize, z * cellSize, y * cellSize);
}
