export interface PlayerStateEvent {
  type: 'player_state';
  server_tick: number;
  player_id: string;
  bloque_id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number;
  pitch?: number;
  medium: string;
  dominant_particle?: string;
  conditions?: string[];
  condition_damage_total?: number;
  action_id?: string;
  action_seq?: number;
  action_t0_ms?: number;
  entity_id?: number;
  intents?: Record<string, true>;
  input_seq?: number;
  health?: number;
  max_health?: number;
  mana?: number;
  max_mana?: number;
  in_combat?: boolean;
  receivedAtMs?: number;
}
