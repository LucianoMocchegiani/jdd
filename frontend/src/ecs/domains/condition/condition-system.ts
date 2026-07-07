/**
 * @file Expira condiciones, contacto de partícula y ticks (fase 8).
 */

import { getConditionById } from '@/game-data/conditions';
import { ConditionsComponent } from '@/ecs/components/conditions';
import { ContactComponent } from '@/ecs/components/contact';
import { System } from '@/ecs/core';
import { applyConditionRefs } from '@/ecs/domains/condition/apply-condition';
import { resolveContactRule } from '@/game-data/particles/registry';
import type { TerrainStore } from '@/game/terrain/terrain-store';

/**
 * Prioridad 11: tras {@link ParticleContextSystem}, antes del orquestador de acciones.
 */
export class ConditionSystem extends System {
  readonly priority = 11;
  readonly requiredComponents = ['contact', 'conditions'] as const;

  constructor(private readonly terrain: TerrainStore) {
    super();
  }

  override update(_deltaTime: number): void {
    const nowMs = performance.now();
    const typesByNombre = this.terrain.getTypesByNombre();

    for (const entityId of this.getEntities()) {
      const contact = this.world?.getComponent<ContactComponent>(entityId, 'contact');
      const conditions = this.world?.getComponent<ConditionsComponent>(entityId, 'conditions');
      if (!contact || !conditions || !this.world) {
        continue;
      }

      conditions.active = conditions.active.filter(
        (c) => c.expiresAtMs == null || c.expiresAtMs > nowMs,
      );

      const tipo = contact.dominantTipoNombre;
      if (tipo) {
        const particleType = typesByNombre.get(tipo);
        if (particleType) {
          const rule = resolveContactRule(particleType);
          if (tipo !== conditions.lastContactTipoNombre) {
            applyConditionRefs(this.world, entityId, rule.conditions?.onEnter, nowMs);
            conditions.lastContactTipoNombre = tipo;
          }
          applyConditionRefs(this.world, entityId, rule.conditions?.onStay, nowMs);
        }
      } else if (tipo !== conditions.lastContactTipoNombre) {
        conditions.lastContactTipoNombre = null;
      }

      this.runConditionTicks(conditions, nowMs);
    }
  }

  private runConditionTicks(conditions: ConditionsComponent, nowMs: number): void {
    for (const inst of conditions.active) {
      const tick = getConditionById(inst.conditionId)?.effects?.tick;
      if (!tick?.damage) {
        continue;
      }
      const last = conditions.lastTickAtMs[inst.conditionId] ?? 0;
      if (nowMs - last < tick.intervalMs) {
        continue;
      }
      conditions.lastTickAtMs[inst.conditionId] = nowMs;
      const totalDamage = tick.damage * inst.stacks;
      conditions.debugDamageTotal += totalDamage;
    }
  }
}
