# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026. Microtanda de prensa validada localmente; publicación pendiente.

## Encargo actual

Microtanda autorizada de prensa: miniaturas PNG existentes para dos descargas PDF y fila Audiencias con cuatro públicos. Build y 47/47 comprobaciones de navegador correctos; publicación pendiente. La revisión PR106 y FormacionPromo anteriores están integradas, publicadas y verificadas. Referencia editorial: [auditoría corregida en 8f48dec](https://github.com/mariopablobarron/startidea-web/blob/8f48dec/docs/auditoria-seo-geo-2026-09.md). Detalle en [docs/revision-pr106-2026-09.md](docs/revision-pr106-2026-09.md).

## Código e integración

- PR108: `8dd74134a4ab9fc70bd9a04d940a6f9b2e713b4b`; corregidas incorporaciones generales que excluían públicos, promesa de formación audiovisual sin respaldo, docentes inventados y caducidad de cursos dependiente del build. Cierre documental PR109: `fd92602`.
- PR110: `f3aafbbd53a31bb519afed72a9cb4ceef8e2413f`; único componente de código adicional, `FormacionPromo.astro`, con etiqueta estable «Ver condiciones». Conserva cursos, destinos y diseño.
- Las fichas, índice y llms evalúan vigencia por petición con fecha de Madrid; edición pasada sin formulario, oferta ni inicio de Stripe. Programa, URL, canonical e indexabilidad conservados. Cuatro cursos presentes una vez en sitemap.
- Docente explícito solo en comunicación, donde está acreditado. Componentes de consentimiento y medición sin cambios; dos errores de tipado de sus pruebas corregidos.
- Worktree actual: `/Users/STARTIDEA/startidea-web-wt/codex-seo-prensa-20260908`; rama `codex/seo-prensa-20260908`, desde `b9ffe12b6f02dc4aef59945cfaeca313c53a9ee5`. Solo `prensa.astro` cambia en el código; detalle en [docs/seo-prensa-2026-09.md](docs/seo-prensa-2026-09.md). Observador, `plano`, `qw` y HUB sin cambios de esta sesión.

## Validación y producción

- Prensa: build 328,60 s, navegador 47/47 en escritorio/móvil, PDF y PNG byte a byte intactos, cuatro enlaces download iguales y revisión independiente sin hallazgos. Servidor local cerrado.

- PR108: 261/261 pruebas, TypeScript limpio, build 309,50 s y 212/212 comprobaciones HTTP en 19 GET locales con el mismo proceso y artefacto antes/después de medianoche de Madrid. Servidor de prueba cerrado. Producción anterior validada en 14 recursos.
- PR110: build 330,73 s y comparación del HTML real: dos páginas, dos bandas, cinco enlaces idénticos y todas las etiquetas «Ver condiciones». Sin tests nuevos para el cambio de texto.
- Producción final verificada a las 19:46: imagen `f3aafbb`, `running/healthy`, fuente completa `f3aafbbd53a31bb519afed72a9cb4ceef8e2413f`, log de despliegue OK. Dos páginas y cinco enlaces correctos por HTTPS. Evidencia privada `formacion-etiqueta-production.json` y pruebas anteriores conservadas.
- Durante `starting` se observaron 404 transitorios en `/` y `/comunicacion`; se recuperaron a 200 al quedar saludable, sin intervención en infraestructura. El despliegue por recreación tiene una ventana de interrupción observada; no hay error HTTP persistente detectado. No afirmar disponibilidad continua ni impacto SEO nulo por ese hecho.

## Límites y pendiente externo

No abrir las 35 landings masivamente, recortar las FAQ sometidas a 21 días, enviar campañas o cambiar HUB, Lazo, plano, precios, políticas o infraestructura. No hay aprobación QW1 pendiente que bloquee este cierre.

La recepción de una solicitud real consentida en GA4 sigue pendiente. Las pruebas acreditan emisión controlada, no recepción en Google. La idempotencia del receptor ante una respuesta perdida sigue sin estar acreditada: [cierre de privacidad](docs/seo-medicion-privacidad-2026-09.md). No atribuir diferencias de GA4 a pérdida orgánica sin tener en cuenta consentimiento y periodos comparables; no hay evaluación posterior suficiente del posicionamiento.

## Acción de Mario y siguiente acción

Acción de Mario: ninguna ahora para esta tanda.

Única siguiente acción: integrar prensa y verificar la versión publicada. El pendiente externo de GA4 se mantiene sin fabricar conversiones.
