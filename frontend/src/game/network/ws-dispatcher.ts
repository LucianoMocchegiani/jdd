      medium: typeof msg.medium === 'string' ? msg.medium : 'ground',
      dominant_particle: typeof msg.dominant_particle === 'string' ? msg.dominant_particle : undefined,
      conditions: Array.isArray(msg.conditions) ? msg.conditions.filter((id): id is string => typeof id === 'string') : undefined,
      condition_damage_total: typeof msg.condition_damage_total === 'number' && Number.isFinite(msg.condition_damage_total) ? msg.condition_damage_total : undefined,
