# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026.

## Encargo actual

Revisión acotada de PR106 dentro del loop SEO/GEO autorizado. Referencia editorial: [auditoría corregida en 8f48dec](https://github.com/mariopablobarron/startidea-web/blob/8f48dec/docs/auditoria-seo-geo-2026-09.md). La revisión y su evidencia están en [docs/revision-pr106-2026-09.md](docs/revision-pr106-2026-09.md).

## Código e integración

- Base remota comprobada: `d9a030021267d89ac12d1becd1c4a17d09eee0f1` (PR107), incluye los quick wins de PR106 y la privacidad/medición de PR103–104.
- Worktree propio: `/Users/STARTIDEA/startidea-web-wt/codex-seo-revision-pr106-20260908`, rama `codex/seo-revision-pr106-20260908`. Observador, `plano`, `qw` y HUB sin cambios de esta sesión.
- Corregidas incorporaciones de PR106: públicos de páginas generales, promesa de formación audiovisual sin respaldo, docentes no acreditados y fechas de cursos congeladas al generar la web. Cursos, índice y llms pasan a evaluación por petición; se conserva sitemap y URL. La edición pasada no permite iniciar un pago.
- Tipado de dos callbacks en pruebas de Google corregido. Componentes y lógica de consentimiento/medición sin cambios.
- Código local validado y listo para integrar. Integración y despliegue pendientes en este commit.

## Validación y producción

- 261/261 pruebas y TypeScript sin errores. Checkout probado con simulaciones de proveedores, sin contactos, reservas, pagos ni eventos analíticos reales.
- Build completo correcto en 309,50 s; 212/212 comprobaciones HTTP en 19 GET, con el mismo proceso y artefacto antes/después de medianoche de Madrid. Cursos, índice, llms, schema, sitemap, gracias y 404 correctos. Servidor de prueba cerrado.
- Producción anterior verificada por SSH y HTTPS: imagen `4e2acc7`, `running/healthy`, fuente completa `4e2acc744792dc7cc04fc4de959bef952c59e74f`; 14 recursos públicos, sitemap de cuatro cursos y redirect a consultoría correctos. Esto acredita servicio, no posiciones en Google.

## Límites

- No abrir las 35 landings masivamente ni recortar las FAQ sometidas a 21 días. No hay una aprobación QW1 pendiente que impida esta tanda.
- No enviar campañas de correo, LinkedIn ni publicaciones. No cambiar HUB, Lazo, plano, precios o políticas.
- La recepción de la próxima aceptación real consentida en GA4 sigue pendiente. Las pruebas acreditan emisión controlada, no recepción en Google. El límite de idempotencia del receptor ante una respuesta perdida sigue en [el cierre de privacidad](docs/seo-medicion-privacidad-2026-09.md).
- No atribuir cambios de tráfico a estas correcciones sin periodos completos y comparables; la muestra de GA4 ahora requiere consentimiento.

## Acción de Mario y siguiente acción

Acción de Mario: ninguna para esta revisión, ya autorizada.

Única siguiente acción: integrar y comprobar el SHA desplegado y la respuesta pública; actualizar este relevo con el cierre.
