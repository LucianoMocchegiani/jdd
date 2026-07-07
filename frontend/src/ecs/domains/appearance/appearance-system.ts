/**
 * @file Apariencia del jugador (fase 6, stub visual).
 *
 * Lee `appearance.clip` de las fichas en {@link ActionsComponent} y aplica
 * un color al mesh placeholder (caja). Sustituye temporalmente a
 * `AnimationMixer` + GLB hasta tener modelo y catálogo en `@/game-data/appearance`.
 *
 * No mezcla animaciones: un solo clip “ganador” por frame según prioridad de slot.
 */

import { ActionsComponent } from '@/ecs/components/actions';
import { ConditionsComponent } from '@/ecs/components/conditions';
import { System } from '@/ecs/core';
import { resolveConditionTint } from '@/ecs/domains/condition/resolve-condition-effects';
import type { Group, Mesh, MeshStandardMaterial } from 'three';

/** Color del jugador en idle / walk por defecto. */
const DEFAULT_COLOR = 0xfbbf24;

/**
 * Mapa clip → color (debug visual).
 * Debe alinearse con claves de `ANIMATION_CATALOG` cuando exista mixer.
 */
const CLIP_COLORS: Record<string, number> = {
  walk: 0xfbbf24,
  run: 0xf59e0b,
  swim: 0x38bdf8,
  jump: 0xa3e635,
  attack: 0xef4444,
};

/**
 * Sistema de apariencia mínima para el jugador local.
 *
 * - Entrada: fichas activas resueltas por {@link ActionsComponent}.
 * - Salida: `MeshStandardMaterial.color` del primer hijo de `playerMesh`.
 * - Prioridad **25**: después de movement (20) e impact (22), cuando el estado
 *   de acción del frame ya está fijado.
 *
 * Solo afecta a `playerEntityId` (no recorre NPCs aunque el query traiga más entidades).
 */
export class AppearanceSystem extends System {
  readonly priority = 25;
  readonly requiredComponents = ['actions', 'conditions'] as const;

  /**
   * @param playerEntityId - Entidad ECS del jugador (spawn en `spawn-player`)
   * @param playerMesh - Grupo Three.js sincronizado con `PositionComponent`
   */
  constructor(
    private readonly playerEntityId: number,
    private readonly playerMesh: Group,
  ) {
    super();
  }

  override update(_deltaTime: number): void {
    if (!this.getEntities().has(this.playerEntityId)) {
      return;
    }

    const active = this.world?.getComponent<ActionsComponent>(
      this.playerEntityId,
      'actions',
    );
    if (!active) {
      return;
    }

    const now = performance.now();
    const conditions = this.world?.getComponent<ConditionsComponent>(
      this.playerEntityId,
      'conditions',
    );
    const clip = this.pickClip(active, now);
    let color = clip ? (CLIP_COLORS[clip] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
    const conditionTint = conditions ? resolveConditionTint(conditions.active) : null;
    if (conditionTint != null) {
      color = conditionTint;
    }

    const body = this.playerMesh.children[0];
    if (body && 'material' in body) {
      const mat = (body as Mesh).material as MeshStandardMaterial;
      mat.color.setHex(color);
    }
  }

  /**
   * Elige un único `appearance.clip` para pintar el mesh.
   *
   * Prioridad (mayor gana): `body_actions` latched → `impulse_displacements` →
   * `constant_displacements`. Coincide con la idea de que ataque/parry tapen
   * walk/run mientras dura el latch, sin blend de animación.
   *
   * @param active - Acciones ganadoras este frame
   * @param nowMs - `performance.now()` para comparar `bodyActionsUntilMs`
   * @returns Nombre de clip o `null` (color por defecto)
   */
  private pickClip(active: ActionsComponent, nowMs: number): string | null {
    if (active.bodyActions && active.bodyActionsUntilMs > nowMs) {
      return active.bodyActions.appearance?.clip ?? null;
    }
    if (active.impulseDisplacements) {
      return active.impulseDisplacements.appearance?.clip ?? null;
    }
    if (active.constantDisplacements) {
      return active.constantDisplacements.appearance?.clip ?? null;
    }
    return null;
  }
}
