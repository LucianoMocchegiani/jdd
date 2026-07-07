/**
 * @file Pipeline ECS para replay de reconciliación (espejo `game_loop.run_player_tick`).
 *
 * Ejecuta contact → condition → action → movement sin InputSystem, daño ni apariencia.
 * Solo replay local; el servidor corre `run_player_tick` cada ~30 Hz vía `run_session_ticks`.
 */

import type { ActionOrchestratorSystem } from '@/ecs/domains/action/action-orchestrator-system';
import type { ConditionSystem } from '@/ecs/domains/condition/condition-system';
import type { ParticleContextSystem } from '@/ecs/domains/contact/particle-context-system';
import type {
  MovementSystem,
  SimulationPitchSource,
} from '@/ecs/domains/movement/movement-system';

/**
 * Ejecuta la subcadena de simulación del jugador local en ticks de replay (~30 Hz).
 */
export class PlayerSimulationRunner implements SimulationPitchSource {
  private replayPitch: number | null = null;

  constructor(
    private readonly particleContext: ParticleContextSystem,
    private readonly condition: ConditionSystem,
    private readonly actionOrchestrator: ActionOrchestratorSystem,
    private readonly movement: MovementSystem,
  ) {}

  resolve(fallbackPitch: number): number {
    return this.replayPitch ?? fallbackPitch;
  }

  /**
   * @param deltaTime - Segundos del tick (fijo ~1/30 en replay).
   * @param replayPitch - Pitch del input replayado (movimiento 3D en aire).
   */
  runTick(deltaTime: number, replayPitch?: number): void {
    if (replayPitch !== undefined) {
      this.replayPitch = replayPitch;
    }

    try {
      this.particleContext.update(deltaTime);
      this.condition.update(deltaTime);
      this.actionOrchestrator.update(deltaTime);
      this.movement.update(deltaTime);
    } finally {
      if (replayPitch !== undefined) {
        this.replayPitch = null;
      }
    }
  }
}
