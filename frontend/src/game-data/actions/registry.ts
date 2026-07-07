/**
 * @file Registro unificado de fichas de acción (habilidades).
 */

import { BODY_ACTIONS } from '@/game-data/actions/body-actions';
import {
  CONSTANT_DISPLACEMENT_ACTIONS,
  IMPULSE_DISPLACEMENT_ACTIONS,
} from '@/game-data/actions/constant-displacements';
import type { ActionDefinition } from '@/types/action';

/** Export `ALL_ACTIONS` — all_actions. */
export const ALL_ACTIONS: readonly ActionDefinition[] = [
  ...CONSTANT_DISPLACEMENT_ACTIONS,
  ...IMPULSE_DISPLACEMENT_ACTIONS,
  ...BODY_ACTIONS,
];

const BY_ID = new Map(ALL_ACTIONS.map((a) => [a.id, a]));

/** Export `getActionById` — get action by id. */
export function getActionById(id: string): ActionDefinition | undefined {
  return BY_ID.get(id);
}
