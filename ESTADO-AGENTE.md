# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026, 18:40 (Madrid).

## Encargo actual

Ninguno abierto. Los quick wins de la auditoría SEO+GEO están desplegados y
verificados en producción. Queda una decisión de Mario (QW1, abajo).

## Código e integración

- `origin/main` = PR #106 (`4e2acc7`), sobre #103 (`dca237f`), #104, #105.
- PR #106 ejecuta QW2–QW10 de `docs/auditoria-seo-geo-2026-09.md`. Se reconstruyó
  desde cero sobre `origin/main` tras descubrir que la base anterior (`30672da`)
  había quedado atrás; regla aplicada: lo que ya estaba en producción gana, así
  que `CursoRelacionado`, `FormacionPromo`, `NotasRelacionadas` y el sistema de
  eventos de `AnalyticsTracker` se usan con la API de #101 sin tocarla.
- El único fichero solapado con #103–#105 fue `src/content/config.ts`, en
  colecciones distintas. Rebase limpio, sin conflictos.
- Worktrees: `qw` (esta tanda, ya integrada) y `plano` (referencia, árbol sucio,
  no commitear). El checkout de `/Users/STARTIDEA/startidea-web` sigue siendo
  observador.

## Resultado

- Titles y metas de 15 páginas de servicio; redirect `/innovacion-social` →
  `/consultoria`, que devolvía 404.
- Cursos: la colección gana `seoTitle`, `metaDescription` y `faqs`; la ficha
  emite `FAQPage` y un `Course` con `instructor` y `hasCourseInstance`.
  Corregido `validFrom`, que usaba la fecha de la edición y dejaba la `Offer`
  inválida justo mientras se venden las plazas.
- `llms.txt` y `llms-full.txt` completos (formación, productos, herramientas,
  casos, diagnósticos, contacto). Corregido un fallo vivo: `llms-full.txt`
  emitía las 61 notas con barra final, que responde 301.
- Home: ficha de entidad y bloque de puertas de entrada en HTML estático, porque
  los rastreadores de IA no ejecutan el JavaScript de Lazo.
- Ninguna fecha de edición caduca sola en el texto: helper `src/lib/cursos.ts`
  con `edicionVigente()`, usado por ficha e índice de cursos y por los dos
  endpoints `llms`. Se evalúa en el build.
- Sin tocar: medición, consentimiento, precios, checkout, Lazo ni textos de
  política. El aviso de #103 sobre la muestra de GA4 sigue vigente.

## Despliegue y validación

- Cron-pull KVM8: `4e2acc7` sirviendo hacia las 18:36 (Madrid), unos tres
  minutos después del squash.
- Local: `npm run build` en verde, `vitest` 237/237. `tsc --noEmit` deja dos
  errores preexistentes en `tests/google-analytics-consent.test.ts`, llegados
  con #103/#104 y ajenos a esta tanda.
- Producción comprobada: cinco titles nuevos, redirect 301 correcto,
  `llms-full.txt` sin barras finales, `llms.txt` con la sección de formación, y
  diez destinos internos nuevos a 200.

## Límites y siguiente acción

Bloqueos conocidos:

- **QW6 fase 2** (recortar las 39 FAQ de `/que-hacemos` a 8 paraguas) espera 21
  días y un paso previo en Search Console. Condiciones escritas en la cabecera
  de `que-hacemos.astro`.
- El compromiso comercial de «48 h» que proponía el informe para financiación de
  empresas no se ha introducido: no está documentado como compromiso real.
- `src/components/CtaConversion.astro` sigue definido y sin usar desde #39.
  Montarlo o borrarlo, pero no dejarlo así.
- Sigue abierto lo que dejó #104: verificar en GA4 la próxima aceptación real
  consentida, sin fabricar conversiones. La recepción en los informes de Google
  no está acreditada todavía, y el receptor no garantiza idempotencia ante una
  respuesta de red perdida. Detalle en `docs/seo-medicion-privacidad-2026-09.md`.

Decisión pendiente de Mario (**QW1**): abrir al índice las 35 landings de
`/subvenciones/territorio/` y `/categoria/`. Revierte una lista blanca marcada
«OK Mario 2026-09-02» y en la prueba disparó el rate-limit del HUB, 503 en 35 de
35. Análisis en `docs/propuesta-landings-subvenciones.md`.

Única siguiente acción, no técnica y con fecha: llenar el taller del sábado 19
de septiembre. Los textos de Buttondown, LinkedIn y correo directo están
redactados en `docs/auditoria-seo-geo-2026-09.md`, apartado QW5a.

Detalle: `docs/auditoria-seo-geo-2026-09.md` y
`docs/propuesta-landings-subvenciones.md`.
