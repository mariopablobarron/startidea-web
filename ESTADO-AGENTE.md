# Estado del trabajo — startidea-web

Foto del presente para la siguiente sesión (Claude Code o Codex). **No es un diario:**
al cerrar una tanda larga, se reescribe.

**Última actualización:** 2026-09-08, tras la respuesta competitiva a Lexy (mylexy.app) y los 10 planes de productos autoservicio.

---

## Hecho el 2026-09-08 — respuesta competitiva a Lexy (PR #91, `486906f`, desplegado y verificado en producción)

Origen: análisis del competidor Lexy (mylexy.app, SaaS de RRSS con IA, Barcelona; Starter 25 €/mes DIY,
Premium 150 €/mes gestionado). Ficha guardada en Engram. Tres oportunidades implementadas:

- **Lead magnet `/auditoria-digital-gratuita`**: formulario → `POST /api/auditoria-digital` (honeypot,
  rate-limit 3/h por IP, consentimiento obligatorio). Avisa a Mario por Telegram, manda acuse al lead
  (Resend) y lanza en segundo plano `src/lib/auditoria-digital.ts`: web + Google (robots, sitemap,
  JSON-LD, OG, PageSpeed móvil) + visibilidad IA (llms.txt, bots bloqueados, Organization) + redes.
  El resultado llega a Mario por Telegram y email; **el lead NO recibe el análisis en bruto**: el
  compromiso público es auditoría revisada por persona en 48 h laborables. Probado en vivo contra
  startidea.es (11 ok) y mylexy.app (4 medios, 3 leves).
- **Comparativa en `/redes-sociales-ia`** («herramienta de IA por 25 € o IA supervisada») + bloque
  «Por sector» enlazando a los verticales + CTA a la auditoría.
- **Verticales `/redes-sociales-ia/{tercer-sector,iglesia,empresas-con-proposito}`**: datos en
  `src/data/redes-sociales-ia-verticales.ts` (getStaticPaths no ve el frontmatter: gotcha de Astro).
  Cada uno con qué se publica, líneas rojas, mes tipo, plan recomendado, FAQ y Service/FAQ JSON-LD.
- Registro: footer (Servicios + Explora), `llms.txt`, OG `page/auditoria-digital-gratuita`, sitemap
  (automático, verificado en dist).
- Verificado en prod (2026-09-08 01:10): las 4 URL nuevas 200, OG, comparativa, llms.txt, sitemap y
  footer. Endpoint probado: email inválido → 400, honeypot → 200 falso, y un envío real de prueba
  («PRUEBA Claude») contra mylexy.app para comprobar Telegram + acuse + análisis.
- **Pendiente de Mario**: (1) confirmar que llegaron el Telegram y los dos correos de la prueba;
  (2) opcional `PAGESPEED_API_KEY=` en `.env` del container y en `.env.example` (sin clave funciona
  con cuota anónima); (3) decidir si Lexy interesa como partner de autoservicio barato para
  clientes por debajo de 190 €/mes (no se implementa nada).
- Disco del Mac al 99 % durante la sesión (ENOSPC en el build); se vació la caché npm. Revisar.


## Hecho el 2026-09-08 — Laboratorio: rama «Productos autoservicio» (10 planes de negocio)

- **Colección `productos`** en `src/content/config.ts` + 10 fichas en `src/content/productos/`
  (piloto de redes, copiloto de subvenciones Pro, memorias y justificaciones, web en un día,
  nota de voz a contenido, newsletter curada, kit de marca exprés, asistente para socios,
  eventos con inscripciones, merchandising bajo demanda). Cada ficha: `orden` (ranking por
  rentabilidad), `claim`, `modelo`, `precio_desde`, `estado`, `base_hub`, `rentabilidad` 1-5,
  `beta`, `tldr`, `faqs`, y cuerpo con problema/cliente/producto/IA/ingresos/mercado/métricas/
  90 días/riesgos/qué falta.
- **Páginas**: `/laboratorio/productos` (ranking con filtros por área y estado, `<script is:inline>`)
  y `/laboratorio/productos/[...slug]` (ficha + BlogPosting + FAQPage + anterior/siguiente).
  Rama añadida en primera posición al array `ramas` de `/laboratorio`.
- Precios coherentes con `knowledge/01-servicios-y-precios.md` y con el Copiloto gratuito + 12 % a
  éxito de `/precios`: el Pro se presenta como plan de pago del Copiloto, no como producto nuevo.
- Build verificado OK en worktree `claude-lab-productos`. Siguiente acción: comprobar en producción
  `/laboratorio/productos` tras el deploy y decidir con Mario qué beta arranca primero (propuesta:
  piloto de redes, que ya tiene el flujo en el HUB).

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
