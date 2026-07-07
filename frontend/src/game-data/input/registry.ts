/**
 * @file Intents — ``shared/game-data/input/intents.json``.
 */

import intentData from '@shared/input/intents.json';

/** Export `INPUT_INTENTS` — input_intents. */
export const INPUT_INTENTS = [...intentData.inputIntents] as const;

/** Export `InputIntent` — input intent. */
export type InputIntent = (typeof INPUT_INTENTS)[number];

/** Export `DERIVED_INTENTS` — derived_intents. */
export const DERIVED_INTENTS = [...intentData.derivedIntents] as const;

/** Export `DerivedIntent` — derived intent. */
export type DerivedIntent = (typeof DERIVED_INTENTS)[number];

/** Export `AnyIntent` — any intent. */
export type AnyIntent = InputIntent | DerivedIntent;

const INTENT_SET = new Set<string>([...INPUT_INTENTS, ...DERIVED_INTENTS]);

/** Export `REGISTERED_INPUT_INTENTS` — registered_input_intents. */
export const REGISTERED_INPUT_INTENTS = INPUT_INTENTS;

/** Export `isRegisteredInputIntent` — is registered input intent. */
export function isRegisteredInputIntent(intent: string): boolean {
  return INTENT_SET.has(intent);
}
