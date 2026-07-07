-- Script de inicialización de la base de datos
-- Este script se ejecuta automáticamente al crear el contenedor de PostgreSQL

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas de texto

-- Crear esquema principal
CREATE SCHEMA IF NOT EXISTS juego_dioses;

-- Cambiar al esquema
SET search_path TO juego_dioses, public;

-- Tabla de Bloques (configuración de mundos/dimensiones)
CREATE TABLE IF NOT EXISTS bloques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) DEFAULT 'Mundo Inicial',
    
    -- Límites horizontales (X, Y) en METROS
    ancho_metros DECIMAL(10,2) DEFAULT 1.0,
    alto_metros DECIMAL(10,2) DEFAULT 1.0,
    
    -- Límites verticales (Z) en CELDAS
    profundidad_maxima INTEGER DEFAULT -100,
    altura_maxima INTEGER DEFAULT 100,
    
    -- Tamaño de celda en METROS
    tamano_celda DECIMAL(5,2) DEFAULT 0.25,
    
    -- Posición del origen
    origen_x DECIMAL(10,2) DEFAULT 0.0,
    origen_y DECIMAL(10,2) DEFAULT 0.0,
    origen_z INTEGER DEFAULT 0,
    
    -- ===== CONFIGURACIÓN DE BLOQUES =====
    tamano_bloque INTEGER NOT NULL DEFAULT 40,  -- Tamaño de bloque (40x40x40 celdas = 64,000 celdas por bloque)
    
    -- Metadatos
    creado_por UUID,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bloques_creado ON bloques(creado_en);

-- Comentario para documentar el campo tamano_bloque
COMMENT ON COLUMN juego_dioses.bloques.tamano_bloque IS 
'Tamaño de bloque en celdas (40x40x40 = 64,000 celdas por bloque). Se usa para dividir el mundo en zonas para temperatura, renderizado y comunicación.';

-- Tabla de Tipos de Partículas
CREATE TABLE IF NOT EXISTS tipos_particulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    
    -- Tipo físico (determina qué propiedades usar)
    tipo_fisico VARCHAR(50) NOT NULL DEFAULT 'solido',  -- 'solido', 'liquido', 'gas', 'energia'
    
    -- ===== PROPIEDADES COMUNES (Todos los tipos) =====
    densidad DECIMAL(3,2) DEFAULT 1.0,              -- 0.0 a 10.0 (0 = no gravedad)
    conductividad_termica DECIMAL(3,2) DEFAULT 1.0, -- 0.0 a 10.0 (propagación de calor)
    inercia_termica DECIMAL(3,2) DEFAULT 1.0,       -- 0.0 a 10.0 (resistencia al cambio de temperatura)
                                                    -- NOTA: También conocido como "calor específico" en física.
                                                    -- Valores altos = cambia temperatura lentamente (agua: ~4.0)
                                                    -- Valores bajos = cambia temperatura rápidamente (metal: ~0.5)
                                                    -- Se usa igual para calentar y enfriar.
    opacidad DECIMAL(3,2) DEFAULT 1.0,             -- 0.0 (transparente) a 1.0 (opaco)
    albedo DECIMAL(3,2) DEFAULT 0.2,               -- 0.0 a 1.0 (reflexión de luz: 0.0 = absorbe todo, 1.0 = refleja todo)
                                                    -- Usado para cálculos de temperatura ambiental
    color VARCHAR(50),
    geometria JSONB DEFAULT '{"tipo": "box"}',
    
    -- ===== PROPIEDADES ELÉCTRICAS Y MAGNÉTICAS (Todos los tipos) =====
    conductividad_electrica DECIMAL(3,2) DEFAULT 0.0, -- 0.0 a 10.0 (capacidad de conducir electricidad)
    magnetismo DECIMAL(3,2) DEFAULT 0.0,            -- 0.0 a 10.0 (fuerza magnética)
    
    -- ===== PROPIEDADES DE SÓLIDOS =====
    -- (Usar solo si tipo_fisico = 'solido', NULL si no es sólido)
    dureza DECIMAL(3,2),              -- 0.0 a 10.0 (resistencia a rayar/deformar)
    fragilidad DECIMAL(3,2),          -- 0.0 a 10.0 (tendencia a romperse)
    elasticidad DECIMAL(3,2),         -- 0.0 a 10.0 (coeficiente de rebote)
    punto_fusion DECIMAL(10,2),       -- Temperatura en °C (NULL si no se derrite)
    
    -- ===== PROPIEDADES DE LÍQUIDOS =====
    -- (Usar solo si tipo_fisico = 'liquido', NULL si no es líquido)
    viscosidad DECIMAL(3,2),          -- 0.0 a 10.0 (0 = no fluye, 10 = muy viscoso)
    punto_ebullicion DECIMAL(10,2),   -- Temperatura en °C (NULL si no se evapora)
    
    -- ===== PROPIEDADES DE GASES/ENERGÍA =====
    -- (Usar solo si tipo_fisico = 'gas' o 'energia', NULL si no es gas/energía)
    propagacion DECIMAL(3,2),         -- 0.0 a 10.0 (velocidad/radio de propagación)
    
    -- Propiedades avanzadas (opcionales)
    propiedades_fisicas JSONB DEFAULT '{}',
    
    -- Metadatos
    descripcion TEXT,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_tipos_particulas_nombre ON tipos_particulas(nombre);
CREATE INDEX IF NOT EXISTS idx_tipos_particulas_tipo_fisico ON tipos_particulas(tipo_fisico);
CREATE INDEX IF NOT EXISTS idx_tipos_particulas_conductividad_electrica 
ON tipos_particulas(conductividad_electrica) WHERE conductividad_electrica > 0;

-- Índices parciales para campos condicionales (optimización para campos NULL)
CREATE INDEX IF NOT EXISTS idx_solidos_dureza ON tipos_particulas(dureza) 
WHERE tipo_fisico = 'solido' AND dureza IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solidos_fragilidad ON tipos_particulas(fragilidad) 
WHERE tipo_fisico = 'solido' AND fragilidad IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_liquidos_viscosidad ON tipos_particulas(viscosidad) 
WHERE tipo_fisico = 'liquido' AND viscosidad IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gases_propagacion ON tipos_particulas(propagacion) 
WHERE tipo_fisico IN ('gas', 'energia') AND propagacion IS NOT NULL;

-- Tabla de Transiciones de Partículas
CREATE TABLE IF NOT EXISTS transiciones_particulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tipos de partícula
    tipo_origen_id UUID NOT NULL REFERENCES tipos_particulas(id) ON DELETE CASCADE,
    tipo_destino_id UUID NOT NULL REFERENCES tipos_particulas(id) ON DELETE CASCADE,
    
    -- Condición de temperatura
    condicion_temperatura VARCHAR(10),  -- 'mayor', 'menor', 'igual', NULL si no aplica
    valor_temperatura DECIMAL(10,2),    -- Valor de temperatura en °C
    
    -- Condición de integridad
    condicion_integridad VARCHAR(10),    -- 'mayor', 'menor', 'igual', NULL si no aplica
    valor_integridad DECIMAL(3,2),      -- Valor de integridad (0.0-1.0)
    
    -- Prioridad (mayor = más importante, se evalúa primero)
    prioridad INTEGER DEFAULT 0,
    
    -- Estado
    activa BOOLEAN DEFAULT true,
    reversible BOOLEAN DEFAULT true,     -- Si puede revertirse al tipo original
    
    -- Histeresis (para evitar oscilaciones en transiciones reversibles)
    histeresis DECIMAL(10,2) DEFAULT 5.0,  -- Diferencia necesaria para revertir
    
    -- Metadatos
    descripcion TEXT,
    creado_en TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CHECK (condicion_temperatura IN ('mayor', 'menor', 'igual', NULL)),
    CHECK (condicion_integridad IN ('mayor', 'menor', 'igual', NULL))
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_transiciones_origen ON transiciones_particulas(tipo_origen_id);
CREATE INDEX IF NOT EXISTS idx_transiciones_destino ON transiciones_particulas(tipo_destino_id);
CREATE INDEX IF NOT EXISTS idx_transiciones_activa ON transiciones_particulas(activa) WHERE activa = true;
CREATE INDEX IF NOT EXISTS idx_transiciones_prioridad ON transiciones_particulas(tipo_origen_id, prioridad DESC) WHERE activa = true;

-- Tabla de Estados de Materia
CREATE TABLE IF NOT EXISTS estados_materia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    tipo_fisica VARCHAR(50),
    viscosidad DECIMAL(10,4),
    densidad_estado DECIMAL(10,4),
    gravedad BOOLEAN DEFAULT true,
    flujo BOOLEAN DEFAULT false,
    propagacion BOOLEAN DEFAULT false,
    descripcion TEXT,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estados_materia_nombre ON estados_materia(nombre);
CREATE INDEX IF NOT EXISTS idx_estados_materia_tipo ON estados_materia(tipo_fisica);

-- Tabla de Partículas
CREATE TABLE IF NOT EXISTS particulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bloque_id UUID NOT NULL REFERENCES bloques(id) ON DELETE CASCADE,
    
    -- Posición 3D
    celda_x INTEGER NOT NULL,
    celda_y INTEGER NOT NULL,
    celda_z INTEGER NOT NULL,
    
    -- Tipo y estado
    tipo_particula_id UUID NOT NULL REFERENCES tipos_particulas(id),
    estado_materia_id UUID NOT NULL REFERENCES estados_materia(id),
    
    -- Propiedades dinámicas
    temperatura DECIMAL(10,2) DEFAULT 20.0,        -- Temperatura en °C
    integridad DECIMAL(3,2) DEFAULT 1.0,          -- 0.0 a 1.0 (vida/durabilidad de la partícula)
    carga_electrica DECIMAL(5,2) DEFAULT 0.0,      -- Carga eléctrica actual (-100.0 a +100.0)
    
    -- Propiedades adicionales (mantenidas para compatibilidad)
    cantidad DECIMAL(10,4) DEFAULT 1.0,
    energia DECIMAL(10,4) DEFAULT 0.0,
    extraida BOOLEAN DEFAULT false,
    
    -- Agrupación
    agrupacion_id UUID,
    es_nucleo BOOLEAN DEFAULT false,
    
    -- Propiedades especiales
    propiedades JSONB DEFAULT '{}',
    
    -- Metadatos
    creado_por UUID,
    creado_en TIMESTAMP DEFAULT NOW(),
    modificado_en TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(bloque_id, celda_x, celda_y, celda_z)
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_particulas_bloque ON particulas(bloque_id);
CREATE INDEX IF NOT EXISTS idx_particulas_tipo ON particulas(tipo_particula_id);
CREATE INDEX IF NOT EXISTS idx_particulas_estado ON particulas(estado_materia_id);
CREATE INDEX IF NOT EXISTS idx_particulas_agrupacion ON particulas(agrupacion_id);
CREATE INDEX IF NOT EXISTS idx_particulas_nucleo ON particulas(agrupacion_id, es_nucleo) WHERE es_nucleo = true;
CREATE INDEX IF NOT EXISTS idx_particulas_posicion ON particulas(bloque_id, celda_x, celda_y, celda_z);
CREATE INDEX IF NOT EXISTS idx_particulas_z ON particulas(bloque_id, celda_z);
CREATE INDEX IF NOT EXISTS idx_particulas_temperatura ON particulas(temperatura);
CREATE INDEX IF NOT EXISTS idx_particulas_integridad 
ON particulas(integridad) WHERE integridad < 1.0;
CREATE INDEX IF NOT EXISTS idx_particulas_carga_electrica 
ON particulas(carga_electrica) WHERE ABS(carga_electrica) > 0;

-- Tabla de Agrupaciones
CREATE TABLE IF NOT EXISTS agrupaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bloque_id UUID NOT NULL REFERENCES bloques(id) ON DELETE CASCADE,
    
    -- Identificación
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    especie VARCHAR(100),
    
    -- Posición aproximada
    posicion_x INTEGER,
    posicion_y INTEGER,
    posicion_z INTEGER,
    
    -- Estado
    activa BOOLEAN DEFAULT true,
    salud DECIMAL(10,4) DEFAULT 100.0,
    
    -- Sistema de Núcleo
    tiene_nucleo BOOLEAN DEFAULT false,
    nucleo_conectado BOOLEAN DEFAULT true,
    ultima_verificacion_nucleo TIMESTAMP,
    
    -- Geometría especializada de la agrupación
    geometria_agrupacion JSONB DEFAULT '{}'::jsonb,
    
    -- Modelo 3D asociado a la agrupación
    modelo_3d JSONB,
    
    -- Metadatos
    creado_por UUID,
    creado_en TIMESTAMP DEFAULT NOW(),
    modificado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agrupaciones_bloque ON agrupaciones(bloque_id);
CREATE INDEX IF NOT EXISTS idx_agrupaciones_tipo ON agrupaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_agrupaciones_bloque_tipo ON agrupaciones(bloque_id, tipo);
CREATE INDEX IF NOT EXISTS idx_agrupaciones_nombre ON agrupaciones(nombre);
CREATE INDEX IF NOT EXISTS idx_agrupaciones_especie ON agrupaciones(especie);
CREATE INDEX IF NOT EXISTS idx_agrupaciones_geometria ON agrupaciones USING GIN (geometria_agrupacion);
CREATE INDEX IF NOT EXISTS idx_agrupaciones_modelo_3d ON agrupaciones USING GIN (modelo_3d);

-- Agregar foreign key de agrupacion_id en particulas
ALTER TABLE particulas 
ADD CONSTRAINT fk_particulas_agrupacion 
FOREIGN KEY (agrupacion_id) REFERENCES agrupaciones(id) ON DELETE SET NULL;

-- Comentario para documentar el campo geometria_agrupacion
COMMENT ON COLUMN juego_dioses.agrupaciones.geometria_agrupacion IS 
'Definición de geometría para la agrupación completa en formato JSONB. Estructura:
{
  "tipo": "arbol|animal|construccion|...",
  "partes": {
    "parte_nombre": {
      "geometria": {
        "tipo": "box|sphere|cylinder|cone|torus|custom",
        "parametros": {
          // Parámetros relativos a tamano_celda según tipo de geometría
          // box: {width, height, depth}
          // sphere: {radius, segments}
          // cylinder: {radiusTop, radiusBottom, height, segments}
          // cone: {radius, height, segments}
          // torus: {radius, tube, segments}
        }
      },
      "offset": {"x": 0, "y": 0, "z": 0},
      "rotacion": {"x": 0, "y": 0, "z": 0}
    }
  }
}
Los parámetros son RELATIVOS a tamano_celda de la dimensión.
Tamaño absoluto = parametro × tamano_celda × escala';

-- Comentario para documentar el campo modelo_3d
COMMENT ON COLUMN juego_dioses.agrupaciones.modelo_3d IS 
'Modelo 3D asociado a la agrupación. Formato JSON:
{
  "tipo": "gltf|glb|obj",
  "ruta": "biped/male/characters/biped_male.glb",
  "escala": 1.0,
  "offset": {"x": 0, "y": 0, "z": 0},
  "rotacion": {"x": 0, "y": 0, "z": 0}
}
El modelo se almacena en backend/static/models/ y se sirve en /static/models/{ruta}.
Estructura recomendada: {tipo_entidad}/{variante}/{categoria}/{nombre}.glb (ej: biped/male/characters/biped_male.glb)
Si este campo está presente, el frontend debe cargar el modelo 3D en lugar de usar geometria_agrupacion.';

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Esquema de base de datos inicializado correctamente';
END $$;

