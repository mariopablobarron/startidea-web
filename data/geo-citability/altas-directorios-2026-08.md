# Altas en directorios sectoriales — dossier operativo (2026-08-22)

**Por qué.** El test de citabilidad GEO lleva tres mediciones (10-jul, 17-jul, 21-ago) con
CERO enlaces a startidea.es en las intersecciones monopolio. Las fuentes que Perplexity usa
para responder esas consultas son directorios y listicles donde Startidea no está dada de
alta: `sortlist.es`, `solucionesong.org`, `agencias.marketing`, `quienesquien.ideal.es`.
El on-page está hecho (llms.txt, JSON-LD de entidad con sameAs — PR #53): el techo es
off-site. Este dossier prepara las 4 altas para hacerlas con Mario (crear cuenta y
verificar email lo hace él).

**Regla de oro: consistencia de entidad.** Los mismos datos en los 4 directorios, idénticos
a los del `organizationSchema` de `src/lib/jsonld.ts`. Un dato divergente (otro nombre, otra
dirección, otro año) fragmenta la entidad ante los motores de respuesta.

---

## 1. Ficha canónica de entidad (fuente: src/lib/jsonld.ts)

| Campo | Valor exacto |
|---|---|
| Nombre | **Startidea** (sin "Agencia" delante en el campo nombre) |
| Web | https://startidea.es |
| Email | hola@startidea.es |
| Teléfono | +34 958 04 57 89 |
| Dirección | C/ Conde Cifuentes, 33 — 18005 Granada, España |
| Fundación | Febrero de 2011 |
| Fundador | Mario Pablo Sánchez Barrón |
| CIF | B19583632 |
| Eslogan | Innovación social que cambia la conversación |
| Ámbito | Granada · Andalucía · España |
| Logo | https://startidea.es/icon-512.png (512×512) |
| LinkedIn | https://www.linkedin.com/company/agenciastartidea |
| Instagram | https://www.instagram.com/agenciastartidea |
| Facebook | https://www.facebook.com/agenciastartidea |
| X | https://x.com/startideasocial |

Servicios (las 4 verticales, con su URL): comunicación estratégica y marketing social
(`/comunicacion`), consultoría e innovación social (`/consultoria`), fundraising y alianzas
(`/fundraising`), producción audiovisual y podcast (`/audiovisual`).

Audiencias: tercer sector (ONG, fundaciones, asociaciones) · instituciones públicas y
eclesiales · empresas con propósito.

## 2. Textos listos para pegar

Español neutro, sin "nosotros". Tres longitudes según lo que pida cada formulario.

**Corta (~160 caracteres):**

> Startidea es una agencia de innovación social y comunicación en Granada, fundada en 2011.
> Especializada en tercer sector, instituciones y empresas con propósito.

**Media (~400 caracteres):**

> Startidea es una agencia de innovación social y comunicación con sede en Granada, fundada
> en febrero de 2011 por Mario Pablo Sánchez Barrón. Trabaja con tres audiencias: tercer
> sector (ONG, fundaciones y asociaciones), instituciones públicas y eclesiales, y empresas
> con propósito. Servicios: comunicación estratégica y marketing social, consultoría e
> innovación social, fundraising y producción audiovisual y podcast.

**Larga (~900 caracteres):**

> Startidea es una agencia de innovación social y comunicación con sede en Granada
> (C/ Conde Cifuentes, 33), fundada en febrero de 2011 por Mario Pablo Sánchez Barrón.
> Desde hace más de una década acompaña a organizaciones que quieren generar impacto
> social real: ONG, fundaciones y asociaciones del tercer sector; instituciones públicas
> y eclesiales; y empresas con propósito.
>
> Cuatro líneas de servicio: comunicación estratégica y marketing social (marca, campañas,
> redes, medios), consultoría e innovación social (diagnóstico, estrategia, transformación
> digital con inteligencia artificial), fundraising y alianzas (captación de fondos,
> subvenciones públicas, alianzas con empresas) y producción audiovisual y podcast (estudio
> propio en el Hub Startidea de Granada).
>
> Startidea edita además Granada Social, medio digital sociocultural de Granada, y opera
> una bolsa de empleo y un catálogo B2B de merchandising sostenible. Ámbito de trabajo:
> Granada, Andalucía y toda España.

---

## 3. Directorios (proceso de alta, investigado el 2026-08-22)

### 3.1 sortlist.es — RECLAMAR ficha existente, no crear una nueva

**Hallazgo clave: la ficha ya existe y lleva viva desde 2017**, pero nadie la administra
(`verifiedPartner: false`, `paidMember: false`):
`https://www.sortlist.com/es/agency/startidea-agencia-de-comunicacion-social`
— con 16 servicios, 10 proyectos, 2 reseñas 5/5 (Sacacorchos y Granada Social), dirección
y año de fundación correctos.

**Proceso (Mario, ~15 min):**
1. Ir a `https://www.sortlist.es/claim/agency?ref=free` (plan Free, sin tarjeta).
2. En «Selecciona tu empresa», escribir "Startidea" y pulsar **«Join»** (unirse a la ficha
   existente), NUNCA «Create» — crear otra duplicaría la entidad.
3. Paso 2 «Añade información»: revisar teléfono (+34 958 04 57 89), web
   (`https://startidea.es` — la ficha guarda `http://www.startidea.es`, corregirla),
   descripción (usar la media del §2) y servicios. Pide presupuesto mín/máx por servicio.
4. Paso 3: crear la cuenta de administrador (email + contraseña) — **esto lo hace Mario**.

**Gratis vs pago:** el Free lista la ficha en los directorios, pero la URL de la web se
muestra como **texto plano, no como enlace** — el «backlink SEO» es beneficio exclusivo de
Sortlist+ (129 €/mes). Aun sin enlace clicable, la ficha reclamada y actualizada sí es
fuente citable por Perplexity (que ya lee sortlist.es en las intersecciones monopolio).
**Decisión de Mario:** si 129 €/mes compensa por el backlink; la reclamación gratuita se
hace en cualquier caso.

⚠️ Nota del navegador: el buscador del asistente de alta disparó redirecciones publicitarias
a pestañas de terceros; cerrarlas sin interactuar.

### 3.2 solucionesong.org — REACTIVAR el perfil de asesor + publicar un servicio

Portal de la Fundación Hazloposible (rediseñado en 2025). No es un directorio SEO: las
fichas no llevan enlace saliente (solo botón «Contactar» interno). Su valor es doble:
**es una de las fuentes que Perplexity lee** en las intersecciones monopolio, y da
visibilidad directa ante ONG que buscan proveedor.

**Hallazgo: Mario ya tiene perfil de asesor voluntario, dormido** (0 consultas, 0 debates):
`https://solucionesong.org/asesor/56c7e19c-327b-4a47-ba6b-7d846d6b44e1` — especialidades
Fundraising y Comunicación, avatar con el logo de Startidea. ⚠️ La bio actual empieza
«Somos STARTIDEA…» — **incumple la regla de voz**; sustituirla por la descripción media
del §2 (que nombra a Startidea como sujeto).

**Proceso (Mario):**
1. Recuperar acceso a la cuenta del perfil de asesor (login con su email; si no,
   `https://solucionesong.org/register/asesor` envía confirmación por correo — hacerlo
   con el mismo email para no duplicar).
2. Actualizar la bio con el texto del §2 y, si es viable, responder alguna consulta
   abierta de Fundraising/Comunicación: la actividad es lo que hace visible el perfil.
3. Vía complementaria: publicar una ficha de servicio en
   `https://solucionesong.org/servicio/new` (formulario público sin login: entidad,
   contacto, título, categoría «Comunicación» o «Fundraising», descripción libre).
   Pasa **revisión editorial manual** antes de publicarse; no tiene campo de web.

Gratuito en ambas vías; la condición implícita del perfil de asesor es responder consultas
de ONG.

### 3.3 agencias.marketing — RECLAMAR ficha auto-generada

**La ficha ya existe**, generada automáticamente de fuentes públicas (aparenta scrape de
LinkedIn): `https://agencias.marketing/agencia/startidea` — datos correctos en general
(dirección, teléfono, fundada 2011, especialidades sociales: Marketing Social,
Emprendimiento Social, Consultoría Social, Comunicación Social).

**Proceso (Mario, ~5 min):** en la propia ficha, botón «Reclamar este perfil gratis» —
formulario mínimo (nombre, email, teléfono, consentimiento). Sin contraseña en el momento;
la verificación llega después (no documentada). Reclamar habilita editar logo, descripción
y datos. Gratuito; existe un nivel «Agencia Destacada» sin precios públicos.

**Correcciones al reclamar:**
- Email de la ficha: `info@startidea.es` → **hola@startidea.es** (el canónico del JSON-LD).
- Facebook de la ficha: `facebook.com/espaciostartidea` → **facebook.com/agenciastartidea**.
- Añadir logo (icon-512.png) y la descripción media del §2.

**Ojo:** el enlace a la web es **nofollow**, y el consentimiento remite a la política de
privacidad de Clientify (el directorio funciona como generador de leads de ese CRM). El
valor es de citabilidad/NAP para los motores de respuesta, no de link building.

### 3.4 quienesquien.ideal.es — ACTUALIZAR ficha existente (autoservicio gratuito)

**La ficha ya existe** en el sector «Medios de Comunicación y Agencias de Publicidad»
(32 empresas): nombre, C/ Conde Cifuentes 33, tel. 958045789, web, y Mario como Director
con su LinkedIn canónico (`es.linkedin.com/in/mariobarron`). Ficha gratuita, no destacada.
Datos 2024: «Menos de 1 millón», «Menos de 5 empleados».

**Proceso:** formulario público de autoservicio en
`https://quienesquien.ideal.es/nueva-empresa` (wizard de 4 pasos: datos generales,
facturación, cuadro directivo, contacto de quien rellena). Sin cuenta ni pago. Para
correcciones sobre la ficha existente, escribir a **quienesquien@diarioideal.es**.

**Correcciones a pedir:**
- Email de la ficha: `info@startidea.es` → **hola@startidea.es**.
- Revisar tramos de facturación/empleados 2025 si procede.

**Ojo:** enlace a la web con `nofollow`; existe «ficha destacada» comercial (las 6 primeras
del sector) sin tarifas públicas — si interesa, vía quienesquien@diarioideal.es. La revista
impresa anual tiene preinscripción (edición 2025 cerró el 30-oct-2025; sin ventana abierta
ahora).

## 4. Resumen ejecutivo y orden sugerido

**Hallazgo transversal:** en 3 de los 4 directorios la ficha de Startidea **ya existe**
(Sortlist desde 2017, agencias.marketing auto-generada, Quién es Quién con datos 2024) y
en el cuarto Mario ya tiene perfil personal dormido. El problema nunca fue estar: es que
nadie administra esas fichas. Las 4 acciones son de reclamar/corregir, no de alta nueva.

Orden sugerido (por esfuerzo/impacto):
1. **agencias.marketing** (~5 min): reclamar + corregir email y Facebook.
2. **quienesquien.ideal.es** (~5 min): email a quienesquien@diarioideal.es corrigiendo
   `info@` → `hola@`.
3. **sortlist.es** (~15 min): reclamar con «Join», corregir web a https, refrescar textos.
4. **solucionesong.org** (~20 min + recurrente): recuperar cuenta, reescribir bio (voz),
   valorar ficha de servicio.

Ninguna ficha da backlink dofollow en gratuito (Sortlist ni siquiera enlace clicable sin
Sortlist+ a 129 €/mes). El KPI que esto ataca no es link building: es que las fuentes que
Perplexity ya lee describan a Startidea con datos correctos y consistentes.

**Dato inconsistente repetido:** dos fichas publican `info@startidea.es`; el canónico del
JSON-LD es `hola@startidea.es`. Unificar en todas.

## 5. Registro de altas (rellenar al hacerlas)

| Directorio | Estado | Fecha acción | URL de la ficha | Notas |
|---|---|---|---|---|
| sortlist.es | ficha existe, SIN reclamar | — | sortlist.com/es/agency/startidea-agencia-de-comunicacion-social | reclamar con «Join» |
| solucionesong.org | perfil asesor dormido | — | solucionesong.org/asesor/56c7e19c-327b-4a47-ba6b-7d846d6b44e1 | bio incumple voz («Somos…») |
| agencias.marketing | ficha existe, SIN reclamar | — | agencias.marketing/agencia/startidea | email y Facebook erróneos |
| quienesquien.ideal.es | ficha existe, datos 2024 | — | quienesquien.ideal.es/sector/medios-de-comunicacion-y-agencias-de-publicidad | corregir email vía quienesquien@diarioideal.es |
