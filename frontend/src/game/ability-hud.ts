const actionName = (id: string): string => id === 'attack' ? 'Ataque'
  : id === 'golpe_pesado' ? 'Golpe pesado'
    : id === 'esfera_rapida' ? 'Esfera rápida'
      : id === 'kamehameha' ? 'Kamehameha'
    : id === 'rayo_de_ki' ? 'Rayo de Ki'
      : id === 'aura_de_ki' ? 'Aura de Ki'
        : id === 'orbe_explosivo' ? 'Orbe explosivo'
          : id === 'trueno' ? 'Trueno' : id.replaceAll('_', ' ');