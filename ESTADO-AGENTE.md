# Estado del trabajo — startidea-web

Foto del presente para la siguiente sesión (Claude Code o Codex). **No es un diario:**
al cerrar una tanda larga, se reescribe.

**Última actualización:** 2026-08-05, tras el run del equipo SEO/GEO diario.

---

## En qué estamos

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
