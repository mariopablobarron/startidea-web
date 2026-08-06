# Plan SEO + GEO de startidea.es

Documento vivo. Fuente de verdad del trabajo de crecimiento orgánico. Lo mantiene el agente
`seo-geo-startidea` (definición en `~/.claude/agents/seo-geo-startidea.md`).

- **Creado:** 2026-08-06
- **Objetivo declarado:** ×5 en resultado orgánico (tráfico cualificado + citabilidad en motores
  generativos), no en número de URLs publicadas.

---

## 0. Baseline medido (GSC, 2026-08-06)

Fuente: `GscDailyQuery` / `GscDailyPage` del HUB, propiedad `sc-domain:startidea.es`, workspace
`cmofzwr4u0001pu2aaxagz81r`. Datos disponibles desde 2026-04-05 hasta 2026-08-03.

| Mes | Clics | Impresiones | CTR | Posición media | Queries distintas |
|---|---|---|---|---|---|
| 2026-04 | 66 | 1.018 | 6,48 % | 15,6 | 110 |
| 2026-05 | 81 | 1.782 | 4,55 % | 21,6 | 139 |
| 2026-06 | 47 | 3.039 | 1,55 % | 26,9 | 292 |
| 2026-07 | 52 | 6.180 | **0,84 %** | 35,6 | 765 |
| 2026-08 (parcial, 3 días) | 4 | 1.582 | 0,25 % | 44,7 | 454 |

**Lectura:** las impresiones se multiplican por 6 y los clics **bajan**. El sitio está ganando
visibilidad en long tail cada vez más lejano, no tráfico.

**Corrección importante (misma sesión):** la propiedad es de dominio, así que mezcla
`merchandising.startidea.es`. Ese subdominio se indexó masivamente el **2026-07-28** (posiciones
40-85, 0 clics) y explica el salto de impresiones de finales de julio. Aislando solo startidea.es
(datos de `GscDailyPage`):

| Mes | Clics web | Impresiones web | CTR web | Impresiones merchandising |
|---|---|---|---|---|
| 2026-04 | 69 | 1.838 | 3,75 % | 43 |
| 2026-05 | 85 | 2.817 | 3,02 % | 54 |
| 2026-06 | 51 | 3.755 | 1,36 % | 168 |
| 2026-07 | 52 | 5.402 | **0,96 %** | 1.961 |

Es decir: **merchandising contamina, pero no es la causa.** Aun descontándolo, startidea.es triplica
impresiones con los clics planos y el CTR se divide por cuatro. La dilución en long tail irrelevante
es real y es el problema de fondo.

**El dato que manda:** de ~180 clics en 90 días, ~155 son de marca — `startidea` (111 clics, CTR
24,2 %), `staridea` (22), `startidea granada` (21). **El tráfico no-marca es de ~25 clics en tres
meses.** Ese, y no las impresiones, es el número que hay que multiplicar.

### Depuración del baseline (tres pasadas, misma sesión)

La primera lectura de los datos era errónea. Queda documentada la corrección porque el método
importa tanto como el número.

1. **Hipótesis inicial (descartada):** `/que-hacemos` acumulaba 2.238 impresiones en posición media
   3,5 con 0 clics, y la query con más impresiones del sitio era una cadena concatenada de ~10
   intenciones terminada en «in spain». Se interpretó como visibilidad en superficies de IA
   (AI Mode) que no genera visita.
2. **Test decisivo:** la serie diaria de `/que-hacemos` es constante — 30-55 impresiones/día en
   posición 2-5 durante todo julio — y **cae en seco a 4, 1, 1 los días 1, 2 y 3 de agosto**. Una
   demanda humana no tiene esa forma. Es consulta automatizada (rastreador de posiciones o agente)
   que dejó de ejecutarse el 2026-08-01. **Son impresiones sintéticas, no demanda.**
3. **Segundo contaminante:** `merchandising.startidea.es` entra en la propiedad de dominio y se
   indexó masivamente el **2026-07-28** (posiciones 40-85, 0 clics): ~1.961 impresiones solo en
   julio.

### El baseline honesto (sin merchandising ni impresiones sintéticas)

| Mes | Clics | Impresiones | CTR | Posición media | Páginas con impresiones |
|---|---|---|---|---|---|
| 2026-04 | 69 | 1.838 | 3,75 % | **6,2** | 16 |
| 2026-05 | 85 | 2.817 | 3,02 % | 9,6 | 31 |
| 2026-06 | 51 | 2.861 | 1,78 % | 17,7 | 44 |
| 2026-07 | 52 | 4.064 | 1,28 % | **20,7** | 59 |

**El diagnóstico real, y es el importante:** en cuatro meses las páginas con impresiones pasan de
16 a 59, las impresiones se duplican, **la posición media se degrada de 6,2 a 20,7** y los clics se
quedan planos. Esto no es un problema de CTR ni de superficies de IA: es **dilución**. Se ha
publicado más superficie de la que el dominio puede sostener con autoridad, y cada página nueva
rankea peor que la anterior.

Es exactamente el patrón «publicar más y rankear peor». La palanca no es producir más contenido:
es concentrar autoridad en menos páginas que ganen.

### Clústeres con demanda real y posición alcanzable (pos 4-20, últimos 60 días)

| Clúster | Queries representativas | Impresiones | Posición |
|---|---|---|---|
| **Comunicación para ONG** *(el nuclear)* | agencia de comunicación para ongs (11,0), agencia comunicación ong (7,3), mejores agencias de comunicación ong españa (5,4), servicios de comunicación para ongs (9,8), consultoría de comunicación para ongs internacionales (7,2), plan de comunicación ong (11,2) | ~350 | 5-11 |
| **Local Granada** | social media granada (17,1), social media en granada (11,1), redes sociales granada (14,0) | ~350 | 11-21 |
| **Videopodcast** *(nicho libre)* | agencia de videopodcast (13,7), estrategia integral de videopodcast (13,4), consultoría para lanzar videopodcast (17,4), productora de videopodcast (26,3) | ~280 | 13-26 |
| **ENISA / financiación** | tramitar préstamo enisa, enisa sin avales, cómo solicitar un enisa | ~230 | 49-55 |

La nota `/notas/financiacion-startup-enisa-prestamos-participativos` acumula ~880 impresiones en
posición 48-54: demanda alta, posición inservible.

### Ruido que contamina el baseline

`merchandising.startidea.es` es un **subdominio distinto, fuera de este repo**, que entra en la
propiedad de dominio: ~1.300 impresiones en posiciones 25-72 y 0 clics (categorías de e-commerce).
**Decidido:** se segmenta fuera de toda medición de startidea.es (filtro
`page not like '%merchandising.startidea.es%'`). Su optimización es un proyecto aparte; hoy solo
ensucia el diagnóstico.

### Estado del código (auditoría 2026-08-06)

Lo que ya existe:

| Área | Estado |
|---|---|
| Sitemap | `@astrojs/sitemap` con `serialize` (lastmod real de notas) + `filter`. Endpoint extra `sitemap-catalogo.xml.ts` para las páginas SSR |
| robots.txt | Abierto a propósito a GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended, CCBot. Solo bloquea `/admin/` y `/api/` |
| Metadatos | Por página vía props de `Base.astro`. Canonical normalizado sin trailing slash, meta robots dinámico, OG + Twitter completos |
| JSON-LD | 12 helpers en `src/lib/jsonld.ts`, importados en 59 páginas |
| OG images | Dinámicas, motor propio satori + resvg (`src/lib/og.ts`, `/og/[...slug].png`) |
| GEO | `llms.txt`, `llms-full.txt` (texto íntegro de notas), `ai.txt`. Frontmatter de notas con `tldr` y `faqs[]` |
| Contenido | 51 notas, 11 diagnósticos, 5 knowledge, 4 cursos. ~35 páginas de servicio. ~2.100 convocatorias BDNS en SQLite |
| Analítica | GA4 + Consent Mode v2, Umami self-hosted, Clarity tras consent |
| Pipeline | En el HUB: sync GSC/GA4 → oportunidades → agentes → issue en GitHub sobre este repo |

**Conclusión:** el SEO técnico básico está hecho y el GEO está por encima de la media del mercado.
El ×5 no está en pulir esto; está en las palancas de la sección 1.

---

## 1. Palancas priorizadas

**Reordenadas tras el baseline del 2026-08-06.** La hipótesis inicial situaba las subvenciones como
P1; los datos la desmienten como *primer* paso: hay clústeres ya en posición 5-11 sin explotar, y
levantar 2.100 URLs nuevas antes de convertir lo que ya posiciona sería construir sobre un sitio
que hoy no transforma impresiones en clics.

Partiendo de ~25 clics no-marca en 90 días, el ×5 es alcanzable si se ejecutan A y B.
**La métrica objetivo es clics no-marca, nunca impresiones.**

**Regla que sale del baseline:** el problema es dilución (posición media 6,2 → 20,7 mientras las
páginas indexadas pasaban de 16 a 59). Por tanto, durante los próximos meses **cada página nueva
tiene que justificarse contra una query concreta con demanda**, y la consolidación de lo que ya
existe va antes que la creación. Publicar más notas sin clúster empeora el número.

### A — Consolidar el clúster «comunicación para ONG» *(primero)*

`/comunicacion` ya posiciona entre 5 y 11 en queries de contratación (`agencia comunicación ong`
7,3; `mejores agencias de comunicación ong españa` 5,4).

**Ojo — lo que NO hay que hacer aquí:** la página ya está bien construida. Title
(«Agencia de comunicación para ONG y tercer sector — Startidea»), `serviceSchema`, `howToSchema`,
`faqPageSchema` con 5 FAQs, breadcrumbs, notas y casos relacionados: todo hecho. Proponer «optimizar
el title» sería trabajo inventado.

El trabajo real es de **autoridad, no de on-page**: identificar qué páginas del sitio compiten con
`/comunicacion` por esa misma intención, consolidarlas o redirigirlas, y apuntar el enlazado interno
del clúster (notas de comunicación ONG, plan de comunicación, casos del tercer sector) hacia ella
como destino único. Primero medir la canibalización real con datos de GSC por página+query.

### B — Local Granada y videopodcast *(en paralelo, esfuerzo bajo)*

- **Granada**: `redes-sociales-granada.astro` existe pero rankea en 21,4 mientras las queries salen
  en 11-17. Requiere señales locales: `localBusinessSchema` completo, NAP consistente, Google
  Business Profile alineado, contenido con contexto real de Granada.
- **Videopodcast**: 4 queries en posición 13-26, nicho poco competido y con capacidad real detrás.
  No hay página dedicada — hay que crearla.

### C — Auditoría de dilución *(cerrado el diagnóstico, abierta la acción)*

El diagnóstico de la visibilidad sin clic **ya está resuelto**: eran impresiones sintéticas, no
superficies de IA (ver sección 0). Lo que queda abierto es su consecuencia.

**Hecha el 2026-08-06** → [`AUDITORIA-DILUCION-2026-08.md`](AUDITORIA-DILUCION-2026-08.md).
Cinco hallazgos: la home cae de posición 6,2 a 21,5; 13 pares de URL con/sin barra repartiéndose
impresiones; demanda real desperdiciada (ENISA 699 impr en pos 48, `/notas` en pos 61); superficie
invisible; y el legacy de WordPress ya resuelto. Pendiente de ejecución y de OK para lo que toca
indexación.

### D — Rescatar la nota de ENISA

~880 impresiones en posición 48-54. Hay demanda; la posición es inservible. Reescritura orientada a
la query real y enlazado desde `financiacion-empresas.astro`.

### E — SEO programático de subvenciones *(la apuesta de volumen, después de A-B)*

~2.100 URLs BDNS existen en runtime pero están **excluidas del sitemap** por el `filter()` de
`astro.config.mjs`. Es la mayor superficie sin explotar del sitio y ataca intención de búsqueda de
alto volumen y alta cualificación ("subvenciones para asociaciones", "ayudas [CCAA] [sector]").

No es "meterlas al sitemap". Requiere, en este orden:

1. Plantilla con **valor editorial propio** por convocatoria (no volcado de BOE): a quién aplica,
   qué pide, plazos en lenguaje claro, qué suele fallar. Sin esto es thin content y penaliza.
2. Clúster y enlazado: categoría → territorio → convocatoria, con retorno a servicios.
3. Datos estructurados coherentes y control de canibalización entre `catalogo/`, `categoria/` y
   `territorio/`.
4. Política de caducidad: convocatoria cerrada → `noindex` o consolidación en la página de
   categoría. Sin esto el sitio se llena de URLs muertas.
5. Alta gradual en sitemap (por lotes, midiendo indexación real), nunca 2.100 de golpe.

**Riesgo:** alto si se hace mal, y el daño tarda semanas en verse. Requiere OK explícito de Mario
antes de desplegar el primer lote.

### F — Entidad de marca y citabilidad (GEO)

Que la IA cite a Startidea depende más de la consistencia de la entidad fuera del sitio que del
HTML de dentro.

- `sameAs` completo y coherente en `organizationSchema`.
- Ficha de entidad idéntica (nombre legal, fundación, fundador, ubicación, servicios) en web,
  Google Business Profile, LinkedIn, directorios sectoriales y notas de prensa.
- Contenido **atribuible**: cifras propias, metodologías con nombre, definiciones de glosario. Los
  motores generativos citan lo que pueden atribuir a una fuente.

### G — Extender la superficie para IA

- `llms.txt` / `llms-full.txt` solo listan notas → añadir servicios, casos, glosario, diagnósticos
  y catálogo de subvenciones.
- Exponer el markdown de cada nota en su URL (`/notas/[slug].md`). Coste bajo, ganancia directa.

### H — Resto de páginas de servicio con intención comercial

Las ~35 páginas de servicio compiten por queries de contratación. Cada una necesita:
FAQ visible + `faqPageSchema`, prueba (casos y cifras), enlazado al clúster de notas, y un `tldr`
extractable en el primer scroll — el bloque que la IA copia.

### I — Core Web Vitals

- `astro:assets` solo en 4 ficheros (`Fundador`, `Logo`, `sobre`, `prensa`): el resto de imágenes
  no pasa por el pipeline de optimización.
- `public/hero.mp4` = 2,1 MB. three.js en 4 componentes (`Ecosistema`, `HeroImmersive`,
  `Manifesto`, `HeroJourney`), sin lazy-load condicional confirmado.
- LCP e INP son ranking factor y, antes que eso, son conversión.

### J — Enlazado interno

No hay sistema: ni componente de contenido relacionado ni silos declarados. Es la palanca más
barata que queda y la que reparte autoridad hacia A, B y E.

### K — Breadcrumbs visuales

59 páginas emiten `breadcrumbList` en JSON-LD; solo unas pocas tienen el `<nav>` visible. Google
espera correspondencia entre lo estructurado y lo renderizado.

---

## 2. Deuda detectada de paso

- `AGENTS.md` describe el deploy como push → GitHub Actions. **Es obsoleto**: desde 2026-06-09 el
  deploy real es pull-based (cron cada 2 min en el VPS). Induce a error a futuros agentes.
- `php-seo-connector/` parece legacy: hay rutas equivalentes ya migradas a `src/pages/admin/`.
  Confirmar si sigue en producción; si no, retirar.

---

## 3. Qué NO se hace

Contenido generado en masa sin valor editorial, cloaking, compra de enlaces, doorway pages, y
publicar notas sueltas sin clúster ni query objetivo. El daño es asimétrico y recae sobre la marca.

---

## 4. Reglas de trabajo

- Rama + PR sobre `mariopablobarron/startidea-web`. Nunca commit directo a `main` (`main` despliega
  solo en ≤2 min).
- `npm run build` local antes de dar nada por bueno (`tsc --noEmit` no ve los fallos típicos de
  Astro 5 documentados en `AGENTS.md`).
- Todo JSON-LD vía `src/lib/jsonld.ts`. Nunca inline.
- Cualquier cambio que afecte a indexación masiva se anuncia y se confirma antes de desplegar.

---

## 5. Medición

**Métrica norte: clics no-marca.** Baseline 2026-08-06 = ~25 clics no-marca en 90 días.
Objetivo ×5 = ~125 clics no-marca en 90 días. Las impresiones no cuentan como resultado: el sitio
ya las multiplicó por 6 sin ganar un clic.

- [x] Baseline con fecha: hecho (sección 0), datos GSC 2026-04-05 → 2026-08-03.
- [ ] Segmento de referrals de IA en GA4: `chatgpt.com`, `perplexity.ai`, `gemini.google.com`,
      `claude.ai`, `copilot.microsoft.com`.
- [ ] Set fijo de ~20 prompts GEO (comunicación tercer sector, fundraising, subvenciones ONG, IA
      para administraciones, agencia Granada…) con medición periódica de si Startidea aparece
      citada y con qué URL.
- [x] `merchandising.startidea.es` segmentado fuera de la medición (2026-08-06).
- [ ] Revisión mensual: qué palanca movió los clics no-marca.

Consulta de baseline reproducible (VPS KVM4, `hub-postgres`, solo lectura):

```sql
select substring(date,1,7) mes, sum(clicks), sum(impressions),
       round((sum(clicks)::numeric/nullif(sum(impressions),0))*100,2) ctr,
       round(avg(position)::numeric,1) pos
from "GscDailyQuery"
where site_url='sc-domain:startidea.es'
group by 1 order by 1;
```

---

## 6. Registro de cambios

| Fecha | Qué se tocó | Métrica que debería moverse | Cuándo revisar |
|---|---|---|---|
| 2026-08-06 | Auditoría de código + creación del plan y del agente `seo-geo-startidea` | — | — |
| 2026-08-06 | Baseline GSC medido; prioridades reordenadas (subvenciones deja de ser P1) | — | — |
| 2026-08-06 | Baseline depurado: impresiones sintéticas en `/que-hacemos` + subdominio merchandising. Diagnóstico real = dilución (pos. 6,2 → 20,7) | — | — |
| 2026-08-06 | Auditoría de dilución de las 88 URLs con impresiones | — | — |
