# Estado del trabajo — startidea-web

Foto del presente para la siguiente sesión (Claude Code o Codex). **No es un diario:**
al cerrar una tanda larga, se reescribe.

**Última actualización:** 2026-09-08, PR #89 (Lazo) rebasado sobre el PR #90 (productos autoservicio).

---

## 2026-09-07 — «Home que pregunta» (PR #89, abierto, SIN fusionar)

Base: `origin/main` = `8717f18` + rama `feat/home-plano`. Build local OK; verificado en dev.

- **Nivel A (producción al fusionar):** Nav con «Qué hacemos ▾» (4 servicios +
  financiación + formación) y «Laboratorio» en escritorio; pie con columna
  «Aprender»; banda de formación de la home subida por encima de la prueba social.
- **Nivel B (prototipo noindex):** `/lab/home-plano` = hero CONVERSACIONAL con la IA de
  Startidea (mascota = isotipo animado con tooltip; selector de audiencia; atajos sin IA)
  + Plano Startidea (SVG en servidor; datos en `src/data/plano.ts`).
  - `/api/plano/charla` + `src/lib/plano-charla.ts`: turno de conversación (Haiku, JSON
    validado; guion de respaldo si falla el modelo). Máx. 8 turnos. Lee TODAS las fichas
    de `src/content/knowledge/`, incluida la nueva **`05-manual-conversacion.md`**
    (BORRADOR de Claude: cómo conversa Mario en un diagnóstico; **Mario debe revisarla**).
    Ojo: el chat flotante (`/api/chat`) también la carga.
  - Regalos tangibles (`src/lib/regalos.ts`, `/api/plano/regalo`): post Instagram (con
    tarjeta SVG descargable), publicación LinkedIn, letra de canción, informe SEO REAL
    (`src/lib/seo-mini.ts`, con guardas SSRF). Límite 2/IP/día (`PLANO_REGALOS_POR_IP`)
    y 150/día global (`PLANO_REGALOS_DIA`), en SQLite.
  - `src/lib/plano-db.ts` (SQLite `plano.db`, anonimizado, tabla `regalos_plano`) y
    `/admin/plano` (charlas con respuesta, regalos, por audiencia e intención).
  - En local la `OPENROUTER_API_KEY` del `.env` devuelve 401 → todo cae al guion; en
    producción usa la clave real del container.
  - **Mascota: Lazo** (decisión Claude 2026-09-08 delegada por Mario; «siempre hay tiempo
    de cambiar»). Carácter: curioso, directo, cercano, algo contestatario.
  - **Fase 2 (resumen por correo):** `/api/plano/resumen` + `src/lib/plano-resumen.ts`
    → email al visitante (Resend), alta en el CRM del HUB vía `replicateHubIntake`
    (form `plano-resumen`), aviso al owner, reserva Cal.com prellenada
    (`bookingHrefWith` en `src/data/booking.ts`). Guardas: guion no envía correo,
    1 correo/destinatario/día, tope global `PLANO_RESUMENES_DIA` (100), limpieza de
    URLs/emails en el texto. Consentimiento explícito de correo + conversación.
  - **Fase 3 (entrenar a Lazo):** `/admin/knowledge` sube PDF/DOCX/TXT/MD/CSV/XLSX →
    `src/lib/knowledge-extract.ts` (mammoth nuevo en dependencies) → `knowledge.db`
    (FTS5; embeddings OpenRouter solo si `PLANO_EMBEDDINGS=on`) → `contextoDocumentos()`
    inyectado por petición en `plano-charla.ts` y `api/chat.ts`. Auth en
    `src/lib/knowledge-auth.ts`. Doc: `docs/entrenar-lazo.md`. Tests: `tests/knowledge-db.test.ts`.
  - **Continuidad:** el chat flotante (`AsistenteIA.astro`) comparte sessionStorage
    `startidea:plano:charla` con el hero y se presenta como Lazo; `/api/chat` lleva el
    prompt de Lazo y acepta `audiencia`.
  - **Variables nuevas (opcionales), NO reflejadas en `.env.example` (Claude no edita
    `.env*`; Mario a mano):** `MODELO_CHARLA`, `MODELO_REGALOS`, `MODELO_RESUMEN`,
    `MODELO_EMBEDDING`, `PLANO_EMBEDDINGS=on|off`, `PLANO_REGALOS_POR_IP`,
    `PLANO_REGALOS_DIA`, `PLANO_RESUMENES_DIA`, más `TAVILY_API_KEY` pendiente de antes.
  - **Pendiente de Mario:** revisar `05-manual-conversacion.md` con su voz real; si Cal.com
    pierde name/email al entrar por el perfil, apuntar `BOOKING_URL` al evento de 30 min.
- **Privacidad:** el plano usa solo la taxonomía pública (4 puertas + ecosistema);
  nada de documentación interna de estrategia (el detalle está en la memoria local de Claude, no en el repo).
- **Propuesta y prototipo estático:** artifacts de Claude «Una home que pregunta antes
  de contar» y «Plano Startidea» (sesión 2026-09-07).
- **Decisión de Mario pendiente:** fusionar el PR #89 (el agente no tiene permiso de
  merge). Tras fusionar: verificar `curl -s -o /dev/null -w "%{http_code}" https://startidea.es/lab/home-plano`
  (200) y que `/` muestra «Laboratorio» en el menú de escritorio.
- **Siguiente acción:** con el PR en producción, dejar 3-4 semanas de datos en
  `/admin/plano` + GA4 (scroll, clics en formación, reservas) y decidir si
  `/lab/home-plano` sustituye a la home.

---

## Hecho el 2026-09-08 — Laboratorio: rama «Productos autoservicio» (10 planes de negocio) (PR #90, en main)

- **Colección `productos`** en `src/content/config.ts` + 10 fichas en `src/content/productos/`
  (piloto de redes, copiloto de subvenciones Pro, memorias y justificaciones, web en un día,
  nota de voz a contenido, newsletter curada, kit de marca exprés, asistente para socios,
  eventos con inscripciones, merchandising bajo demanda). Ranking por rentabilidad, `beta`,
  `tldr`, `faqs`.
- **Páginas**: `/laboratorio/productos` (ranking con filtros, `<script is:inline>`) y
  `/laboratorio/productos/[...slug]`. Rama en primera posición del array `ramas` de `/laboratorio`.
- Siguiente acción de esa rama: comprobar `/laboratorio/productos` en producción y decidir
  qué beta arranca primero (propuesta: piloto de redes).

## Hecho el 2026-08-18 (desplegado y verificado en producción)

- **PR #45** (`b0b5219`) — todos los enlaces `merchandising.hubstartidea.es` →
  `merchandising.startidea.es` (el viejo redirige 301). Eran 12 apariciones en 7
  ficheros, no 3: Ecosistema, Nav, MerchPromo, jsonld.ts, /merchandising y las 2
  fichas knowledge del chat IA. Verificado con curl en `/`, `/merchandising` y
  `/que-hacemos`: 0 restos del dominio viejo.
- **Monitor GEO: sin cambio necesario.** `geo-monitor.mjs` casa por substring y
  `geo-competitors.mjs` por sufijo de dominio — `merchandising.startidea.es` ya
  cuenta como propio vía `startidea.es`. Decisión cerrada tras leer el código.
- **PR #46** (`d823191`) — `.claude/CLAUDE.md`: S6 (container `copiloto-sede`)
  marcado como desplegado; llevaba 5 semanas listado como pendiente. Re-verificado
  en la VPS: `copiloto-sede Up 3 weeks (healthy)`.
- **Bloqueado**: reflejar `TAVILY_API_KEY` en `.env.example` — los permisos de la
  sesión deniegan tocar `.env*` incluso en lectura. Lo tiene que hacer Mario a mano.

## En qué estamos

### NUEVO 2026-08-19 — Rama «IA para el bien común» del Laboratorio (commit 2c9b3c2, pusheado)

Desplegada a producción vía push a main (Coolify). Verificar tras el deploy: /laboratorio/ia, el directorio y el lead magnet:

- **Colección `herramientas`** en `src/content/config.ts` + 15 fichas en
  `src/content/herramientas/` (Claude, ChatGPT, Gemini, Mistral, Perplexity, NotebookLM,
  Canva, Gamma, Whisper, ElevenLabs, Make, n8n, Brevo, Notion, DeepL). Cada ficha:
  para_que_si/no, riesgos, alternativa, valoracion 1-5, tldr, faqs.
- **Páginas**: `/laboratorio/ia` (portada con los 5 principios), `/laboratorio/ia/herramientas`
  (directorio con filtros cliente por necesidad/precio/nivel) y `[...slug]` (ficha con
  JSON-LD Review + FAQPage). Rama añadida al array `ramas` de `/laboratorio`.
- **Lead magnet restaurantes**: `/recursos/plantilla-control-restaurante` (formulario →
  `/api/recursos/solicitar`, slug registrado ahí y en `gracias.astro`; el .xlsx está en
  `public/recursos/`). Origen: piloto con Juan Pablo (restaurante de su padre).
- **`docs/criterio-ia.md`** — INTERNO: mapeo de los 5 principios públicos a la DSI
  (decisión de Mario: la DSI no se explicita en la web).
- Gotcha aprendido: `<script lang="ts">` NO se transpila (cualquier atributo → is:inline);
  el filtro del directorio va en `<script is:inline>` con JS plano.
- Build verificado OK. Estrategia general validada por Mario: Laboratorio ampliado (no
  marca nueva), sin subdominios, empezar por manifiesto+directorio.


Campaña SEO/GEO continua sobre `startidea.es` y `granadasocial.org` (repo `~/HUB`),
coordinada por la rutina `equipo-seo-geo-diario`. Estrategia rectora: **keywords
monopolio** — fabricar números 1 en intersecciones servicio + sector + territorio sin
competidor, en lugar de pelear keywords genéricas.

El cuello de botella hoy **no es la posición, es el CTR**: hay páginas en posición 2-8
con cero clics. Y una parte del tráfico son consultas de asistentes de IA, que nunca
clican — para esas el juego es GEO (citabilidad), no title.

## Hecho el 2026-08-05 (todo desplegado y verificado en producción)

**startidea.es**
- `37cbaf5` — `/videopodcast`: sección «Antes de producir», FAQ nueva, punto en «En
  síntesis» y `llms.txt`. Ataca 3 consultas en posición 5,8-14,7 con 0 clics.
- `361f51e`, `7b42153`, `6164403` — enlazado editorial interno en `/fundraising`,
  `/proteccion-digital`, `/agentes-ia`, `/audiovisual` y `/como-trabajamos`.
- `0ad8f28` — residuo de voz de marca en la home («No vivimos en WordPress»).

**granadasocial.org** (repo `~/HUB`)
- `91a93378` — el JSON-LD de las 223 fichas del directorio publicaba `contactEmail`, que
  el esquema documenta como PRIVADO y la UI oculta a propósito. Eliminado del tipo, del
  builder y de la llamada. Además: `ItemList` + `BreadcrumbList` en las páginas de
  categoría, que no declaraban nada. Y `serializeJsonLd()` para cerrar un XSS almacenado.
- `490a739f` — `<title>` de las categorías: de «Salud» a «Salud en Granada: 20 entidades».
- (`e62f17ac`, de otra sesión) — el escape de JSON-LD barrido a los 15 ficheros restantes,
  con `lib/json-ld.ts` como módulo compartido.

## Pendiente

1. **12 notas sin ningún enlace editorial entrante.** Se cerraron 12 de 24 hoy. Las que
   quedan (estrategia genérica y subvenciones) **no tienen página de servicio que las
   reclame** — es decisión de producto (¿qué páginas faltan?), no de SEO. No forzar
   enlaces. El inventario se saca así:
   ```
   for f in src/content/notas/*.md; do s=$(basename "$f" .md);
     n=$(grep -rl "notas/$s" src/ | grep -v "content/notas/$s.md" | wc -l);
     echo "$n $s"; done | sort -n
   ```
2. **Viernes: balance semanal + test de citabilidad GEO** (batería de prompts contra
   Perplexity desde dentro del container `startidea-web`; el procedimiento está en el
   SKILL de la rutina). Baseline a batir: 0 enlaces a startidea.es en las intersecciones
   monopolio.
3. **Medir en 7-14 días** los baselines registrados hoy en memoria: las 3 consultas de
   videopodcast, y en granadasocial las fichas de nicho en posición 7-11 con 0 clics.

## Ojo con

- **El deploy del HUB no se hace a mano.** Un cron (`process-deploy-trigger.sh` →
  `deploy.sh --build`, con flock) despliega solo en cada push a `main`, en ~12-18 min.
  Lanzar `docker compose ... up -d --build app` por SSH **esquiva ese flock** y el
  2026-08-05 tumbó el portal (503). Verificar con `cat /docker/hub/.deployed-commit`.
  Tres ficheros de instrucciones que mandaban lo contrario ya están corregidos, incluido
  `~/.claude/memory/infra-startidea.md`, que además afirmaba en falso que `/docker/hub`
  no era un repo git.
- **`hub-app Dead` + un huérfano `<hash>_hub-app` tras un deploy es normal**: es la
  ventana del recreate, dura ~1 min y se resuelve sola. Medir 2-3 veces antes de tocar
  nada. Los `⚠️ SMOKE TESTS FALLARON` del log corren dentro de esa ventana.
- **Varias sesiones tocan estos repos a la vez.** Trabajar siempre en worktree propio
  desde `origin/main`, y comprobar `ps aux | grep '[d]ocker.*build'` antes de mergear en
  el HUB. El repo principal de startidea suele estar en una rama vieja: **al delegar
  lectura a un subagente, decirle la ruta del worktree**, o sus hallazgos serán falsos.
- **Antes de escribir contenido que insinúe un servicio**, comprobar que existe en
  `src/data/servicios.ts` o `src/content/cursos/`. El 2026-08-05 un borrador vendía una
  vía de «formación en videopodcast» que no está en el catálogo.
- **Al auditar contenido, barrer también `src/components/` y `src/data/`**, no solo
  `src/pages/`: el texto de la home vive en componentes. Y verificar contra producción
  con `curl`, para descartar código muerto.
- `npm run build` local es el árbitro antes de cualquier push (~6 min). `tsc --noEmit` no
  detecta los gotchas de Astro 5 documentados en `.claude/CLAUDE.md`.
