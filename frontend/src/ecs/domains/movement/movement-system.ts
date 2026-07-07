/**
 * @file Integración de velocidad, gravedad/flotación y colisión por celdas (fases 4–6).
 *
 * Corre **después** de {@link InputSystem}, {@link ParticleContextSystem} y
 * {@link ActionOrchestratorSystem}: lee intents ya escritos y slots activos en
 * {@link ActionsComponent}, y escribe {@link PositionComponent} + {@link KinematicsComponent}.
 *
 * No resuelve fichas ni medios; solo aplica el perfil ya calculado y el bloque `movement`
 * de las acciones vía {@link computeMovementFromAction}.
 */

import { ActionsComponent } from '@/ecs/components/actions';
import { ConditionsComponent } from '@/ecs/components/conditions';
import { FacingComponent } from '@/ecs/components/facing';
import { InputComponent } from '@/ecs/components/input';
import { KinematicsComponent } from '@/ecs/components/kinematics';
import { ContactComponent } from '@/ecs/components/contact';
import { PositionComponent } from '@/ecs/components/position';
import { System } from '@/ecs/core';
import { computeMovementFromAction } from '@/ecs/domains/action/apply-movement-from-action';
import { usesCameraRelative3D } from '@/game/camera/movement-relative';
import { getCameraController } from '@/game/camera/camera-access';
import { resolveConditionSpeedMultiplier } from '@/ecs/domains/condition/resolve-condition-effects';
import { resolveMovementProfile } from '@/ecs/domains/movement/resolve-movement-profile';
import { logMovementApply, logMovementVelocity } from '@/game/debug/input-flow-debug';
import {
  logAxisBlocked,
  logMovementSnapshot,
  logMovementWarn,
} from '@/game/debug/movement-debug';
import { getHeldKeyCodes } from '@/game/input/keyboard-state';
import type { TerrainStore } from '@/game/terrain/terrain-store';
import { cellKey } from '@/game/utils/cell-key';

/** Pitch de cámara durante replay de reconciliación (ver {@link PlayerSimulationRunner}). */
export interface SimulationPitchSource {
  resolve(fallbackPitch: number): number;
}

/**
 * Sistema de locomoción (`priority` 20).
 *
 * **Entradas por entidad**
 * - {@link InputComponent.intents} — WASD, salto, etc.
 * - {@link ContactComponent} — `medium` + tipo dominante (perfil en `movement-profiles.ts`).
 * - {@link ActionsComponent} — `constantDisplacements` / `impulseDisplacements` del orquestador.
 * - {@link TerrainStore} — sólidos en pies y cabeza para bloquear ejes.
 *
 * **Flujo por frame (por entidad)**
 * 1. {@link resolveMovementProfile} → `moveSpeedCells`, gravedad, flotación, arrastre vertical.
 * 2. {@link computeMovementFromAction} → `vx`/`vy` y opcional `impulseZ` (salto en ficha).
 * 3. `vz`: impulso (salto) o thrust W/S en aire/agua; si no, conservar momentum y aplicar gravedad.
 * 4. {@link tryMoveAxis} en X, Y, Z (colisión antes de aplicar desplazamiento).
 * 5. Aterrizaje: si hay sólido bajo los pies, clamp `vz ≤ 0` y snap suave de `z` a la celda.
 *
 * **Query:** `position` + `kinematics` + `input` + `medium` + `actions` (AND).
 */
export class MovementSystem extends System {
  readonly priority = 20;
  readonly requiredComponents = [
    'position',
    'kinematics',
    'input',
    'contact',
    'facing',
    'actions',
  ] as const;

  /**
   * @param terrain - Viewport de celdas: ocupación sólida, tipos de partícula y partículas por celda.
   */
  constructor(private readonly terrain: TerrainStore) {
    super();
  }

  /** Pitch de replay durante reconciliación. */
  setPitchSource(source: SimulationPitchSource): void {
    this.pitchSource = source;
  }

  private pitchSource: SimulationPitchSource | null = null;

  override update(deltaTime: number): void {
    const entities = this.getEntities();
    if (entities.size === 0) {
      logMovementWarn(
        'MovementSystem: ninguna entidad con position+kinematics+input+medium+facing+actions',
      );
      return;
    }

    const typesByNombre = this.terrain.getTypesByNombre();

    for (const entityId of entities) {
      const pos = this.world?.getComponent<PositionComponent>(entityId, 'position');
      const kin = this.world?.getComponent<KinematicsComponent>(entityId, 'kinematics');
      const input = this.world?.getComponent<InputComponent>(entityId, 'input');
      const contactComp = this.world?.getComponent<ContactComponent>(entityId, 'contact');
      const facing = this.world?.getComponent<FacingComponent>(entityId, 'facing');
      const conditions = this.world?.getComponent<ConditionsComponent>(entityId, 'conditions');
      const active = this.world?.getComponent<ActionsComponent>(entityId, 'actions');
      if (!pos || !kin || !input || !contactComp || !facing || !active) {
        continue;
      }

      const conditionSpeedMultiplier = conditions
        ? resolveConditionSpeedMultiplier(conditions.active)
        : 1;

      const camera = getCameraController();
      const pitch = this.pitchSource?.resolve(camera?.pitch ?? 0) ?? (camera?.pitch ?? 0);

      const profile = resolveMovementProfile(
        contactComp.medium,
        contactComp.dominantTipoNombre,
        typesByNombre,
      );
      const onGround = contactComp.medium === 'ground';

      const move = computeMovementFromAction(
        input,
        profile,
        active.constantDisplacements,
        active.impulseDisplacements,
        facing.yaw,
        pitch,
        conditionSpeedMultiplier,
      );

      kin.vx = move.vx;
      kin.vy = move.vy;

      if (move.impulseZ != null) {
        kin.vz = move.impulseZ;
      } else if (
        usesCameraRelative3D(contactComp.medium) &&
        (input.isActive('move_forward') || input.isActive('move_backward'))
      ) {
        kin.vz = move.vz;
      }

      if (!onGround) {
        kin.vz -= profile.gravityZ * deltaTime;
        if (profile.buoyancyZ > 0) {
          kin.vz += profile.buoyancyZ * deltaTime;
        }
        if (profile.verticalDrag > 0) {
          kin.vz *= Math.max(0, 1 - profile.verticalDrag * deltaTime);
        }
      }

      const activeIntents = Object.entries(input.intents)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const actionIds = [active.constantDisplacements?.id, active.impulseDisplacements?.id]
        .filter(Boolean)
        .join('+');
      logMovementVelocity(
        entityId,
        { vx: kin.vx, vy: kin.vy, vz: kin.vz },
        profile.moveSpeedCells,
        onGround,
        [...activeIntents, actionIds ? `→${actionIds}` : ''],
      );

      this.tryMoveAxis(pos, kin, 'x', kin.vx * deltaTime);
      this.tryMoveAxis(pos, kin, 'y', kin.vy * deltaTime);
      this.tryMoveAxis(pos, kin, 'z', kin.vz * deltaTime);

      const below = cellKey(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z) - 1);
      const solidBelowFeet = this.terrain.getOccupiedSolidCells().has(below);
      if (solidBelowFeet) {
        kin.vz = Math.min(kin.vz, 0);
        if (pos.z < Math.floor(pos.z) + 0.01) {
          pos.z = Math.floor(pos.z);
        }
      }

      const cx = Math.floor(pos.x);
      const cy = Math.floor(pos.y);
      const cz = Math.floor(pos.z);
      logMovementSnapshot({
        entityId,
        pos: { x: pos.x, y: pos.y, z: pos.z },
        cell: { x: cx, y: cy, z: cz },
        medium: contactComp.medium,
        dominantTipo: contactComp.dominantTipoNombre,
        onGround,
        activeIntents,
        heldKeys: getHeldKeyCodes(),
        velocity: { vx: kin.vx, vy: kin.vy, vz: kin.vz },
        deltaTime,
        solidBelowFeet,
        bodyBlockedAtCell: this.isBlocked(cx, cy, cz),
        solidAtFeet: this.terrain.isCellSolid(cx, cy, cz),
        solidAtHead: this.terrain.isCellSolid(cx, cy, cz + 1),
        occupiedSolidCount: this.terrain.getOccupiedSolidCells().size,
        entityCount: entities.size,
      });
    }
  }

  /**
   * Desplaza una coordenada si la celda destino (pies + cabeza) no es sólida.
   *
   * Modelo de cuerpo: dos celdas verticales `(fx, fy, fz)` y `(fx, fy, fz+1)`.
   * Si cualquiera es sólida, cancela el movimiento en ese eje y pone la velocidad del eje a 0.
   *
   * @param pos - Posición en celdas fraccionarias (mundo)
   * @param kin - Velocidades; se anulan en el eje bloqueado
   * @param axis - Eje a integrar este paso
   * @param delta - Desplazamiento ya escalado por `deltaTime`
   */
  private tryMoveAxis(
    pos: PositionComponent,
    kin: KinematicsComponent,
    axis: 'x' | 'y' | 'z',
    delta: number,
  ): void {
    if (delta === 0) {
      return;
    }
    const before = { x: pos.x, y: pos.y, z: pos.z };
    const nx = axis === 'x' ? pos.x + delta : pos.x;
    const ny = axis === 'y' ? pos.y + delta : pos.y;
    const nz = axis === 'z' ? pos.z + delta : pos.z;
    const fx = Math.floor(nx);
    const fy = Math.floor(ny);
    const fz = Math.floor(nz);
    const solidFeet = this.terrain.isCellSolid(fx, fy, fz);
    const solidHead = this.terrain.isCellSolid(fx, fy, fz + 1);
    if (solidFeet || solidHead) {
      logAxisBlocked({
        axis,
        delta,
        targetCell: { x: fx, y: fy, z: fz },
        solidFeet,
        solidHead,
      });
      logMovementApply(axis, delta, before, before, true);
      if (axis === 'x') {
        kin.vx = 0;
      } else if (axis === 'y') {
        kin.vy = 0;
      } else {
        kin.vz = 0;
      }
      return;
    }
    pos.x = nx;
    pos.y = ny;
    pos.z = nz;
    logMovementApply(axis, delta, before, { x: pos.x, y: pos.y, z: pos.z }, false);
  }

  /**
   * Indica si el cuerpo (pies o cabeza) intersecta sólido en la celda actual.
   * Solo para el snapshot de debug; la colisión real ocurre en {@link tryMoveAxis}.
   */
  private isBlocked(cx: number, cy: number, cz: number): boolean {
    return (
      this.terrain.isCellSolid(cx, cy, cz) ||
      this.terrain.isCellSolid(cx, cy, cz + 1)
    );
  }
}
