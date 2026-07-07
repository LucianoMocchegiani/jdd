# Base de Datos - Juego de Dioses

Este directorio contiene el schema inicial, seeds, funciones y migraciones de la base de datos PostgreSQL.

## Estructura

```
database/
├── init/                    # Scripts de inicialización (ejecutados al crear el contenedor)
│   ├── 01-init-schema.sql   # Schema inicial completo (sin migraciones)
│   ├── 02-seed-data.sql     # Datos iniciales (tipos de partículas, estados, etc.)
│   ├── 03-functions.sql     # Funciones SQL personalizadas
│   └── VERIFICACION-SCHEMA.md  # Verificación del schema (JDG-038)
├── migrations/              # Migraciones históricas (ver README.md en esta carpeta)
│   └── add_modelo_3d_to_agrupaciones.sql
└── README.md               # Este archivo
```

## Schema Inicial

### Archivo: `init/01-init-schema.sql`

**⚠️ IMPORTANTE**: Este script se ejecuta automáticamente al crear el contenedor de PostgreSQL. Al reconstruir Docker, se perderán todos los datos existentes.

**Orden de creación**:
1. Extensiones (`uuid-ossp`, `pg_trgm`)
2. Esquema (`juego_dioses`)
3. Tabla `bloques` (configuración de mundos/dimensiones)
4. Tabla `tipos_particulas` (tipos físicos de partículas)
5. Tabla `transiciones_particulas` (transiciones de estado)
6. Tabla `estados_materia` (estados físicos)
7. Tabla `particulas` (partículas del mundo)
8. Tabla `agrupaciones` (agrupaciones de partículas)
9. Foreign keys adicionales
10. Índices y comentarios

### Tablas Principales

#### `bloques`
Configuración de mundos/dimensiones. Define:
- Límites del mundo (ancho, alto, profundidad, altura)
- Tamaño de celda en metros
- **`tamano_bloque`**: Tamaño de bloque espacial (40x40x40 celdas por defecto)

#### `tipos_particulas`
Tipos físicos de partículas con propiedades:
- **Comunes**: `densidad`, `conductividad_termica`, `inercia_termica`, `opacidad`, `color`
- **Eléctricas/Magnéticas**: `conductividad_electrica`, `magnetismo`
- **Específicas por tipo**:
  - Sólidos: `dureza`, `fragilidad`, `elasticidad`, `punto_fusion`
  - Líquidos: `viscosidad`, `punto_ebullicion`
  - Gases/Energía: `propagacion`

#### `particulas`
Partículas individuales en el mundo:
- Posición 3D (`celda_x`, `celda_y`, `celda_z`)
- Propiedades dinámicas: `temperatura`, `integridad`, `carga_electrica`
- Referencias: `bloque_id`, `tipo_particula_id`, `estado_materia_id`
- Soporte para agrupaciones: `agrupacion_id`, `es_nucleo`

#### `transiciones_particulas`
Transiciones de estado entre tipos de partículas:
- Condiciones: temperatura e integridad
- Prioridad y histeresis
- Soporte para transiciones reversibles

#### `agrupaciones`
Agrupaciones de partículas (árboles, animales, construcciones):
- Geometría especializada (`geometria_agrupacion`)
- Modelos 3D (`modelo_3d`)
- Sistema de núcleo para conectividad

## Cambios Recientes (JDG-038)

### Renombrado de `dimensiones` a `bloques`
- ✅ Todas las referencias a `dimensiones` fueron reemplazadas por `bloques`
- ✅ `particulas.dimension_id` → `particulas.bloque_id`
- ✅ `agrupaciones.dimension_id` → `agrupaciones.bloque_id`

### Nuevos Campos

**`tipos_particulas`**:
- ✅ `inercia_termica` (antes `calor_especifico`)
- ✅ `conductividad_electrica`
- ✅ `magnetismo`

**`particulas`**:
- ✅ `integridad` (0.0-1.0, vida/durabilidad)
- ✅ `carga_electrica` (-100.0 a +100.0)

**`bloques`**:
- ✅ `tamano_bloque` (40x40x40 celdas por defecto)

**`transiciones_particulas`**:
- ✅ `condicion_integridad`
- ✅ `valor_integridad`
- ✅ `prioridad`

## Verificación del Schema

Ver `init/VERIFICACION-SCHEMA.md` para verificación completa del schema inicial.

## Uso

### Reconstruir Base de Datos

```bash
# Detener y eliminar contenedores y volúmenes
docker-compose down -v

# Reconstruir (ejecutará automáticamente 01-init-schema.sql)
docker-compose up -d postgres

# Verificar que el schema se creó correctamente
docker-compose exec postgres psql -U juegodioses -d juego_dioses -c "\d bloques"
docker-compose exec postgres psql -U juegodioses -d juego_dioses -c "\d particulas"
docker-compose exec postgres psql -U juegodioses -d juego_dioses -c "\d tipos_particulas"
```

### Ejecutar Seeds

```bash
# Los seeds se ejecutan automáticamente si están en init/
# O manualmente:
docker-compose exec postgres psql -U juegodioses -d juego_dioses -f /docker-entrypoint-initdb.d/02-seed-data.sql
```

## Índices

El schema incluye índices optimizados para:
- Búsquedas por nombre (`tipos_particulas.nombre`, `estados_materia.nombre`)
- Búsquedas por tipo (`tipos_particulas.tipo_fisico`)
- Búsquedas espaciales (`particulas.bloque_id`, `particulas.celda_x/y/z`)
- Búsquedas por propiedades (`particulas.temperatura`, `particulas.integridad`)
- Índices parciales para optimizar consultas de partículas con propiedades anómalas

## Referencias

- **Diseño del sistema de partículas**: `Juego de Dioses/Ideas/29-Diseno-Final-Particulas.md`
- **Sistema de bloques**: `Juego de Dioses/Ideas/36-Sistema-Bloques-Unificado.md`
- **Modelos Pydantic**: `backend/src/models/README.md`
- **Servicios**: `backend/src/services/README.md`
- **Verificación del schema**: `database/init/VERIFICACION-SCHEMA.md`

## Notas Importantes

- ⚠️ **No usar migraciones**: Todos los cambios se hacen directamente en `01-init-schema.sql`
- ⚠️ **Reconstruir Docker**: Al cambiar el schema, reconstruir Docker eliminará todos los datos
- ✅ **Consultas parametrizadas**: Siempre usar consultas parametrizadas en el código
- ✅ **Esquema explícito**: Usar `juego_dioses.` en consultas cuando sea necesario

