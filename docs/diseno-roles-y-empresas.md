# Roles y empresas en crm-voz

> **Estado:** borrador para revisar · 21 de noviembre de 2026
> **Decisiones:** 3 de 8 resueltas (la 1, la 3 y la 4). Ver la sección [Decisiones](#decisiones-que-necesito), donde se registra lo que se vaya resolviendo.
> **Alcance de este documento:** es una propuesta. No se hizo ningún cambio en la base de datos ni en el sitio publicado.
> **Uso:** documento interno de trabajo. No forma parte de la app. Describe medidas de seguridad y riesgos, así que no corresponde publicarlo para clientes.

Cómo pasar de "un vendedor, sus datos" a "una empresa con vendedores, gerentes y un administrador", sin romper nada de lo que ya funciona hoy.

## Contenido

1. [Resumen](#resumen)
2. [La idea central](#la-idea-central)
3. [Quién puede qué](#quién-puede-qué)
4. [Equipos y gerentes](#equipos-y-gerentes)
5. [Privacidad de las notas de voz](#privacidad-de-las-notas-de-voz)
6. [Invitaciones](#invitaciones)
7. [Qué ve cada persona](#qué-ve-cada-persona)
8. [Cómo se protege y se prueba](#cómo-se-protege-y-se-prueba)
9. [Plan por etapas](#plan-por-etapas)
10. [Riesgos](#riesgos)
11. [Decisiones que necesito](#decisiones-que-necesito)
12. [Detalle técnico](#detalle-técnico)

## Resumen

Sí se pueden dar roles. Hoy cada contacto, tarea y nota de voz pertenece a una persona, y la base de datos solo deja ver "lo mío". Para vender a empresas hay que sumar una capa nueva: la **organización** (la empresa) y, dentro de ella, **miembros con un rol**.

El cambio es grande porque toca la seguridad de los datos. Por eso se propone en **cinco etapas**, y la primera no se nota: prepara la base de datos y deja todo funcionando igual para quienes ya la usan.

## La idea central

Todos los usuarios pertenecen a una empresa. Un vendedor independiente tiene una "empresa de una sola persona", que se crea sola al registrarse. Así los freelancers de hoy y las empresas de mañana usan **el mismo modelo**. No hay dos productos que mantener, y un freelancer puede sumarse a una empresa sin perder datos.

| | Hoy | Con empresas |
|---|---|---|
| Quién ve qué | Cada vendedor ve solo lo suyo | Cada persona ve según su rol dentro de su empresa |
| Entre empresas | No aplica | Una empresa no ve nada de otra |

**Regla de negocio importante.** En una empresa, **los contactos son de la empresa, no del vendedor**. Si un vendedor se va, sus clientes no se pierden: el administrador los reasigna. En un espacio personal, en cambio, el dueño es el usuario.

## Quién puede qué

Tres roles para el día a día. A eso se suma el **Dueño**, que es la persona que creó la empresa: funciona como un administrador con un extra, porque es la única que puede borrarla o cambiar quién es el dueño.

| Acción | Vendedor | Gerente | Administrador |
|---|---|---|---|
| Ver y editar sus propios contactos, tareas y notas | Sí | Sí | Sí |
| Ver los contactos y tareas de otros | No | Su equipo | Toda la empresa |
| Reasignar un contacto a otro vendedor | No | Su equipo | Sí |
| Tablero y métricas del equipo | No | Su equipo | Toda la empresa |
| Invitar, cambiar de rol o desactivar personas | No | No | Sí |
| Ajustes de la empresa (diseño, logo, privacidad) | No | No | Sí |
| Cobros y facturación | No | No | Sí |

## Equipos y gerentes

La forma más simple de armar equipos: **cada vendedor tiene asignado un gerente**. El gerente ve a los vendedores que tiene a cargo. No hace falta crear "equipos" como una pieza aparte, y alcanza para empresas de 5 a 100 personas.

*Alternativa:* que el gerente vea a todos los vendedores de la empresa. Es más fácil de construir, pero sirve solo para empresas chicas. Si la empresa crece, habría que rehacerlo.

## Privacidad de las notas de voz

Es el punto más delicado. Un vendedor graba cosas como "este cliente es un pesado" y no necesariamente quiere que lo escuche su jefe. Cada empresa tendría dos interruptores, que solo cambia el administrador:

| Interruptor | Valor por defecto | Para qué sirve |
|---|---|---|
| Gerente lee la transcripción | Activado | Acompañar al equipo: qué se habló y qué sigue. |
| Gerente escucha el audio | Desactivado | Solo si la empresa lo decide. El audio guarda la voz de una persona. |

- **Aviso de consentimiento.** La primera vez que alguien graba dentro de una empresa, ve un mensaje claro de quién puede ver sus notas.
- **Registro de accesos.** Queda anotado cada vez que un gerente o administrador abre un audio.
- **Consulta legal.** En Argentina rige la ley de protección de datos personales (25.326). Las notas contienen datos de clientes. Antes de vender a una empresa grande conviene que un abogado revise el aviso y el manejo de los datos.

## Invitaciones

Para sumar gente, el administrador elige un rol y se genera un **link de invitación** para copiar y mandar por WhatsApp o email. Cada link sirve una sola vez y vence a los 7 días.

1. El administrador elige el rol y el gerente a cargo, y copia el link.
2. La persona abre el link, crea su cuenta (o inicia sesión) y acepta.
3. Entra a la empresa con el rol asignado. Si tenía un espacio personal, queda aparte.

Más adelante se puede mandar el email automáticamente; queda para después porque requiere sumar un servicio de envío de correo. Todo se hace **sin la clave `service_role`**, igual que el resto de la app: la aceptación usa una función de la base de datos con permisos acotados.

## Qué ve cada persona

- **Vendedor:** igual que hoy. Su pipeline, sus tareas, sus notas, con el diseño que elija o el de la empresa.
- **Gerente:** se suma un selector arriba ("Mi equipo / un vendedor"), el pipeline del equipo, la opción "Reasignar" y un resumen (notas de la semana, tareas atrasadas por vendedor, contactos por etapa).
- **Administrador:** se suma la pantalla "Equipo" (invitar, roles, desactivar) y los ajustes (nombre, logo, color de marca, diseño por defecto, privacidad). Ve todo lo del gerente, de toda la empresa.

El **diseño por defecto de la empresa** aprovecha los tres diseños que ya existen (Calle, Claro y Tech): el administrador elige uno para toda la empresa y puede sumar su logo y su color.

## Cómo se protege y se prueba

Las reglas de acceso viven en la base de datos, no en la pantalla. Así, aunque alguien manipule la app, la base no le entrega lo que no le corresponde.

### Pruebas antes de publicar nada

Se arma una base de prueba con dos empresas y varias personas (un dueño, un administrador, dos gerentes, vendedores de cada equipo y un vendedor de la otra empresa) y se intenta espiar de todas las formas posibles:

- [ ] Un vendedor no ve nada de sus compañeros.
- [ ] Un gerente ve a su equipo y a nadie más.
- [ ] Un administrador ve toda su empresa y nada de otra.
- [ ] Nadie puede "inventar" la empresa de un dato nuevo para colarse en otra.
- [ ] Reasignar solo funciona entre personas de la misma empresa.
- [ ] Una invitación sirve una vez, vence y no sirve con otro email.
- [ ] Una persona desactivada pierde el acceso al instante.
- [ ] El audio solo lo abre el gerente si el interruptor está encendido.
- [ ] Si alguien se va, sus contactos quedan en la empresa.
- [ ] Con 10.000 contactos, el tablero sigue siendo rápido.
- [ ] Las pruebas actuales de "dos usuarios" siguen pasando.

### Cómo se cuidan los datos actuales

- Copia de seguridad completa de Supabase antes de migrar.
- Primero se corre en una copia, nunca en la base real.
- La migración se hace en un solo paso, con un plan de marcha atrás escrito de antemano.

## Plan por etapas

Cada etapa se apoya en la anterior. Tamaño: **S** una sesión de trabajo, **M** entre dos y tres, **L** cuatro o más (estimaciones).

| Etapa | Qué se entrega | Tamaño | Riesgo |
|---|---|---|---|
| **1. Cimientos invisibles** | Empresas y miembros; cada usuario actual recibe su empresa personal; reglas de acceso nuevas; matriz completa de pruebas de espionaje. No se nota ningún cambio. | M | Alto (toca seguridad y datos reales) |
| **2. Equipo e invitaciones** | Pantalla "Equipo" para el administrador; invitar por link, cambiar roles, desactivar personas. | M | Medio |
| **3. Vista de gerente** | Selector de equipo y vendedor, reasignación de contactos, resumen del equipo. Congelar el alcance antes de empezar. | M a L | Medio |
| **4. Ajustes de la empresa** | Diseño por defecto, logo y color de marca, interruptores de privacidad, aviso de consentimiento. | M | Bajo |
| **5. Cobro por usuario** | Planes y precio por usuario al mes, con límite de personas (Mercado Pago o Stripe). Es una decisión de negocio; no bloquea las etapas 1 a 4. | L | Medio |

Los **recordatorios de tareas** (Fase 2 de antes) se pueden hacer en paralelo después de la etapa 1, porque no dependen de los roles.

## Riesgos

| Riesgo | Qué se hace |
|---|---|
| Una regla de acceso mal escrita muestra datos de una empresa a otra | Matriz de pruebas con dos empresas y revisión de cada regla antes de publicar. |
| La migración daña datos reales | Copia de seguridad, ensayo en una copia y marcha atrás escrita de antemano. |
| Las reglas más complejas hacen lento el tablero | Índices por empresa y usuario, y medición con 10.000 contactos. |
| Problemas legales por grabar y guardar datos de clientes | Aviso de consentimiento, registro de accesos y revisión de un abogado antes de vender a empresas grandes. |
| El alcance crece sin límite (reportes, permisos finos) | Congelar por escrito qué entra en cada etapa y anotar lo demás para después. |

## Decisiones que necesito

Cada una trae la recomendación y qué cambia si se elige otra cosa. La columna **Resolución** se completa a medida que se decide.

| # | Pregunta | Recomendación | Alternativa | Resolución |
|---|---|---|---|---|
| 1 | ¿Una persona puede estar en más de una empresa? | No, al menos al principio. | Sí: hace falta un selector de empresa en toda la app y cambia la forma de proteger los datos. Se puede sumar después. | **Decidido (21 nov 2026):** no, una sola empresa por persona (versión 1). |
| 2 | ¿Quién ve a quién? | Cada vendedor tiene un gerente, y el gerente ve a sus vendedores. | El gerente ve a todos: más simple, pero solo sirve para empresas chicas. | Pendiente |
| 3 | ¿El gerente puede escuchar el audio? | No por defecto. Lee la transcripción y el administrador puede habilitar el audio. | Siempre sí: más fácil, pero los vendedores graban con más cuidado y la app pierde espontaneidad. | **Decidido (21 nov 2026):** no por defecto; el administrador puede habilitarlo y cada acceso queda registrado. |
| 4 | ¿Los contactos son de la empresa o del vendedor? | De la empresa. Si alguien se va, se reasignan. En un espacio personal el dueño es el usuario. | Del vendedor: la empresa perdería clientes cada vez que alguien renuncia. | **Decidido (21 nov 2026):** de la empresa; si alguien se va, sus contactos se reasignan. |
| 5 | ¿Cómo se invita a la gente? | Con un link para copiar y mandar por WhatsApp. Email automático, más adelante. | Email automático desde el día uno: requiere un servicio de envío de correo y suma una semana. | Pendiente |
| 6 | ¿Qué pasa con un freelancer que pasa a una empresa? | Mantiene su espacio personal y puede llevar contactos a la empresa con un botón, solo si quiere. Nada se mueve solo. | Migración automática de todo: riesgo de que alguien se lleve o pierda clientes sin darse cuenta. | Pendiente |
| 7 | ¿Cómo se cobra? | Por usuario por mes. Se decide antes de la etapa 5. | Precio fijo por empresa, o por cantidad de notas de voz (refleja mejor el costo real de transcripción e IA). | Pendiente |
| 8 | ¿Quién revisa el tema legal? | Un abogado, antes de vender a una empresa grande. | — | Pendiente |

Puntos a llevar al abogado: aviso de grabación, uso de datos de clientes, registro de base de datos y plazo de conservación del audio.

## Detalle técnico

Esquema inicial; se afina en la etapa 1.

### Tablas nuevas y cambios

```text
organizations
  id, name, logo_url, brand_color, default_theme,
  managers_read_transcripts (true), managers_hear_audio (false)

memberships
  org_id, user_id, role (owner | admin | manager | seller),
  manager_id (a quién reporta), status (active | disabled)
  -- v1: un usuario, una empresa (user_id único)

invitations
  id, org_id, role, manager_id, token_hash, invited_by,
  expires_at, accepted_at

audio_access_log
  id, org_id, audio_path, accessed_by, accessed_at

contacts / interactions / tasks
  + org_id (se completa solo para los datos actuales)
  user_id sigue siendo "la persona a cargo"
```

### Reglas de acceso

Funciones auxiliares de la base de datos, con permisos acotados, que responden "¿soy miembro de esta empresa?", "¿qué rol tengo?" y "¿puedo ver a esta persona?". Las reglas de cada tabla las usan.

```text
puedo_ver(org, persona) =
     persona = yo
  OR mi rol en org es 'owner' o 'admin'
  OR (mi rol es 'manager' Y persona.manager_id = yo)

contacts, tasks, interactions:
  ver        -> pertenece a mi empresa Y puedo_ver(org, user_id)
  crear      -> user_id = yo Y soy miembro activo
  editar     -> yo, o gerente/admin que pueda verlo
  reasignar  -> el nuevo responsable es miembro de la misma empresa
  borrar     -> yo, o admin

audio (Storage):
  abrir      -> yo, o gerente/admin SOLO si managers_hear_audio = true
                (y se anota en audio_access_log)
```

---

*Versión navegable de este documento (enlace privado de Claude): https://claude.ai/artifact/2aWfKBdsx73JJuQbHM16Fb*
