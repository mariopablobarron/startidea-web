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

Hipótesis a comprobar, en orden: (a) la home compite ahora con páginas internas por las queries de
marca y genéricas; (b) la degradación es un artefacto de aparecer para muchas más queries irrelevantes
(la posición media empeora aunque no se pierda ninguna posición real); (c) pérdida real de autoridad.
La (b) es la más probable dado el patrón general de dilución — **verificar antes de actuar**.

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

```yaml
- "traefik.http.middlewares.startidea-slashredir.redirectregex.permanent=true"
- "traefik.http.middlewares.startidea-slashredir.redirectregex.regex=^https://startidea\\.es/(.+)/$$"
- "traefik.http.middlewares.startidea-slashredir.redirectregex.replacement=https://startidea.es/$${1}"
# y añadirlo a la cadena del router:
- "traefik.http.routers.startidea-web.middlewares=startidea-compress,startidea-sec,startidea-slashredir"
```

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

1. **Verificar el hallazgo 1** (home). Sin esto, lo demás es ruido de fondo.
2. **301 de trailing slash** (hallazgo 2). Bajo riesgo, efecto medible en semanas.
3. **Rescatar ENISA y `/notas`** (hallazgo 3). Demanda ya existente.
4. **Consolidar superficie invisible** (hallazgo 4). El trabajo lento.

Los puntos 2 y 4 afectan a indexación: requieren OK explícito de Mario antes de desplegar.

## Límite conocido de esta auditoría

GSC expone páginas y queries en tablas separadas: **no hay dimensión página+query**, así que la
canibalización entre páginas distintas (p. ej. `/comunicacion` vs `/notas/plan-comunicacion-ong`
por «plan de comunicación ong») **no se ha podido medir, solo inferir**. Para confirmarla hace falta
la API de GSC con dimensiones combinadas, que el pipeline del HUB no sincroniza hoy.
