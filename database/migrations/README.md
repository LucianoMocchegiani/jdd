# Migraciones de Base de Datos

## ⚠️ IMPORTANTE: Política de Migraciones

**Este proyecto NO usa migraciones para cambios de schema.**

Todos los cambios al schema se hacen directamente en `database/init/01-init-schema.sql`. Al reconstruir Docker, el schema se crea desde cero.

## ¿Por qué no usar migraciones?

1. **Simplicidad**: El proyecto está en desarrollo activo, no en producción
2. **Reconstrucción frecuente**: Docker se reconstruye regularmente durante desarrollo
3. **Sin datos críticos**: No hay datos de producción que preservar
4. **Schema inicial completo**: El schema inicial contiene toda la estructura necesaria

## Estructura

```
migrations/
├── README.md                                    # Este archivo
└── add_modelo_3d_to_agrupaciones.sql           # Migración histórica (ya integrada en schema)
```

## Migraciones Históricas

### `add_modelo_3d_to_agrupaciones.sql`

**Estado**: ✅ **Ya integrada en `01-init-schema.sql`**

Esta migración agregó el campo `modelo_3d` a la tabla `agrupaciones`. El campo ya está presente en el schema inicial, por lo que esta migración es solo histórica.

**No ejecutar**: Esta migración ya no es necesaria, el campo está en el schema inicial.

## Si Necesitas Hacer Cambios al Schema

### Opción 1: Modificar Schema Inicial (Recomendado)

1. Editar `database/init/01-init-schema.sql`
2. Reconstruir Docker:
   ```bash
   docker-compose down -v
   docker-compose up -d postgres
   ```

### Opción 2: Script SQL Temporal (Solo para desarrollo)

Si necesitas hacer cambios temporales sin reconstruir Docker:

```bash
# Ejecutar script SQL directamente
docker-compose exec postgres psql -U juegodioses -d juego_dioses -f /ruta/al/script.sql
```

**⚠️ ADVERTENCIA**: Estos cambios se perderán al reconstruir Docker.

## Cuándo Usar Migraciones (Futuro)

Si el proyecto llega a producción con datos críticos, se debería:

1. Implementar un sistema de migraciones (Alembic, Flyway, etc.)
2. Mover cambios históricos de `migrations/` al sistema de migraciones
3. Mantener `01-init-schema.sql` como schema base para nuevos entornos

## Referencias

- **Schema inicial**: `database/init/01-init-schema.sql`
- **Documentación de base de datos**: `database/README.md`
- **Verificación del schema**: `database/init/VERIFICACION-SCHEMA.md`

