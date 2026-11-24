import type { ConditionApplyRef } from '@/types/condition';
import type { Medium } from '@/types/medium';

export type ActionSlot = 'constant_displacements' | 'impulse_displacements' | 'body_actions' | 'full_body_action';
export type ActionType = 'sustained' | 'one_shot';
export interface ActionWhen {
  medium?: Medium | Medium[];
  conditions?: readonly string[];
  not?: { medium?: Medium | Medium[]; conditions?: readonly string[] };
}
export interface ActionMovement { speedMultiplier?: number; impulseZ?: number; preserveVelocityXY?: boolean; }
export interface ActionInterrupt { blocks?: readonly string[]; canBeInterruptedBy?: readonly string[]; }
export interface ActionControl { inputIntent: string; slot: ActionSlot; type: ActionType; when?: ActionWhen; interrupt?: ActionInterrupt; }
export interface ActionAppearance { state?: string; clip?: string; }
export interface ActionDamage { reach: number; damage: number; }
export interface ActionImpact {
  shape?: 'line' | 'radial' | 'swept_arc' | 'projectile';
  origin?: 'caster' | 'target';
  blockBySolids?: boolean;
  reach?: number;
  width?: number;
  radius?: number;
  sweepDegrees?: number;
  speed?: number;
  delayMs?: number;
  damage?: number;
  entityDamage?: ActionDamage;
  applyConditions?: readonly ConditionApplyRef[];
}
export interface ActionDefense { shape: 'cone'; absorption: number; durationMs: number; angleDegrees: number; }
export interface ActionTargeting { type: 'ground_point'; range: number; effect: 'orb' | 'thunder'; }
/** Definición compartida de una acción y sus datos de control, coste, presentación e impacto. */
export interface ActionDefinition {
  id: string;
  description?: string;
  cooldownMs?: number;
  manaCost?: number;
  manaCostPerSecond?: number;
  damageIntervalMs?: number;
  control: ActionControl;
  movement?: ActionMovement;
  appearance?: ActionAppearance;
  impact?: ActionImpact;
  defense?: ActionDefense;
  targeting?: ActionTargeting;
}
