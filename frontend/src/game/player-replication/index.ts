/**
 * @file Reexportaciones de presentación de estado replicado de jugadores.
 */

export { RemotePresence } from '@/game/player-replication/remote-presence';
export {
  PlayerSnapshotBuffer,
  PLAYER_INTERPOLATION_DELAY_SEC,
  PLAYER_MAX_EXTRAPOLATION_SEC,
  PLAYER_SNAPSHOT_BUFFER_SIZE,
  lerpAngle,
} from '@/game/player-replication/snapshot-interpolation';
export type { PlayerRenderState, PlayerSnapshot } from '@/types/player-snapshot';
