/**
 * @file Barrel: cliente WS, dispatch y terreno.
 */

export { WorldRealtimeClient } from '@/game/network/ws-client';
export {
  type WorldEventHandler,
  type SessionEventHandler,
  type WorldRealtimeHandlers,
} from '@/game/network/ws-dispatcher';
/** Re-export de símbolos del módulo. */
export { PresenceHandler } from '@/game/network/presence-handler';
/** Re-export de símbolos del módulo. */
export { NetworkInputSender } from '@/game/network/input-sender';

/** Re-export de símbolos del módulo. */
export { getOrCreatePlayerId } from '@/game/player/player-id';
export {
  InputHistory,
  LocalPlayerReconciler,
  RemotePresence,
  RemoteInterpolationBuffer,
  REMOTE_INTERPOLATION_DELAY_SEC,
  lerpAngle,
  isReconciliationEnabled,
} from '@/game/client-prediction';
