/**
 * @file Fichas corporales — datos en ``shared/game-data/actions/body-actions.json``.
 */

import type { ActionDefinition } from '@/types/action';
import bodyData from '@shared/actions/body-actions.json';

/** Export `BODY_ACTIONS` — body_actions. */
export const BODY_ACTIONS = bodyData.actions as unknown as readonly ActionDefinition[];
