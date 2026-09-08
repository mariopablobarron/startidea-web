# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026.

## Encargo actual

Revisión acotada de PR106 terminada y publicada mediante PR108, cierre documental PR109. Microtanda autorizada de FormacionPromo validada localmente, pendiente de publicación. Referencia editorial: [auditoría corregida en 8f48dec](https://github.com/mariopablobarron/startidea-web/blob/8f48dec/docs/auditoria-seo-geo-2026-09.md). La revisión y su evidencia están en [docs/revision-pr106-2026-09.md](docs/revision-pr106-2026-09.md).

## Código e integración

- Base remota comprobada: `d9a030021267d89ac12d1becd1c4a17d09eee0f1` (PR107), incluye los quick wins de PR106 y la privacidad/medición de PR103–104.
- Worktree propio: `/Users/STARTIDEA/startidea-web-wt/codex-seo-revision-pr106-20260908`, rama actual `codex/seo-formacion-etiqueta-20260908` desde `fd92602009a6295a0168dc62f97e0058a6d4fc1a` (cierre PR109). Observador, `plano`, `qw` y HUB sin cambios de esta sesión.
- Corregidas incorporaciones de PR106: públicos de páginas generales, promesa de formación audiovisual sin respaldo, docentes no acreditados y fechas de cursos congeladas al generar la web. Cursos, índice y llms pasan a evaluación por petición; se conserva sitemap y URL. La edición pasada no permite iniciar un pago.
- Tipado de dos callbacks en pruebas de Google corregido. Componentes y lógica de consentimiento/medición sin cambios.
- [PR108](https://github.com/mariopablobarron/startidea-web/pull/108) integrada en `8dd74134a4ab9fc70bd9a04d940a6f9b2e713b4b`. Fuente y pruebas idénticas al head validado `3e227b1`; su cierre PR109 solo modificó documentación. La nueva microtanda cambia únicamente el componente FormacionPromo.

## Validación y producción

- 261/261 pruebas y TypeScript sin errores. Checkout probado con simulaciones de proveedores, sin contactos, reservas, pagos ni eventos analíticos reales.
- Build completo correcto en 309,50 s; 212/212 comprobaciones HTTP en 19 GET, con el mismo proceso y artefacto antes/después de medianoche de Madrid. Cursos, índice, llms, schema, sitemap, gracias y 404 correctos. Servidor de prueba cerrado.
- Producción verificada por SSH y HTTPS a las 19:32 de Madrid: imagen `8dd7413`, `running/healthy`, fuente completa `8dd74134a4ab9fc70bd9a04d940a6f9b2e713b4b`, log de despliegue OK. Los 14 recursos públicos comprobados tienen los cambios esperados, las cuatro fichas conservan canonical/indexabilidad y el sitemap las incluye una vez. Sin instructor inventado; redirect a consultoría correcto. Evidencia privada `pr106-public-after.json`. Esto acredita servicio, no posiciones en Google.

## Límites

- No abrir las 35 landings masivamente ni recortar las FAQ sometidas a 21 días. No hay una aprobación QW1 pendiente que impida esta tanda.
- No enviar campañas de correo, LinkedIn ni publicaciones. No cambiar HUB, Lazo, plano, precios o políticas.
- La recepción de la próxima aceptación real consentida en GA4 sigue pendiente. Las pruebas acreditan emisión controlada, no recepción en Google. El límite de idempotencia del receptor ante una respuesta perdida sigue en [el cierre de privacidad](docs/seo-medicion-privacidad-2026-09.md).
- No atribuir cambios de tráfico a estas correcciones sin periodos completos y comparables; la muestra de GA4 ahora requiere consentimiento.

## Acción de Mario y siguiente acción

Acción de Mario: ninguna para esta revisión, ya autorizada.

Única siguiente acción: integrar FormacionPromo y comprobar producción. Validación local completa: build 330,73 s y comparación HTML con cinco enlaces conservados en dos bandas de dos páginas. Cambio local: etiqueta fija «Ver condiciones» y eliminación del mapa de estados estáticos, conservando los cinco enlaces de cursos presentes en dos bandas publicadas. Sin otros módulos de código modificados.
