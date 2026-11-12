// --- Combate ---
export interface ProjectileStateEvent {
  type: 'projectile_state';
  id: string;
  owner_id: string;
  action_id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
}
export type CombatServerEvent = SwingResultEvent | SwingErrorEvent | ProjectileStateEvent;
export type WorldEvent = ParticleDestroyedEvent | TerrainWsEvent;
export type SessionEvent = PresenceEvent | CombatServerEvent | InputErrorEvent;
export type RealtimeInboundMessage = WorldEvent | SessionEvent;

/** `WorldCommand` — comandos cliente a servidor. */
export type WorldCommand = JoinBlockCommand | PrepareJoinCommand | ActivatePlayerCommand | InputCommand | SwingCommand;
