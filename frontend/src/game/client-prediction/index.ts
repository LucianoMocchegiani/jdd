/**
 * @file Reexportación del runtime de presencia remota.
 */

export { RemotePresence } from '@/game/client-prediction/remote-presence';
export {
  RemoteInterpolationBuffer,
  REMOTE_INTERPOLATION_DELAY_SEC,
  lerpAngle,
} from '@/game/client-prediction/remote-interpolation';
export type { RemoteRenderState, RemoteSnapshot } from '@/types/remote-player';
