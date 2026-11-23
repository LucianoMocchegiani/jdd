function defaults(): Loadout[] {
  return Array.from({ length: LOADOUT_KEYS.length }, () => CONTROL_SLOTS.map((_, index) => BODY_ACTIONS[index]?.id ?? null));
}