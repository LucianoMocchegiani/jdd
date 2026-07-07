-- Actualizar colores y geometrías de tipos de partículas
SET search_path TO juego_dioses, public;

-- Agua: azul, esfera, semi-transparente
UPDATE tipos_particulas 
SET color = '#4169E1', 
    geometria = '{"tipo": "sphere", "parametros": {"radius": 0.5, "segments": 16}}'::jsonb,
    opacidad = 0.6
WHERE nombre = 'agua';

-- Madera: marrón, cilindro
UPDATE tipos_particulas 
SET color = '#8B4513', 
    geometria = '{"tipo": "cylinder", "parametros": {"radiusTop": 0.4, "radiusBottom": 0.5, "height": 1.0, "segments": 8}}'::jsonb
WHERE nombre = 'madera';

-- Hierba: verde claro, caja
UPDATE tipos_particulas 
SET color = '#90EE90', 
    geometria = '{"tipo": "box"}'::jsonb
WHERE nombre = 'hierba';

-- Hojas: verde bosque, caja
UPDATE tipos_particulas 
SET color = '#228B22', 
    geometria = '{"tipo": "box"}'::jsonb
WHERE nombre = 'hojas';

-- Tierra: marrón, caja
UPDATE tipos_particulas 
SET color = '#8B4513', 
    geometria = '{"tipo": "box"}'::jsonb
WHERE nombre = 'tierra';

-- Piedra: gris oscuro, caja
UPDATE tipos_particulas 
SET color = '#696969', 
    geometria = '{"tipo": "box"}'::jsonb
WHERE nombre = 'piedra';

-- Hierba: verde más claro y distintivo
UPDATE tipos_particulas 
SET color = '#7CFC00', 
    geometria = '{"tipo": "box"}'::jsonb
WHERE nombre = 'hierba';

-- Hojas: verde más oscuro y distintivo
UPDATE tipos_particulas 
SET color = '#006400', 
    geometria = '{"tipo": "box"}'::jsonb
WHERE nombre = 'hojas';

