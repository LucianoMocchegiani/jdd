-- Terreno mínimo greenfield: plataforma bajo el spawn (~400,400) de "Mundo Inicial".
SET search_path TO juego_dioses, public;

INSERT INTO particulas (bloque_id, celda_x, celda_y, celda_z, tipo_particula_id, estado_materia_id)
SELECT
    b.id,
    x,
    y,
    z,
    tp.id,
    em.id
FROM bloques b
CROSS JOIN generate_series(385, 415) AS x
CROSS JOIN generate_series(385, 415) AS y
CROSS JOIN generate_series(0, 3) AS z
JOIN tipos_particulas tp ON tp.nombre = 'tierra'
JOIN estados_materia em ON em.nombre = 'solido'
WHERE b.nombre = 'Mundo Inicial'
ON CONFLICT (bloque_id, celda_x, celda_y, celda_z) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'Greenfield terrain seed: plataforma 385-415 @ z=0..3';
END $$;
