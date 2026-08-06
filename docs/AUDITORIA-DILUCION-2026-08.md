# Auditoría de dilución — startidea.es (2026-08-06)

Clasificación de las **88 URLs con impresiones** en GSC entre 2026-04-05 y 2026-08-03
(`sc-domain:startidea.es`, excluido `merchandising.startidea.es`). Complementa
[`SEO-GEO-PLAN.md`](SEO-GEO-PLAN.md) §1-C.

Criterio: *gana* / *puede ganar* / *no va a ganar nunca* → consolidar, redirigir o `noindex`.

---

## Hallazgo 1 — La home se está hundiendo *(lo más grave)*

| Página | Clics | Impr. | Pos. abr-may | Pos. julio |
|---|---|---|---|---|
| `https://startidea.es/` | 210 | 4.151 | **6,2** | **21,5** |

Es la página que más tráfico aporta del sitio (210 de ~250 clics no sintéticos) y su posición media
se ha degradado de 6,2 a 21,5 en cuatro meses. Ninguna otra acción de este documento importa tanto
como entender esto.

### ✅ Verificado el 2026-08-06 — es canibalización, y tiene fecha

Descartada la hipótesis del artefacto estadístico: las impresiones de la home **no crecieron**
(775 → 833), así que la caída de posición no se explica por «aparecer para más cosas».

Serie de la home:

| Mes | Clics | Impr. | Pos. |
|---|---|---|---|
| 2026-04 | 55 | 775 | **4,6** |
| 2026-05 | 71 | 1.432 | 7,7 |
| 2026-06 | 45 | 1.070 | 16,3 |
| 2026-07 | 35 | 833 | **21,3** |

Y las queries de marca, aisladas, están **sanas y estables** — posición 2,3 → 3,6, impresiones
250 → 219, clics 55 → 44. La home no ha perdido la marca.

Restando la marca: en abril las ~525 impresiones no-marca de la home estaban en posición ~5,7; en
julio, sus ~614 impresiones no-marca están en posición ~27. **La home se hundió en las queries
genéricas, no en las de marca.**

Y la fecha lo explica. Primera impresión de cada página de servicio:

| Página | Primera impresión | Impr. | Pos. actual |
|---|---|---|---|
| `/consultoria` | 2026-05-04 | 62 | 10,0 |
| `/comunicacion` | 2026-05-12 | 833 | 12,9 |
| `/audiovisual` | 2026-05-16 | 429 | 10,1 |
| `/redes-sociales-granada` | 2026-06-22 | 490 | 21,4 |

Las páginas de servicio entran en el índice a principios de mayo. La posición de la home empieza a
degradarse **ese mismo mes** (4,6 → 7,7) y se desploma en junio (16,3).

**Conclusión:** Google reasignó las queries genéricas de la home a las nuevas páginas
especializadas. El movimiento en sí es correcto — para eso se crean páginas de servicio. El problema
es que **las páginas nuevas rankean peor de lo que rankeaba la home**: donde la home estaba en ~5,7,
`/comunicacion` está en 12,9 y `/redes-sociales-granada` en 21,4. La especialización costó
posiciones en vez de ganarlas.

Esto reordena todo el diagnóstico: no es «se ha publicado demasiado», es **«se ha repartido la
autoridad de la home entre páginas hijas que aún no se la han ganado»**.

**Qué hacer (no es revertir):** consolidar autoridad hacia las páginas de servicio en vez de
dejarlas competir solas — enlazado interno desde la home con anchor text de la query objetivo, y
retirar de la home el contenido que la mantiene compitiendo por esas mismas queries. El objetivo
mínimo es devolver a `/comunicacion` y compañía a la posición ~5,7 que tenía la home.

**Límite:** GSC no da la dimensión página+query, así que la reasignación está **inferida por
coincidencia temporal**, no medida directamente. Es una inferencia sólida (fechas, marca aislada
estable, impresiones planas), pero conviene confirmarla con la API de GSC en cuanto se pueda.

---

## Hallazgo 2 — 13 pares de URL duplicados repartiéndose impresiones

`astro.config.mjs:40` documenta la intención: *«Solo una versión por URL»* apoyándose en
`trailingSlash: 'ignore'` (default) más el canonical normalizado de `Base.astro`. **La intención no
se está cumpliendo:** Google tiene ambas versiones indexadas y les asigna impresiones por separado.

| Sin barra | Impr. / pos. | Con barra | Impr. / pos. |
|---|---|---|---|
| `/comunicacion` | 833 / 12,9 | `/comunicacion/` | 132 / **32,3** |
| `/notas/financiacion-startup-enisa-prestamos-participativos` | 699 / 48,5 | idem `/` | 183 / 53,9 |
| `/audiovisual` | 429 / 10,1 | `/audiovisual/` | 100 / **27,1** |
| `/sobre` | 294 / 2,6 | `/sobre/` | 341 / 2,0 |
| `/contacto` | 238 / 2,5 | `/contacto/` | 383 / 2,2 |
| `/notas/plan-comunicacion-ong` | 261 / 12,3 | idem `/` | 43 / 15,5 |
| `/hub` | 208 / 3,3 | `/hub/` | 143 / 2,2 |
| `/notas` | 170 / 61,3 | `/notas/` | 9 / 50,1 |
| `/notas/agencia-pequena-vs-grande` | 78 / 7,8 | idem `/` | 53 / 14,5 |
| `/consultoria` | 62 / 10,0 | `/consultoria/` | 24 / 10,7 |
| `/casos` | 11 / 9,6 | `/casos/` | 69 / 4,8 |
| `/para-quien` | 15 / 18,1 | `/para-quien/` | 3 / 15,7 |
| `/laboratorio/cursos/comunicacion-estrategica-tercer-sector` | 9 / 63,8 | idem `/` | 1 / 91,0 |

Nota metodológica: verifiqué que **el canonical es correcto en ambas variantes** (`/sobre` y
`/sobre/` declaran ambas `https://startidea.es/sobre`). El problema no es el canonical mal escrito;
es que el canonical es una *sugerencia* y aquí Google no la está aplicando porque ambas URLs
devuelven **200**.

### ✅ APLICADO EN PRODUCCIÓN el 2026-08-06

Middleware `startidea-slashredir` activo. Verificado en vivo: `/sobre/`, `/comunicacion/`,
`/audiovisual/` y `/notas/plan-comunicacion-ong/` devuelven **301** a su versión sin barra; la home
`/` sigue en 200; `/sobre` y `/comunicacion` siguen en 200. Sin regresiones: wizard de
`/subvenciones/presentar/nuevo`, sitemap, `llms.txt`, `robots.txt`, OG dinámicas y `/api/health`
responden 200; las 7 cabeceras de seguridad siguen intactas; los redirects previos de `www` y de
`http` siguen funcionando; contenedor `healthy`.

**Qué medir y cuándo:** en 3-4 semanas, que las URLs con barra desaparezcan de GSC y que sus
impresiones se consoliden en la versión sin barra. La señal más clara será `/comunicacion`, que
absorberá las 132 impresiones que hoy se lleva `/comunicacion/` en posición 32,3.

### Dónde va el arreglo (y dónde NO)

**No vale `src/middleware.ts`.** El propio middleware lo advierte en su comentario (líneas 50-55):
en producción las páginas estáticas **no pasan por él**, las sirve Traefik. Y con
`build.format: 'directory'`, todas las páginas del sitio son prerenderizadas
(`dist/client/sobre/index.html`). Un redirect en el middleware no se ejecutaría nunca para estas
URLs.

**Tampoco es un problema del repo.** Comprobado: el sitemap emite las 133 URLs **sin** barra final y
el canonical de `Base.astro` también. Y solo había **2 enlaces internos** con barra
(`FormacionPromo.astro:74` y `agentes-ia.astro:233`), corregidos en este mismo cambio. El origen de
las URLs con barra es histórico: el WordPress antiguo las usaba, y siguen llegando desde enlaces
externos.

**El arreglo va en Traefik**, en el VPS `72.61.195.108` (ojo: **no** es KVM4), en
`/docker/startidea-web-traefik/docker-compose.yml`, junto a los labels ya existentes del contenedor
`startidea-web`. Hay espejo local del stack en
`/Users/STARTIDEA/startidea-infra/stacks/startidea-web-traefik`. Sigue exactamente el patrón de
`startidea-wwwredir`, que ya hace lo mismo para `www`:

Ese compose usa labels en formato **mapa**, no lista. Lo aplicado, literal:

```yaml
      traefik.http.middlewares.startidea-slashredir.redirectregex.regex: "^https://startidea\\.es/(.+)/$$"
      traefik.http.middlewares.startidea-slashredir.redirectregex.replacement: "https://startidea.es/$${1}"
      traefik.http.middlewares.startidea-slashredir.redirectregex.permanent: "true"
      # y en la cadena del router:
      traefik.http.routers.startidea-web.middlewares: startidea-compress,startidea-sec,startidea-slashredir
```

El `$$` es escapado de docker compose: llega al contenedor como `$` literal. Verificado con
`docker inspect` tras recrear — el label real es `^https://startidea\.es/(.+)/$`.

Notas de riesgo, verificadas:

- `(.+)/$` exige al menos un carácter antes de la barra, así que **la home `/` no se toca**.
- No captura URLs con query string (`/foo/?x=1` no termina en `/`). Gap conocido y menor.
- Un 301 sobre un POST lo convierte en GET y pierde el cuerpo. Revisado: no hay formularios que
  publiquen contra rutas terminadas en `/`. Aun así, conviene comprobar el wizard de
  `/subvenciones/presentar/nuevo` tras aplicarlo.

Efecto esperado: deja de repartir señales entre dos URLs y, en `/comunicacion` y `/audiovisual`,
retira de la SERP una variante que rankea ~20 posiciones peor.

---

## Hallazgo 3 — Demanda real desperdiciada por posición

| Página | Impr. | Pos. | Lectura |
|---|---|---|---|
| `/notas/financiacion-startup-enisa-prestamos-participativos` | 699 (+183) | **48,5** | La nota con más demanda del sitio, en posición inservible |
| `/redes-sociales-granada` | 490 | 21,4 | Las queries del clúster salen en 11-17; la página rankea peor que ellas |
| `/notas` | 170 | **61,3** | El índice del blog en posición 61 |
| `/notas/crowdfunding-ong-cuando-funciona` | 172 | 33,0 | Tema con demanda, posición fuera de juego |
| `/notas/que-es-la-innovacion-social` | 49 | **70,2** | Query core de la marca, posición 70 |

---

## Hallazgo 4 — Superficie invisible que diluye

Páginas publicadas que en 4 meses no han pasado de ~10 impresiones y rankean por debajo de 30. No
hacen daño por existir, pero son el síntoma: se creó superficie sin query objetivo detrás.

`/tecnologia` (4 impr, pos 51,5) · `/agentes-ia` (4, 59,7) · `/fundraising` (4, 34,3) ·
`/diagnostico` (4, 14,8) · `/integraciones-google` (8, 25,8) · `/redes-sociales-ia` (1, 10,0) ·
`/como-trabajamos` (2, 30,0) · `/prensa` (2, 5,0) · `/manifiesto` (5, 13,7) ·
`/para-quien/tercer-sector` (2, 44,5) · `/para-quien/instituciones` (1, 42,0) ·
`/laboratorio/cursos/*` (1-18 impr, pos 60-91) · `/casos/*` individuales (2-13 impr).

**Acción propuesta:** no borrar. Decidir para cada una si tiene query objetivo; si no la tiene,
consolidar su contenido en la página pilar del clúster y redirigir. Las fichas de curso con posición
60-91 son candidatas claras a `noindex` mientras no haya demanda que capturar.

---

## Hallazgo 5 — Legacy WordPress: ya resuelto, sin acción

12 URLs antiguas de WP (`/quienessomos/`, `/hub-startidea-espacios-y-comunidad/`,
`/consultoria-e-innovacion-social/`, `/comunicacion-estrategica-y-marketing-social-startidea/`,
`/portfolio_/`, `/produccion-audiovisual-y-podcast-startidea/`, `/category/news/`,
`/politicacookies/`, `/politicaprivacidad/`, `/instagram-cambia-su-formato…/`,
`/que-es-la-cultura-participativa…/`, `/robots-que-impulsan…/`) aparecen con impresiones
**solo hasta mayo** y ninguna en julio: los redirects de `astro.config.mjs:43` funcionaron y Google
ya las ha soltado. Sin acción.

Detalle menor: `/que-es-la-cultura-participativa-y-como-implantarla-en-las-organizaciones/` llegó a
dar **3 clics** en posición 9,6 — más que ninguna página actual de servicio. Su equivalente vivo,
`/notas/cultura-participativa-tercer-sector`, rankea en 19,8 con 31 impresiones. Merece una mirada:
el contenido antiguo funcionaba mejor que el nuevo.

---

## Orden de ejecución propuesto

1. ~~**Verificar el hallazgo 1** (home).~~ ✅ **Hecho el 2026-08-06:** es canibalización de la home
   por las páginas de servicio que entraron en el índice en mayo. Acción pendiente: consolidar
   autoridad hacia ellas con enlazado interno.
2. ~~**301 de trailing slash** (hallazgo 2).~~ ✅ **Hecho el 2026-08-06.**
3. **Rescatar ENISA y `/notas`** (hallazgo 3). Demanda ya existente.
4. **Consolidar superficie invisible** (hallazgo 4). El trabajo lento.

El punto 4 afecta a indexación: requiere OK explícito de Mario antes de desplegar.

## Límite conocido de esta auditoría

GSC expone páginas y queries en tablas separadas: **no hay dimensión página+query**, así que la
canibalización entre páginas distintas (p. ej. `/comunicacion` vs `/notas/plan-comunicacion-ong`
por «plan de comunicación ong») **no se ha podido medir, solo inferir**. Para confirmarla hace falta
la API de GSC con dimensiones combinadas, que el pipeline del HUB no sincroniza hoy.
