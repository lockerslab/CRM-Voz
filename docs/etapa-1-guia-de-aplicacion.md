# Etapa 1 (empresas y roles): guía para aplicarla en Supabase

> **Estado:** lista y probada en una base local. **Todavía NO se aplicó en tu Supabase.**
> **No corras nada de esto hasta que Claude te diga que es el momento.**
> Tiempo estimado: 15 minutos. La migración en sí tarda segundos.

## Qué va a pasar (en simple)

Tu base de datos hoy dice "cada usuario ve lo suyo". La etapa 1 le agrega el concepto de **empresa**:

- Cada usuario recibe automáticamente su **espacio personal** (una "empresa de una sola persona").
- Todos sus contactos, tareas y notas pasan a vivir en ese espacio.
- Las reglas de seguridad se reescriben para que más adelante funcionen los roles.

**Para quien ya usa la app, no cambia nada visible.** Los datos se conservan idénticos (se verifica con una "huella").

## Qué se probó antes de pedirte nada

En una base local con datos de ejemplo, **148 pruebas, todas bien**:

| Qué se probó | Pruebas |
|---|---|
| Traspaso de datos actuales (nada se pierde, cada usuario queda con su espacio) | 32 |
| Todo o nada: si la migración falla a mitad de camino, no queda nada a medias | 5 |
| Marcha atrás: se puede volver al modelo anterior sin perder datos | 12 |
| Volver a migrar después de la marcha atrás | 4 |
| Roles y espionaje: 2 empresas y 11 personas intentando verse entre sí | 85 |
| Rendimiento con 10.000 contactos (el tablero carga en ~70 ms) | 10 |

Se pueden repetir con `supabase/tests/run-local.sh`.

## Antes de empezar

- Tené abierto tu proyecto de Supabase: https://supabase.com/dashboard
- Los archivos están en el repositorio, carpeta `supabase/`. Para copiar uno: abrilo en GitHub y tocá el botón **Copy raw file** (arriba a la derecha).
- Si todavía **no** corriste `supabase/migrations/20261120130000_profile_theme.sql` (el diseño elegido que acompaña al usuario), corrélo primero. Es independiente y seguro.

## Los pasos, en orden

En todos: **Supabase → SQL Editor → New query → pegar → Run**.

### Paso 0: respaldo dentro de la base
Archivo: `supabase/verification/etapa1_0_respaldo.sql`

Copia tus datos a tablas `_bak_20261121_*` (cerradas: la app no las ve). El resultado es una tabla con `originales` y `copiadas`: **los números tienen que coincidir**.

> Si tu plan de Supabase incluye copias de seguridad del proyecto (**Database → Backups**), hacé también una desde ahí. Este respaldo protege contra errores de la migración, pero no reemplaza una copia completa.

### Paso 1: foto "antes"
Archivo: `supabase/verification/etapa1_1_antes.sql`

Solo lee. **Sacale un pantallazo al resultado**: vas a compararlo con el de después. Las "huellas" son códigos que cambian si cambia un solo dato.

### Paso 2: la migración
Archivo: `supabase/migrations/20261121120000_orgs_roles_stage1.sql`

Pegalo completo y apretá **Run**.

- Puede aparecer una advertencia tipo *"Query has destructive operations"*. Es esperado (reemplaza reglas de seguridad por otras nuevas). Confirmá.
- Tiene que terminar en **"Success. No rows returned"**.
- Corre en **una sola transacción**: si algo falla, no queda nada a medias.

### Paso 3: verificación "después"
Archivo: `supabase/verification/etapa1_2_despues.sql`

Tiene que mostrar:

- Las tres **huellas iguales** a las de "antes" (tus datos están intactos).
- Todas las demás filas con estado **OK**.

Si alguna dice **REVISAR**, no sigas: pasame el pantallazo.

### Paso 4: probar la app de verdad
En tu sitio publicado (no hace falta cambiar nada en el código):

1. Iniciá sesión: tenés que ver tus contactos y tareas **como siempre**.
2. Grabá una nota de voz y guardala. Tiene que aparecer la tarjeta y la tarea.
3. Mové una tarjeta de columna y recargá con **F5**: tiene que quedarse.
4. Tildá una tarea como hecha.
5. Si tenés un segundo usuario de prueba, entrá con él: **no tiene que ver tus datos**.

## Si algo sale mal: marcha atrás

Archivo: `supabase/rollbacks/20261121120000_orgs_roles_stage1_rollback.sql`

Devuelve la base al modelo anterior **sin perder contactos, tareas ni notas** (solo se pierde la información de empresas). Pegalo y **Run**. Después avisame qué pasó.

Si hiciste el paso 0, además tenés las copias `_bak_20261121_*` con tus datos tal como estaban.

## Cuando todo esté bien

Dejá las copias `_bak_20261121_*` **una semana** por las dudas. Después se pueden borrar con:

```sql
drop table public._bak_20261121_profiles, public._bak_20261121_contacts,
           public._bak_20261121_interactions, public._bak_20261121_tasks;
```

## Qué incluye la migración (para quien quiera el detalle)

- Tablas `organizations` (empresas) y `memberships` (miembros con rol y gerente).
- Columna `org_id` en contactos, notas y tareas.
- Funciones de permisos con acceso acotado: `is_org_member`, `org_role_of`, `is_active_member`, `can_see_user`, `current_org_id`, `ensure_personal_space`.
- Reglas de seguridad (RLS) nuevas en las tres tablas de datos y en las dos nuevas. Valen solo para usuarios con sesión iniciada.
- `save_note` y el alta de usuarios nuevos conocen la empresa.
- **No se usa la clave `service_role`.**
