-- Funciones helper para el sistema de núcleo y partículas
SET search_path TO juego_dioses, public;

-- Función para verificar si dos partículas son adyacentes
CREATE OR REPLACE FUNCTION particulas_adyacentes(
    x1 INTEGER, y1 INTEGER, z1 INTEGER,
    x2 INTEGER, y2 INTEGER, z2 INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        (ABS(x1 - x2) = 1 AND y1 = y2 AND z1 = z2) OR
        (x1 = x2 AND ABS(y1 - y2) = 1 AND z1 = z2) OR
        (x1 = x2 AND y1 = y2 AND ABS(z1 - z2) = 1)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para verificar si el núcleo está conectado
CREATE OR REPLACE FUNCTION verificar_nucleo_conectado(
    p_agrupacion_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_tiene_nucleo BOOLEAN;
    v_particulas_nucleo INTEGER;
    v_particulas_totales INTEGER;
    v_particulas_conectadas INTEGER;
BEGIN
    SELECT tiene_nucleo INTO v_tiene_nucleo
    FROM agrupaciones
    WHERE id = p_agrupacion_id;
    
    IF NOT v_tiene_nucleo THEN
        RETURN true;
    END IF;
    
    SELECT COUNT(*) INTO v_particulas_nucleo
    FROM particulas
    WHERE agrupacion_id = p_agrupacion_id
      AND es_nucleo = true
      AND extraida = false;
    
    IF v_particulas_nucleo = 0 THEN
        RETURN false;
    END IF;
    
    SELECT COUNT(*) INTO v_particulas_totales
    FROM particulas
    WHERE agrupacion_id = p_agrupacion_id
      AND extraida = false;
    
    IF v_particulas_totales = v_particulas_nucleo THEN
        RETURN true;
    END IF;
    
    SELECT COUNT(*) INTO v_particulas_conectadas
    FROM particulas p1
    JOIN particulas p2 ON p1.agrupacion_id = p2.agrupacion_id
    WHERE p1.agrupacion_id = p_agrupacion_id
      AND p1.es_nucleo = true
      AND p1.extraida = false
      AND p2.es_nucleo = false
      AND p2.extraida = false
      AND particulas_adyacentes(
          p1.celda_x, p1.celda_y, p1.celda_z,
          p2.celda_x, p2.celda_y, p2.celda_z
      );
    
    RETURN v_particulas_conectadas > 0;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar y actualizar estado del núcleo
CREATE OR REPLACE FUNCTION verificar_y_actualizar_nucleo(
    p_agrupacion_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_conectado BOOLEAN;
BEGIN
    v_conectado := verificar_nucleo_conectado(p_agrupacion_id);
    
    IF NOT v_conectado THEN
        UPDATE agrupaciones
        SET activa = false,
            salud = 0.0,
            nucleo_conectado = false,
            ultima_verificacion_nucleo = NOW(),
            modificado_en = NOW()
        WHERE id = p_agrupacion_id;
        
        RETURN false;
    ELSE
        UPDATE agrupaciones
        SET nucleo_conectado = true,
            ultima_verificacion_nucleo = NOW(),
            modificado_en = NOW()
        WHERE id = p_agrupacion_id;
        
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Funciones helper creadas correctamente';
END $$;

