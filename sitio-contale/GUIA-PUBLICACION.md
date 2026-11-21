# Guía de publicación (para no programadores)

Objetivo: que el sitio quede en `https://contale.marketia.agency` (o el subdominio que elijas), con candadito (HTTPS) y el formulario funcionando.

## Elegí el subdominio (3 opciones)

| Opción | Pro | Contra |
|---|---|---|
| **contale.marketia.agency** ⭐ | Coincide con el nombre del producto. Fácil de decir en voz alta y recordar. | Si cambia el nombre, hay que migrar. |
| **voz.marketia.agency** | Corto y genérico, sirve para futuros productos de voz. | No dice el nombre del producto. |
| **crm.marketia.agency** | Se entiende solo y ayuda al SEO. | Genérico: choca con otros CRM que armes después. |

Todo el sitio está escrito con `contale.marketia.agency`. Si elegís otro, hay que reemplazarlo en `index.html`, `robots.txt` y `sitemap.xml` (buscá y reemplazá el texto `contale.marketia.agency`).

## Paso 1. Subir el sitio a Netlify

El sitio vive en la carpeta `sitio-contale` del repositorio de GitHub. Se publica como un proyecto **separado** de la app.

1. Entrá a https://app.netlify.com e iniciá sesión.
2. Clic en **Add new site** → **Import an existing project**.
3. Elegí **GitHub** y autorizá si te lo pide. Buscá el repositorio **CRM-Voz**.
4. En la configuración:
   - **Branch to deploy:** la rama donde quedó el sitio (te la indico al terminar; luego podés pasarla a `main`).
   - **Base directory:** `sitio-contale`
   - **Build command:** dejalo vacío.
   - **Publish directory:** `.` (un punto) o dejalo vacío.
   - **Site name:** por ejemplo `contale-crm` (queda `contale-crm.netlify.app`).
5. Clic en **Deploy**. En 1 minuto abrí el link que te da Netlify y revisá que se vea.

> No toca la app: la app sigue en su propio proyecto de Netlify (`crm-voz`).

## Paso 2. Activar el formulario

1. En el sitio nuevo: **Forms** (menú izquierdo). Después del primer deploy debería aparecer el formulario **equipos**.
2. Si no aparece: **Site configuration → Forms → Enable form detection** y hacé **Deploys → Trigger deploy → Deploy site**.
3. Probalo vos: completalo desde el sitio publicado. Tiene que aparecer en **Forms → equipos → Submissions**.
4. Para que te llegue un mail: **Forms → Form notifications → Add notification → Email notification**, elegí el formulario **equipos** y poné tu email.

## Paso 3. Conectar el subdominio (Hostinger)

**En Netlify:**
1. En el sitio: **Domain management → Add a domain** (o *Add custom domain*).
2. Escribí `contale.marketia.agency` y confirmá. Si te pregunta si sos el dueño del dominio, decí que sí.
3. Netlify te va a mostrar el valor que tenés que apuntar: algo como `contale-crm.netlify.app`. Anotalo.

**En Hostinger:**
1. Entrá a https://hpanel.hostinger.com.
2. **Dominios** → clic en **marketia.agency** → **DNS / Servidores de nombres** (o *Zona DNS*).
3. En **Agregar registro** completá:
   - **Tipo:** `CNAME`
   - **Nombre:** `contale` (solo eso, sin el dominio completo)
   - **Apunta a / Contenido:** `contale-crm.netlify.app` (el nombre de tu sitio Netlify, sin `https://` y sin barra al final)
   - **TTL:** dejá el que viene (por ejemplo 14400).
4. Clic en **Agregar registro**.
5. Si ya existía un registro con el nombre `contale` (tipo A o CNAME), borralo o editalo: no puede haber dos.

> Si el DNS de marketia.agency estuviera en otro lugar (por ejemplo Cloudflare), el registro es el mismo. Primero verificá en Hostinger que los *servidores de nombres* sean los de Hostinger. Si apuntan a otro proveedor, el registro se agrega allá.

## Paso 4. Comprobar que quedó con HTTPS

1. Esperá entre 5 minutos y unas horas (a veces el DNS tarda).
2. En Netlify: **Domain management**. Tiene que decir que el dominio está configurado correctamente.
3. Bajá hasta **HTTPS** y clic en **Verify DNS configuration** y después **Provision certificate** (o *Let's Encrypt certificate*). Netlify lo hace gratis.
4. Abrí `https://contale.marketia.agency`: tiene que mostrarse el sitio con el candadito.
5. Activá **Force HTTPS** si aparece la opción.

Si algo falla, copiame el mensaje de error de Netlify o de Hostinger tal cual y lo resolvemos.

## Paso 5 (opcional). Analítica sin cookies

El sitio trae una línea de GoatCounter comentada en `index.html`. Para usarla: creá una cuenta gratis en goatcounter.com, copiá tu usuario y descomentá la línea poniendo tu usuario. GoatCounter no usa cookies, así que no hace falta aviso de cookies. Actualizá la política de privacidad si la activás.

## Más adelante (no ahora)
Mover la app a un subdominio propio toca el inicio de sesión en Supabase (URLs permitidas). Avisame antes de hacerlo.
