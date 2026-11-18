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
/** Configuración de la geometría de impacto en unidades del mundo. */
export interface ActionImpact {
  shape?: 'line' | 'radial';
  reach?: number;
  width?: number;
  radius?: number;
  damage?: number;
  entityDamage?: ActionDamage;
  applyConditions?: readonly ConditionApplyRef[];
}
/** Configuración de un cast en punto objetivo; el cliente solo la presenta, el servidor valida y aplica el daño. */
export interface ActionArea { range: number; radius: number; damage: number; effect: 'orb' | 'thunder'; }
export interface ActionProjectile { speed: number; range: number; damage: number; radius: number; delayMs?: number; }
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
  area?: ActionArea;
  projectile?: ActionProjectile;
}
