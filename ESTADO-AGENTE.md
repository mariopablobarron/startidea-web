# Estado del trabajo — startidea-web

Foto de relevo · 12 de septiembre de 2026. Mejoras SEO publicadas; decisión comercial recibida y contraste de contratación completado.

## Encargo actual

Cerrar lo verificable de la medición real GA4, rendimiento móvil, coherencia comercial de productos y evaluación SEO/GEO. Las entregas editoriales PR117/118 y la comprobación de tipos PR119/120 siguen cerradas.

## Código, integración y producción

- Base remota actualizada: `fef554a5254313a118cf07322c96db18692e4bbc`. Trabajo aislado en `codex/seo-general-20260912`.
- Manifiesto: Three se carga al aproximarse a la sección y la animación se detiene fuera de vista. Se mantienen diseño, partículas, resize y movimiento reducido.
- Productos: tres altas se describen como páginas de alta; se retiran las promesas automáticas de disponibilidad/activación deducidas de tener enlace. Precios, estados, fechas, enlaces y datos estructurados conservados.
- Validación: tipos, 261 pruebas y build completo (282,35 s) correctos. Once páginas de productos pasan 121 comprobaciones. Doce pruebas funcionales de animación y cuatro estados del artefacto compilado correctos. En producción, ocho controles correctos y dos cargas móviles: 305.083 bytes iniciales frente a 501.137 anteriores (196.054 menos); LCP 2.032/2.018 ms, CLS 0. Son mediciones de laboratorio, no efecto SEO ni CWV de campo.
- Integración: [PR121](https://github.com/mariopablobarron/startidea-web/pull/121), `d1d1364cd62f337b43fbad9cf2739638c0985db9`, a las 09:42 UTC. La fuente integrada coincide con el código validado.
- Producción: imagen y fuente `d1d1364`, contenedor arrancado a las 09:46:46 UTC y comprobado saludable a las 09:47. Comprobación a las 09:47: API de salud JSON 200, configuración y base de datos correctas; once páginas del catálogo pasan 121/121 comprobaciones públicas. El despliegue lo hizo el cron vigente, sin intervención manual.

## Medición y límites

GA4 recibe eventos posteriores: 9–11 de septiembre, host exacto Startidea, 45 vistas, 32 sesiones, 18 usuarios; ninguna solicitud aceptada acreditada. Las nueve dimensiones personalizadas se han registrado y verificado mediante API a las 09:40 UTC del día 12. Su disponibilidad con valores depende de procesamiento y eventos posteriores. Una sesión del día 9 se atribuye a chatgpt.com; ya existían visitas desde ese origen en agosto.

Google confirma cinco páginas indexadas, pero los datos finales solo llegan al 9 de septiembre. Notas y BOJA aún informan rastreo anterior a la tanda editorial. No hay base para atribuir ganancias o pérdidas SEO/GEO. El rendimiento medido es de laboratorio, sin INP ni datos de campo. El [informe](docs/seo-general-medicion-2026-09.md) recoge evidencia y protocolo.

## Acción de Mario y siguiente acción

Acción de Mario: ninguna para definir la oferta. Ha respondido «un servicio operativo» para Piloto de redes, Kit de marca y Web para asociaciones; ese es el criterio de entrega. No volver a preguntar disponibilidad deseada ni precios aprobados.

Estado de ejecución: las correcciones de PR121/122 siguen terminadas y comprobadas en público. La revisión posterior de contratación está terminada, sin cambios de aplicación: 14 GET públicos correctos, código HUB desplegado coincidente con el revisado y comprobación de presencia de precios en producción. Faltan las seis referencias de precio usadas por Piloto y Web; sus rutas no pueden completar el pago online sin ellas. Kit necesita cerrar la entrega final; otras prestaciones de los planes requieren validación o implementación. Las 57 pruebas locales del producto no acreditan entrega real. El [informe actualizado](docs/seo-general-medicion-2026-09.md) recoge los límites.

No hay implementación de HUB asignada ni ejecutándose desde esta sesión. No se modificó su relevo ni se interfirió con sus otras líneas de trabajo. Evidencia detallada local: `startidea-web-wt/productos-operativos-evidencias-20260912/`; la revisión técnica distingue servicio con intervención humana de autoservicio completo.

Única siguiente acción, en HUB: completar primero la contratación de Piloto y Web con los importes ya aprobados y validar el flujo, incluido el cobro de alta de Web; después avanzar a los criterios de entrega documentados. La medición posterior queda condicionada a valores de GA4, solicitudes reales y ventanas finales comparables en GSC; no hay otra tanda de código automática. Fuera de alcance siguen TAVILY_API_KEY en .env.example y las demás recomendaciones históricas no retomadas.
