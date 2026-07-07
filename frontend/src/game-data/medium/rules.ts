/**
 * @file Umbrales y orden de ``medium`` — ``shared/game-data/medium/rules.json``.
 */

import type { Medium } from '@/types/medium';
import mediumData from '@shared/medium/rules.json';

/** Export `MEDIUM_RULES` — medium_rules. */
export const MEDIUM_RULES = mediumData.rules as {
  readonly submergedFullRatio: number;
  readonly submergedPartialRatio: number;
  readonly groundSolidCellsMin: number;
};

/** Export `MEDIUM_RESOLUTION_ORDER` — medium_resolution_order. */
export const MEDIUM_RESOLUTION_ORDER = mediumData.resolutionOrder as readonly Medium[];
