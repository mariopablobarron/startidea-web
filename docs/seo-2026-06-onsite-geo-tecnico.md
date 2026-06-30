# SEO/GEO 2026-06 — Mejoras técnicas on-site + checklist Search Console

Sesión de trabajo sobre `startidea.es` (solo el dominio principal; el resto del
ecosistema de la VPS queda fuera de este repo). Complementa al plan de
canibalización en `seo-2026-06-canibalizacion-merchandising.md`.

---

## Hecho en este repo (desplegable con el push)

### 1. Directiva de indexación para Google Discover + AI Overviews

`src/layouts/Base.astro` ahora emite en **todas** las páginas indexables:

```html
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
```

- `max-image-preview:large` → habilita miniatura grande en Google Discover y en
  las tarjetas de las AI Overviews. Sin esto Google usa thumbnail pequeño o
  ninguno.
- `max-snippet:-1` → permite a Google/motores generativos citar pasajes de
  cualquier longitud (mejor probabilidad de ser la fuente citada en una
  respuesta de IA).
- Las páginas con `noindex` (formularios, confirmaciones, portal privado)
  siguen emitiendo `noindex,nofollow` sin cambios.

### 2. Open Graph de artículo en las notas

`src/layouts/Base.astro` admite `ogType` + objeto `article`. Las notas
(`src/pages/notas/[...slug].astro`) ahora emiten:

```html
<meta property="og:type" content="article">
<meta property="article:published_time" content="…">
<meta property="article:modified_time" content="…">
<meta property="article:author" content="Mario Pablo Sánchez Barrón">
<meta property="article:section" content="{category}">
<meta property="article:tag" content="…">   <!-- uno por tag -->
<meta property="og:image:alt" content="{coverAlt|title}">
```

Refuerza el JSON-LD `BlogPosting` con señales OG explícitas de fecha/autor que
algunos crawlers (y el preview de LinkedIn/Slack/WhatsApp) leen antes que el
JSON-LD. `og:image:alt` mejora accesibilidad del preview social.

### Estado de la canibalización merchandising (lado startidea.es)

✅ **Limpio.** No queda ningún enlace a `merchandising.startidea.es` (legacy)
en `src/` ni `public/`. `Ecosistema.astro` apunta al dominio canónico
`merchandising.hubstartidea.es`. La página `/merchandising` del dominio
principal es la de servicio legítima, no compite con la marca. Las acciones
Fase 1/2 del plan (robots/canonical/301 del WooCommerce) viven en su propio
stack, fuera de este repo.

---

## Pendiente — requiere acceso a Search Console / GA4 (lo ejecutas tú)

El conector GA4+GSC se migró a `hub.startidea.tech` (15-may); desde este repo
no hay lectura directa de métricas. Para cerrar el hilo "Search Console
técnico":

1. **Fase 4 del plan de canibalización** (titles con keyword stuffing, CTR 0%,
   858 impresiones): identificar la URL exacta en GSC → Pages, ordenar por
   impresiones y filtrar por la query larga. Reescribir el `<title>` a algo
   natural. Pendiente desde el plan anterior por falta de la URL.
2. **Verificar cobertura**: revisar en GSC → Páginas que las ~2.100 URLs del
   scraper BDNS (`/subvenciones/*` individuales) NO estén indexadas (el filtro
   del sitemap ya las excluye; confirmar que no entraron por enlaces internos).
3. **Re-submit sitemaps** tras el deploy: `sitemap-index.xml` y
   `sitemap-catalogo.xml`. Pedir reindexación de las notas (ahora con OG de
   artículo) y del home.
4. **Seguimiento de métricas** del plan de canibalización a 30/60/90 días
   (clicks de marca en el home, CTR de `/contacto` y `/sobre`).

## Pendiente — contenido de posicionamiento (siguiente sesión editorial)

El monitor GEO (`infra/geo-monitor/`) mide a diario si la IA cita a Startidea
en queries comerciales. Donde la marca NO aparece de forma fiable hay hueco de
contenido a cubrir con notas/landings:

- "mejores agencias de comunicación para ONG / tercer sector en España"
- "agencia que tramita subvenciones a éxito (cobra solo si se concede)"
- "consultoría de innovación social / fundraising en Granada"
- "productora de vídeo / podcast para el tercer sector"

Cada una es candidata a una nota long-form con FAQs (activa Featured Snippet)
enlazada desde la página de servicio correspondiente y desde `llms.txt`.
