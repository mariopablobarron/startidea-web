# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026. Microtanda de prensa cerrada.

## Encargo actual

Corregidas las miniaturas de las dos descargas PDF de `/prensa` y actualizada la fila Audiencias con empresas, instituciones, entidades sociales y personas que emprenden. Resto de la página y archivos originales intactos. [Evidencia y límites](docs/seo-prensa-2026-09.md).

## Código e integración

- PR112: `7b7aca0f5f7aa3edc2fd658c62f4f0c0af5012d7`, integrada desde el head validado `9e2d90b1f74a47fbbfa71b2b044be5ef8da9a654`, sin diferencias de código tras el squash.
- Solo cambia `src/pages/prensa.astro` en el código: dos propiedades preview, fallback del img y fila Audiencias. PDFs, enlaces y atributos download conservados.
- Revisión PR106 y FormacionPromo cerradas previamente en PR108/110 y cierres109/111: [revisión anterior](docs/revision-pr106-2026-09.md).
- Worktree propio: `/Users/STARTIDEA/startidea-web-wt/codex-seo-prensa-20260908`. Observador y otros worktrees sin cambios de esta sesión.

## Validación y producción

- Build 328,60 s PASS; 47/47 comprobaciones locales en Chrome escritorio/móvil, después de reproducir las dos miniaturas rotas en producción. Revisión independiente sin hallazgos.
- Producción: verificada a las 20:22 CEST (18:22 UTC), imagen `7b7aca0` en estado `running/healthy`, fuente completa `7b7aca0f5f7aa3edc2fd658c62f4f0c0af5012d7` y log de despliegue OK. Chrome por HTTPS 47/47: previews visibles, cuatro públicos, canonical, descargas y hashes conservados.
- Evidencia privada: `seo-baseline-privado-20260908/prensa-{production-before,local-after,production-after}.json`, capturas limitadas a los logos objetivo y `prensa-build.log`. Navegador y servidor local cerrados.
- La recreación del contenedor produjo 404 transitorios en la tanda anterior PR110, recuperados al quedar saludable. No se modifica infraestructura ni se acredita disponibilidad continua o efecto en posicionamiento.

## Límites y pendiente externo

No abrir las 35 landings masivamente, recortar FAQ sometidas a 21 días, enviar campañas o cambiar HUB, Lazo, plano, precios, políticas o infraestructura. El contraste del logo blanco sobre fondo claro es un defecto previo fuera de esta microtanda.

La recepción de una solicitud real consentida en GA4 sigue pendiente. Las pruebas acreditan emisión controlada, no recepción en Google. La idempotencia del receptor del HUB ante una respuesta perdida sigue sin estar acreditada: [cierre de privacidad](docs/seo-medicion-privacidad-2026-09.md). No atribuir diferencias de GA4 a pérdida orgánica sin considerar consentimiento y periodos comparables; no hay evaluación posterior suficiente del posicionamiento.

## Acción de Mario y siguiente acción

Acción de Mario: ninguna para esta tanda.

Única siguiente acción: el coordinador retoma el loop desde este cierre y prioriza el siguiente defecto demostrado, manteniendo el pendiente externo de GA4 sin fabricar conversiones.
