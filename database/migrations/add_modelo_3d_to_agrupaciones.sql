-- Migración: Agregar campo modelo_3d a agrupaciones
-- Fecha: 2025-12-06
-- Ticket: JDG-012

-- Agregar campo modelo_3d JSONB a agrupaciones
ALTER TABLE juego_dioses.agrupaciones
ADD COLUMN IF NOT EXISTS modelo_3d JSONB;

-- Crear índice GIN para búsquedas rápidas en JSONB
CREATE INDEX IF NOT EXISTS idx_agrupaciones_modelo_3d 
ON juego_dioses.agrupaciones USING GIN (modelo_3d);

-- Comentario sobre el campo
COMMENT ON COLUMN juego_dioses.agrupaciones.modelo_3d IS 
'Modelo 3D asociado a la agrupación. Formato JSON: {"tipo": "gltf|glb|obj", "ruta": "characters/humano.glb", "escala": 1.0, "offset": {"x": 0, "y": 0, "z": 0}, "rotacion": {"x": 0, "y": 0, "z": 0}}';

