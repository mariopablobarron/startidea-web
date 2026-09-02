# Estado del trabajo — startidea-web

Foto del presente para la siguiente sesión (Claude Code o Codex). **No es un diario:**
al cerrar una tanda larga, se reescribe.

**Última actualización:** 2026-08-22 (madrugada), tras la tanda de ejecución del mandato de Mario («ser muy relevantes en buscadores e IA») — ver sección «Hecho el 2026-08-22».

---

## En qué estamos

Campaña SEO/GEO continua sobre `startidea.es` y `granadasocial.org` (repo `~/HUB`),
coordinada por la rutina `equipo-seo-geo-diario` (cron diario 09:30). Estrategia rectora:
**keywords monopolio** — fabricar números 1 en intersecciones servicio + sector +
territorio sin competidor, en vez de pelear keywords genéricas.

**El diagnóstico ha cambiado el 21-ago, y es el dato más importante de esta foto.** Ya no
es «el cuello es el CTR». Es esto:

- El test de citabilidad GEO lleva **tres mediciones (10-jul, 17-jul, 21-ago) con CERO
  enlaces a startidea.es** en las 7 intersecciones monopolio. Seis semanas de trabajo
  on-page no han movido el KPI ni una vez.
- Al leer las **fuentes** que devuelve Perplexity (no el marcador), se ve por qué: cuando
  menciona a Startidea, cita `granadasocial.org/sobre/startidea` o `granadahoy.com` —
  **nunca el dominio propio**. El hueco lo ocupan directorios y listicles sectoriales
  (`sortlist.es`, `agencias.marketing`, `solucionesong.org`, `quienesquien.ideal.es`).
- El `llms.txt` está completo y curado: **no es el cuello. El techo es off-site.**
- Coincide con lo medido a 5 meses: **publicar la página que falta mueve la aguja**
  (`/videopodcast` pasó de pos 22,7 a 8,3 al dejar de dar 404); **los retoques on-page no**.

**MATIZ IMPORTANTE, de otra sesión del mismo día (no verlo lleva a una conclusión falsa):**
que Perplexity no enlace **no significa que el trabajo GEO no rinda**. Con los datos buenos de
Umami (el real vive en **KVM4**, `analytics.hubstartidea.es`; la copia de la vps2 está
abandonada e induce diagnósticos falsos), las sesiones **suben** —~100/sem en junio a 135-167
en jul-ago— y el crecimiento es **directo (+95 %) y ChatGPT (+88 %, aterrizando en páginas de
servicio)**, no clic orgánico de Google. GA4 está ciego (captura un 3-5 %; el fallo está en la
consola, no en el código).

**Y el cuello prioritario hoy no es el tráfico ni la posición: es la conversión.** 81 sesiones
tocaron el embudo en 8 semanas con **0 envíos**, y no hay leads desde el 10-jul. Hay una
sesión paralela rediseñando `/diagnostico` por eso. Antes de invertir otra semana en subir
posiciones, mirar ahí. Ver las memorias `analisis-seo-geo-2026-08-21` y
`diagnostico-rediseno-2026-08-22`.

## Hecho el 2026-08-21 (todo desplegado y verificado en producción)

- **startidea — PR #50**, mergeado y verificado. La ficha `granadasocial.org/sobre/startidea`
  es la puerta por la que la IA alcanza la entidad, así que se auditó como una landing: de
  sus 6 enlaces salientes hacia startidea.es, **dos daban 404** (`/espacios`, `/eventos`).
  Redirect 301 de ambos a `/hub` en `astro.config.mjs`, siguiendo el precedente del mismo
  bloque. Hoy resuelven en 200. No rescatan tráfico (0 impresiones en GSC): reparan la ruta
  por la que la IA recorre la entidad.
- **granadasocial — PR #405**, mergeado y verificado. `/barrios` (3.ª página del sitio,
  520 imps/sem) pasa de **cero** datos estructurados a `CollectionPage` + `ItemList` de 15 +
  `BreadcrumbList`.
- **Cola de PRs SEO del hub a cero.** Cerrados #383, #400, #403 y #399 tras verificar por
  contenido (`git cherry` + diff contra `main` + curl a producción) que estaban superados por
  lo que ya hay publicado. Ramas borradas. Los 4 PRs abiertos que quedan en el hub (#292,
  #291, #200, #153) son de otras líneas, no SEO.
- **Corregida una regla operativa falsa**: el ruleset del hub **sí deja mergear** (ver «Ojo con»).
- **PR #53** (de otra sesión, revisado y mergeado aquí) — JSON-LD de entidad: `sameAs` a
  `granadasocial.org/sobre/startidea`, `mainEntityOfPage` → `/sobre`, `foundingLocation`,
  `audience` con las tres audiencias, helper `founderSchema()` y Organization en `/manifiesto`.
  Es el complemento exacto del hallazgo del día: yo reparé los 404 de esa ficha, este PR
  declara que la ficha y `startidea.es` son **la misma entidad**. Verificado en producción.
- **PR #54** — el histórico del KPI GEO (`data/geo-citability/`, 3 mediciones + `history.csv`)
  **nunca se había commiteado**: vivía solo en un working tree local, a un `git clean` de
  perderse. Ya está en `main`.

## Hecho el 2026-08-25 (rutina SEO/GEO diaria — martes monopolio)

- **startidea — PR #72**, mergeado. La nota del BOJA (340 imps/sem, pos 8,0) y la landing
  `/subvenciones/boja-2026-inclusion-social` —que vende tramitación a comisión de éxito del 12%—
  anunciaban **«15 líneas»** de la Orden de 20 de mayo de 2026. **Son 16**: faltaba la Línea 15
  (voluntariado en el ámbito universitario público, beneficiaria la universidad). Añadida en los
  dos ficheros. Además la nota pasa de noticia caducada a **referencia permanente**, con el
  calendario verificado de la convocatoria anual (2024 BOJA 143 · 2025 BOJA 101 · 2026 BOJA 99)
  y la mecánica real del plazo (15 días hábiles; 5 para la Línea 7 de escuelas de verano).
- **granadasocial — PR #422**, mergeado. **Guía permanente `/corpus`** (930 imps/90d en posiciones
  30-48 y CERO clics, servidas solo por 18 noticias de temporada y un artículo con las fechas
  congeladas en 2024). Patrón de `/empleo/ifmif-dones`: FAQPage, canonical, guard de dominio,
  alta a mano en SCOPED_PAGES y en llms.txt. **La fecha se calcula en render** con el cómputo
  pascual, no se teclea.
- **La candidata monopolio de startidea («boja hoy», 265 imps/sem pos 7,6) murió en la
  verificación previa** y con razón: no hay ingesta del BOJA en el repo (solo `bdns.ts`), la
  intención es navegacional y habría sido un doorway. Es el segundo martes seguido que la
  candidata cae antes de escribir código — la verificación previa está haciendo su trabajo.
- **Dos bulos evitados en la guía del Corpus**: la Pública es el **miércoles** (no el lunes) y
  «granadinos, divertíos como locos» **no es cita de los Reyes Católicos** (bulo rastreado a
  sermones del XVIII). La guía lo desmiente, que es justo el material que ningún competidor tiene.
- **Para Mario**: `lib/seo/opportunities.ts` descarta «corpus» como ruido off-topic con criterio
  de Startidea, pero las ~800 filas de GSC con «corpus» son TODAS de Granada Social. Ese filtro
  oculta demanda propia del portal y hará que el feed no mida si `/corpus` funciona.

## Hecho el 2026-08-22 (madrugada — todo desplegado y verificado contra el HTML vivo)

- **PR #55** — el catálogo de subvenciones no caducaba: 7 fichas vencidas el 16-jun se publicaban como «● Abierta». Ahora la vigencia se calcula del plazo real: `noindex` + fuera del sitemap + banner «cerrada» automáticos. Verificado en prod en ambos sentidos (caducada→noindex, vigente→index). El lote de 150-200 fichas nuevas se abortó a propósito: la API del HUB no da datos fiables (ver tarea Cowork «pipeline de fichas curadas»).
- **PR #56** — `/diagnostico` rediseñado (motivo: 81 sesiones al embudo en 8 semanas, 0 envíos). Árbol SVG fuera; 4 ramas + 17 subtipos como tarjetas server-side; contacto movido al paso FINAL; stepper visible. Ver memoria `diagnostico-rediseno-2026-08-22`.
- **PR #58** — clúster Granada: tldr «En corto», migas visibles, FAQ empresas, enlazado contextual. ⚠️ OJO: el pendiente nº7 de ayer decía «dejar de retocar /redes-sociales-granada» — esta 4ª intervención fue con otro objetivo (extractabilidad IA, no posición), pero al medir el 3-sep juzgar con ese historial delante.
- **PR #59** — clúster ENISA/CDTI: nota principal ampliada (sección «sin avales» — 100 imps y la palabra no aparecía), 2 notas nuevas (comparativa «enisa o cdti» pos 31; «solicitar con consultora», intención comercial). Importes/tipos sustituidos por rangos cualitativos con remisión a la ficha oficial (decisión editorial: no arriesgar datos falsos en préstamos públicos).
- **Cron del monitor GEO instalado en la KVM4** (faltaba el cron, no había avería — ver memoria `geo-monitor-hub-sin-cron`): scheduler lunes 07:00 UTC + runner cada 10 min. Runner respondiendo `ok`. La «acción ruido legacy» quedó REFUTADA (banco solidario apk lo atrae una página legítima; no tocar).
- **4 sesiones Cowork lanzadas por Mario** (en curso, no duplicar): consola GA4 (captura 3-5%), LinkedIn canónico, propiedad GSC del subdominio merch, pipeline de fichas de subvenciones.
- **Indexador Getalink: 0 créditos hasta el 13-sep** (los 100 se gastaron el 18-ago en un lote de 50 URLs aún en proceso). Las URLs nuevas de hoy van por sitemap o inspección manual en GSC.
- Decisión de Mario registrada: **el merch se queda en el subdominio** (ni /merchandising ni dominio propio hasta tener datos de ventas).

## Pendiente

1. **ACCIÓN DE MARIO, y bloquea el KPI GEO entero — dossier ya preparado (22-ago):**
   `data/geo-citability/altas-directorios-2026-08.md` (ficha canónica, textos para pegar
   y proceso paso a paso por directorio). Hallazgo de la investigación: **en 3 de los 4
   directorios la ficha de Startidea YA EXISTE sin que nadie la administre** (Sortlist
   desde 2017 sin reclamar; agencias.marketing auto-generada con email y Facebook
   erróneos; Quién es Quién de IDEAL con datos 2024) y en solucionesong.org Mario tiene
   un perfil de asesor dormido cuya bio dice «Somos STARTIDEA» (incumple la voz). No son
   altas nuevas: son 4 reclamaciones/correcciones (~45 min en total), que requieren
   cuentas/emails de Mario. Dato inconsistente a unificar en todas: `info@startidea.es`
   → `hola@startidea.es`. Al hacerlas, rellenar el registro del §5 del dossier para que
   el test GEO de los viernes pueda atribuir el efecto.
2. **DECISIÓN DE MARIO — seguridad del hub.** La protección de `main` del hub no protege
   frente a las sesiones automáticas (bypass de admin, ver «Ojo con»). Si la puso para
   revisar lo que se publica, hoy no lo consigue.
3. **DECISIÓN DE MARIO — PR #8, y es comercial, no de SEO.** Lleva abierto desde el 18-jul.
   Su parte viva propone poner **el precio en la meta description de `/comunicacion`**
   («desde X€ … gestión desde Y€/mes»). Mergearlo **revertiría en silencio** la description
   actual, que es posterior, y contradiría la decisión del 18-ago de no tocar esa página
   (sus 681 imps a pos 4,53 con 0 clics son consultas de IA, no humanas). Dejado parado a
   propósito, con el conflicto explicado en un comentario del propio PR. **¿Quieres el precio
   en el snippet de Google?** Si sí, se rehace sobre `main`; si no, se cierra.
4. **Dato menor pendiente de confirmar (anotado en `src/lib/jsonld.ts` por el PR #53):** el
   sitio enlaza **dos URLs de LinkedIn distintas para Mario** — `es.linkedin.com/in/mariobarron`
   y `www.linkedin.com/in/mariopablobarron/`. LinkedIn responde 999 a las dos, así que no se
   puede discriminar por HTTP. Solo se declara la histórica como `sameAs`, para no afirmar dos
   identidades. Conviene unificar cuando se confirme cuál es el perfil vivo.
   **(22-ago: hay una sesión Cowork dedicada a esto en curso — no duplicar.)**
5. **Martes 25 (monopolio granadasocial):** «corpus granada» (120 imps, pos 15,92) +
   «corpus en granada» (98, pos 37,71) — evento anual recurrente **sin página-guía
   permanente**. Es el patrón `/empleo/ifmif-dones` que ya funciona en el repo.
6. **Kerygma** es el activo de mayor volumen del hub (2.461 imps/mes, 7 clics) y ya está
   impecable on-page: title que responde («entradas, horario y precio»), `FAQPage` + `Event`
   desplegados. Su cuello es **posición** (11,71 = página 2), no snippet. Palanca: enlazado
   interno desde las páginas fuertes, o convertirlo de artículo en página-guía permanente.
7. **Dejar de retocar `/redes-sociales-granada`.** Tres intervenciones y ninguna ha mejorado
   la posición; «social media en granada» ha ido de 9,29 a 10,00. El techo ahí es autoridad.
8. **Medir hacia el 3-sep** los baselines de esta semana: `enisa o cdti cuál pedir` (7 imps,
   pos 26,08) y `ayudas para innovación empresarial en españa cdti` (7 imps, pos 15,58);
   en granadasocial, el CTR de `/barrios` (520 imps, pos 8,43, **1 clic**) y si sale rich
   result del `ItemList` recién desplegado.
9. **Bloqueado desde el 18-ago**: reflejar `TAVILY_API_KEY` en `.env.example` — los permisos
   de la sesión deniegan tocar `.env*` incluso en lectura. Lo tiene que hacer Mario a mano.
10. **12 notas sin ningún enlace editorial entrante.** Las que quedan (estrategia genérica y
   subvenciones) **no tienen página de servicio que las reclame**: es decisión de producto
   (¿qué páginas faltan?), no de SEO. No forzar enlaces. Inventario:
   ```
   for f in src/content/notas/*.md; do s=$(basename "$f" .md);
     n=$(grep -rl "notas/$s" src/ | grep -v "content/notas/$s.md" | wc -l);
     echo "$n $s"; done | sort -n
   ```

## Ojo con

- **El ruleset del hub NO bloquea los merges de agentes** (verificado 21-ago, corrige lo que
  decían tres memorias): «Protect main» está activo y pide 1 aprobación, **pero tiene
  `bypass_actors: [{RepositoryRole 5 (admin), always}]`** y `gh` corre como el owner, que es
  admin. `gh pr merge --squash` funciona sin `--admin`. Creer lo contrario dejó 4 PRs SEO
  parados días. Señal fiable: un PR mergeable figura como `mergeStateStatus: CLEAN`.
- **Un PR abierto no prueba trabajo parado** (tercera vez que pasa). Comprobar **por
  contenido** antes de retomarlo: `git cherry -v origin/main origin/<rama>`, diff contra
  `main`, y `curl` a producción. De 5 PRs que parecían pendientes, 4 estaban ya integrados.
- **El deploy del HUB no se hace a mano.** Un cron (`process-deploy-trigger.sh` →
  `deploy.sh --build`, con flock) despliega solo en cada push a `main`, en ~12-18 min.
  Lanzar `docker compose ... up -d --build app` por SSH **esquiva ese flock** y el
  2026-08-05 tumbó el portal (503). Verificar con `cat /docker/hub/.deployed-commit` **y**
  buscando el cambio en el HTML de producción.
- **`hub-app Dead` + un huérfano `<hash>_hub-app` tras un deploy es normal**: es la ventana
  del recreate, dura ~1 min y se resuelve sola. Medir 2-3 veces antes de tocar nada. Los
  `⚠️ SMOKE TESTS FALLARON` del log corren dentro de esa ventana.
- **Varias sesiones tocan estos repos a la vez.** Trabajar siempre en worktree propio desde
  `origin/main`, y comprobar `ps aux | grep '[d]ocker.*build'` antes de mergear en el HUB.
  El repo principal de startidea suele estar en una rama vieja con cambios sin commitear:
  **al delegar lectura a un subagente, decirle la ruta del worktree**, o sus hallazgos serán
  falsos.
- **Antes de proponer un cambio por «0 clics», calcular los clics esperados** (impresiones ×
  CTR de esa posición). Si λ < 3, el 0 es lo normal y retocar el title fabrica una mejora
  sobre ruido. Y segmentar las consultas de asistentes de IA (fraseo largo, posición 1-3 con
  0 clics): ahí la palanca es GEO, nunca CTR.
- **Antes de escribir contenido que insinúe un servicio**, comprobar que existe en
  `src/data/servicios.ts` o `src/content/cursos/`. Una query de GSC señala demanda, no
  capacidad.
- **Al auditar contenido, barrer también `src/components/` y `src/data/`**, no solo
  `src/pages/`: el texto de la home vive en componentes. Y verificar contra producción con
  `curl`, para descartar código muerto.
- **`merchandising.startidea.es` contamina el agregado de GSC** de startidea: >99% de las
  impresiones no-marca son del subdominio. Segmentar antes de sacar conclusiones, y no usar
  la posición media del dominio como KPI.
- `npm run build` local es el árbitro antes de cualquier push (~6 min). `tsc --noEmit` no
  detecta los gotchas de Astro 5 documentados en `.claude/CLAUDE.md`.
