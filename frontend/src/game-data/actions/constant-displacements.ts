/**
 * @file Fichas de desplazamiento — datos en ``shared/game-data/actions/constant-displacements.json``.
 */

import type { ActionDefinition } from '@/types/action';
import constantData from '@shared/actions/constant-displacements.json';

/** Export `CONSTANT_DISPLACEMENT_ACTION_ORDER` — constant_displacement_action_order. */
export const CONSTANT_DISPLACEMENT_ACTION_ORDER = [
  ...constantData.constantDisplacementOrder,
] as const;

/** Export `CONSTANT_DISPLACEMENT_ACTIONS` — constant_displacement_actions. */
export const CONSTANT_DISPLACEMENT_ACTIONS = constantData.actions as unknown as readonly ActionDefinition[];

/** Export `IMPULSE_DISPLACEMENT_ACTIONS` — impulse_displacement_actions. */
export const IMPULSE_DISPLACEMENT_ACTIONS =
  constantData.impulseActions as unknown as readonly ActionDefinition[];
