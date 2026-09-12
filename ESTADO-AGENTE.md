# Estado del trabajo — startidea-web

Foto de relevo · 12 de septiembre de 2026. Revisión general retomada por Mario.

## Encargo actual

Cerrar lo verificable de la medición real GA4, rendimiento móvil, coherencia comercial de productos y evaluación SEO/GEO. Las entregas editoriales PR117/118 y la comprobación de tipos PR119/120 siguen cerradas.

## Código, integración y producción

- Base remota actualizada: `fef554a5254313a118cf07322c96db18692e4bbc`. Trabajo aislado en `codex/seo-general-20260912`.
- Manifiesto: Three se carga al aproximarse a la sección y la animación se detiene fuera de vista. Se mantienen diseño, partículas, resize y movimiento reducido.
- Productos: tres altas se describen como páginas de alta; se retiran las promesas automáticas de disponibilidad/activación deducidas de tener enlace. Precios, estados, fechas, enlaces y datos estructurados conservados.
- Validación: tipos, 261 pruebas y build completo (282,35 s) correctos. Once páginas de productos pasan 121 comprobaciones. Doce pruebas funcionales de animación y cuatro estados del artefacto compilado correctos.
- Integración y publicación de esta tanda: pendientes al preparar este cambio. La última producción comprobada sigue en `fef554a`, saludable; no atribuir todavía al público las correcciones locales.

## Medición y límites

GA4 recibe eventos posteriores: 9–11 de septiembre, host exacto Startidea, 45 vistas, 32 sesiones, 18 usuarios; ninguna solicitud aceptada acreditada. Las nueve dimensiones personalizadas se han registrado y verificado mediante API a las 09:40 UTC del día 12. Su disponibilidad con valores depende de procesamiento y eventos posteriores. Una sesión del día 9 se atribuye a chatgpt.com; ya existían visitas desde ese origen en agosto.

Google confirma cinco páginas indexadas, pero los datos finales solo llegan al 9 de septiembre. Notas y BOJA aún informan rastreo anterior a la tanda editorial. No hay base para atribuir ganancias o pérdidas SEO/GEO. El rendimiento medido es de laboratorio, sin INP ni datos de campo. El [informe](docs/seo-general-medicion-2026-09.md) recoge evidencia y protocolo.

## Acción de Mario y siguiente acción

Acción de Mario pendiente: precisar qué se puede entregar hoy en Piloto de redes, Kit de marca y Web para asociaciones. La pregunta ya está enviada; no reabrir los precios aprobados. La aclaración genérica y la optimización pueden cerrarse sin inventar esa respuesta.

Única siguiente acción de ejecución: integrar esta tanda validada y verificar imagen, salud y comportamiento públicos; después actualizar este relevo con esa evidencia. Fuera de alcance siguen TAVILY_API_KEY en .env.example y las demás recomendaciones históricas no retomadas.
