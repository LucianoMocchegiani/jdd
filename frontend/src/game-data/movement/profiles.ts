/**
 * @file Perfiles por medio — ``shared/game-data/movement/``.
 */

import movementConstants from '@shared/movement/constants.json';
import profilesData from '@shared/movement/profiles.json';
import type { Medium } from '@/types/medium';

/** Export `MediumMovementProfile` — medium movement profile. */
export interface MediumMovementProfile {
  moveSpeedMultiplier: number;
  gravityMultiplier: number;
  buoyancy: number;
  verticalDrag: number;
}

/** Export `MEDIUM_MOVEMENT_PROFILES` — medium_movement_profiles. */
export const MEDIUM_MOVEMENT_PROFILES = profilesData.profiles as Record<
  Medium,
  MediumMovementProfile
>;

/** Export `PLAYER_MOVE_SPEED_CELLS` — player_move_speed_cells. */
export const PLAYER_MOVE_SPEED_CELLS = movementConstants.playerMoveSpeedCells;
/** Export `GRAVITY_CELLS` — gravity_cells. */
export const GRAVITY_CELLS = movementConstants.gravityCells;

/** Export `viscosityMoveMultiplier` — viscosity move multiplier. */
export function viscosityMoveMultiplier(viscosidad: number | null): number {
  if (viscosidad == null || viscosidad <= 0) {
    return 1;
  }
  return Math.max(0.2, 1 - viscosidad / 90);
}

/** Export `baseMoveSpeedCells` — base move speed cells. */
export function baseMoveSpeedCells(medium: Medium, viscosidad: number | null): number {
  const profile = MEDIUM_MOVEMENT_PROFILES[medium];
  return PLAYER_MOVE_SPEED_CELLS * profile.moveSpeedMultiplier * viscosityMoveMultiplier(viscosidad);
}

/** Export `effectiveGravityZ` — effective gravity z. */
export function effectiveGravityZ(medium: Medium): number {
  return GRAVITY_CELLS * MEDIUM_MOVEMENT_PROFILES[medium].gravityMultiplier;
}
