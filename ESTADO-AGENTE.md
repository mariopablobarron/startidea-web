# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026, 19:46 (Madrid).

## Encargo actual

Terminadas la revisión acotada de los quick wins de Claude (PR106) y la microtanda de FormacionPromo. Ambas integradas, publicadas y verificadas. Referencia editorial: [auditoría corregida en 8f48dec](https://github.com/mariopablobarron/startidea-web/blob/8f48dec/docs/auditoria-seo-geo-2026-09.md). Detalle en [docs/revision-pr106-2026-09.md](docs/revision-pr106-2026-09.md).

## Código e integración

- PR108: `8dd74134a4ab9fc70bd9a04d940a6f9b2e713b4b`; corregidas incorporaciones generales que excluían públicos, promesa de formación audiovisual sin respaldo, docentes inventados y caducidad de cursos dependiente del build. Cierre documental PR109: `fd92602`.
- PR110: `f3aafbbd53a31bb519afed72a9cb4ceef8e2413f`; único componente de código adicional, `FormacionPromo.astro`, con etiqueta estable «Ver condiciones». Conserva cursos, destinos y diseño.
- Las fichas, índice y llms evalúan vigencia por petición con fecha de Madrid; edición pasada sin formulario, oferta ni inicio de Stripe. Programa, URL, canonical e indexabilidad conservados. Cuatro cursos presentes una vez en sitemap.
- Docente explícito solo en comunicación, donde está acreditado. Componentes de consentimiento y medición sin cambios; dos errores de tipado de sus pruebas corregidos.
- Worktree propio: `/Users/STARTIDEA/startidea-web-wt/codex-seo-revision-pr106-20260908`; rama de cierre `codex/seo-pr110-cierre-20260908`. Observador, `plano`, `qw` y HUB sin cambios de esta sesión.

## Validación y producción

- PR108: 261/261 pruebas, TypeScript limpio, build 309,50 s y 212/212 comprobaciones HTTP en 19 GET locales con el mismo proceso y artefacto antes/después de medianoche de Madrid. Servidor de prueba cerrado. Producción anterior validada en 14 recursos.
- PR110: build 330,73 s y comparación del HTML real: dos páginas, dos bandas, cinco enlaces idénticos y todas las etiquetas «Ver condiciones». Sin tests nuevos para el cambio de texto.
- Producción final verificada a las 19:46: imagen `f3aafbb`, `running/healthy`, fuente completa `f3aafbbd53a31bb519afed72a9cb4ceef8e2413f`, log de despliegue OK. Dos páginas y cinco enlaces correctos por HTTPS. Evidencia privada `formacion-etiqueta-production.json` y pruebas anteriores conservadas.
- Durante `starting` se observaron 404 transitorios en `/` y `/comunicacion`; se recuperaron a 200 al quedar saludable, sin intervención en infraestructura. El despliegue por recreación tiene una ventana de interrupción observada; no hay error HTTP persistente detectado. No afirmar disponibilidad continua ni impacto SEO nulo por ese hecho.

## Límites y pendiente externo

No abrir las 35 landings masivamente, recortar las FAQ sometidas a 21 días, enviar campañas o cambiar HUB, Lazo, plano, precios, políticas o infraestructura. No hay aprobación QW1 pendiente que bloquee este cierre.

La recepción de una solicitud real consentida en GA4 sigue pendiente. Las pruebas acreditan emisión controlada, no recepción en Google. La idempotencia del receptor ante una respuesta perdida sigue sin estar acreditada: [cierre de privacidad](docs/seo-medicion-privacidad-2026-09.md). No atribuir diferencias de GA4 a pérdida orgánica sin tener en cuenta consentimiento y periodos comparables; no hay evaluación posterior suficiente del posicionamiento.

## Acción de Mario y siguiente acción

Acción de Mario: ninguna ahora para esta tanda.

Única siguiente acción: verificar en GA4 la próxima aceptación real consentida cuando exista, sin fabricar conversiones. Mantener el resto del loop acotado al relevo y las decisiones editoriales vigentes.
