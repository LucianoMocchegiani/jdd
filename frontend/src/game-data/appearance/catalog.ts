/**
 * @file Duraciones de clips — ``shared/game-data/appearance/catalog.json``.
 */

import appearanceData from '@shared/appearance/catalog.json';

/** Export `AnimationClipEntry` — animation clip entry. */
export interface AnimationClipEntry {
  durationMs: number;
}

/** Export `ANIMATION_CATALOG` — animation_catalog. */
export const ANIMATION_CATALOG: Record<string, AnimationClipEntry> = appearanceData.clips;

/** Export `getActionDurationMs` — get action duration ms. */
export function getActionDurationMs(actionId: string): number {
  return ANIMATION_CATALOG[actionId]?.durationMs ?? appearanceData.defaultDurationMs;
}

/** Export `isKnownClip` — is known clip. */
export function isKnownClip(clip: string): boolean {
  return clip in ANIMATION_CATALOG;
}
