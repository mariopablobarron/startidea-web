# Plan SEO 2026-06 — Canibalización merchandising + CTR

Origen: análisis del agente analista (`/admin/seo/agent-analyst`) sobre
datos GA4 + Search Console de los últimos 90 días.
Export: `startideaseo20260601.csv` (10 oportunidades identificadas).

---

## Hallazgos críticos

### 1. Canibalización masiva de la marca

`merchandising.startidea.es` está rankeando con autoridad alta para queries
de marca y captando clicks que deberían ir a `startidea.es`:

| Query           | Páginas en SERP | Clicks 90d | URLs típicas que aparecen                              |
|-----------------|----------------:|-----------:|--------------------------------------------------------|
| `startidea`     | **49**          | **1.109**  | `/catalogo/petanca/page/1`, `/producto/alfombrilla-…`  |
| `startidea granada` | 44          | 222        | mismas URLs de catálogo                                |
| `staridea` (typo) | 41            | 158        | productos sueltos                                      |
| `start idea`    | 39              | 150        | catálogo de petanca                                    |
| `star idea`     | 24              | 23         | productos individuales                                 |

**Aprox. 1.660 clicks de marca/año** terminando en alfombrillas, petanca y
marroquinería en vez de en `startidea.es`.

### 2. URLs duplicadas dentro del propio merchandising

Aparecen variantes problemáticas:

- `/catalogo/petanca/page/-1` (paginación inválida)
- `/catalogo/petanca/page/1?ordenamos=precio_minimo&orden=desc`
- `/catalogo/accesorios-de-marroquineria/page/1` con y sin params

Esto duplica páginas a ojos de Google y diluye PageRank interno.

### 3. Caída del 41% en clicks del home

`startidea.es/` pasó de 113 → 67 clicks en la ventana medida.
Hipótesis principal: efecto colateral del problema 1 (la marca rankea cada
vez más en merchandising y menos en el dominio raíz).

---

## Plan de acción

### Fase 1 — Mitigación inmediata (24-48h)

Actuar sobre `merchandising.startidea.es` (NO en este repo; vive en su
propio stack WooCommerce). Lo que hay que tocar allí:

#### 1.1 `robots.txt` del subdominio merchandising

```txt
User-agent: *
Disallow: /*?ordenamos=
Disallow: /*?orden=
Disallow: /catalogo/*/page/
Allow: /catalogo/*/page/1$

Sitemap: https://merchandising.startidea.es/sitemap.xml
```

#### 1.2 Canonical en cada página de producto y catálogo

- Producto: `<link rel="canonical" href="https://merchandising.startidea.es/producto/{slug}">` (sin params).
- Catálogo home: `<link rel="canonical" href="https://merchandising.startidea.es/catalogo/{categoria}/">` (sin `/page/N` y sin ordenamientos).
- Paginación 2+: `<meta name="robots" content="noindex,follow">`.

#### 1.3 Quitar la palabra "Startidea" de los `<title>` de catálogo y producto

Que el branding del subdominio sea "TodoMerchandising" o "Startidea Merch"
en el formato:

- Producto: `{Nombre del producto} — TodoMerchandising`
- Catálogo: `{Categoría} — TodoMerchandising por Startidea`

Objetivo: dejar de competir con la query exacta "startidea" (sola).

### Fase 2 — Solución de raíz (1-3 meses)

`merchandising.hubstartidea.es` es el dominio canónico definitivo del
proyecto (ver `src/components/Ecosistema.astro:51`). El de `startidea.es`
es legacy.

#### Plan de migración

1. Levantar `merchandising.hubstartidea.es` con contenido al 100% paritario.
2. Mapeo URL legacy → nueva, 1:1 cuando sea posible.
3. Redirects 301 desde `merchandising.startidea.es/*` → `merchandising.hubstartidea.es/*` a nivel Coolify/Traefik.
4. Submit del nuevo sitemap en Search Console (propiedad `merchandising.hubstartidea.es`).
5. Esperar 60-90 días para consolidación del traspaso de autoridad.

Mientras tanto, la Fase 1 contiene el sangrado.

### Fase 3 — CTR en startidea.es ✅ HECHO en este PR

Reescritura de title/meta de las dos páginas con CTR catastrófico (0.43%
vs 18% esperado en posición 2):

- `/contacto`: `src/pages/contacto.astro:35-36`
- `/sobre`: `src/pages/sobre.astro:40-41`

Ambos titles ahora incluyen el término principal de la query (Contacto /
Sobre) como primera palabra significativa, eliminado "sin compromiso" que
sonaba a anuncio, y la descripción evita 1ª persona plural alineada con
las reglas de redacción del proyecto.

### Fase 4 — Title con keyword stuffing

Hay dos queries muy largas con CTR 0% (358 + 500 impresiones) que apuntan
a un title plagado de keywords concatenadas. Identificar la URL exacta
desde Search Console (Pages → ordenar por impresiones, filtrar
por la query completa) y reescribir el `<title>` a algo natural y humano.

Pendiente — necesita acceso a Search Console para identificar la URL.

---

## Métricas de seguimiento

| Métrica                                       | Valor actual | Objetivo 90d  |
|-----------------------------------------------|-------------:|--------------:|
| Clicks de marca en `startidea.es/` (90d)      | 67           | 130+          |
| CTR `/contacto`                               | 0.44%        | 5%+           |
| CTR `/sobre`                                  | 0.43%        | 5%+           |
| Páginas de merchandising rankeando para "startidea" | 49     | <5            |
| Impresiones desde queries con keyword stuffing | 858         | desaparecidas |

Re-ejecutar el analista (`/admin/seo/agent-analyst`) a 30, 60 y 90 días
para verificar evolución.

---

## Notas

- Este documento queda en el repo aunque las acciones 1.1-1.3 vivan fuera
  de él. Sirve de checklist y de registro de la hipótesis para verificar
  cuando lleguen las nuevas mediciones.
- Si se confirma la migración a `merchandising.hubstartidea.es` (Fase 2),
  actualizar `Ecosistema.astro` y `OtrosServicios.astro` para que los
  enlaces apunten exclusivamente al nuevo dominio.
