/**
 * @file Crea la entidad jugador local y su ancla visual para cámara.
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
import { PlayerCharacterVisual } from '@/game/player/player-character-visual';
import { Group, type Scene } from 'three';

/** Spawnea el jugador y el ancla usada por la cámara. */
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
  group.userData.characterVisual = new PlayerCharacterVisual(scene, cellSize);
  scene.add(group);
  return { entityId, mesh: group };
}

/** Sincroniza el ancla de cámara con {@link PositionComponent}. */
export function syncPlayerMesh(
  mesh: Group,
  x: number,
  y: number,
  z: number,
  cellSize: number,
): void {
  mesh.position.set(x * cellSize, z * cellSize, y * cellSize);
}
