# Revisión general SEO/GEO y medición

12 de septiembre de 2026. Base remota: `fef554a5254313a118cf07322c96db18692e4bbc`. Retomada de cuatro áreas de la [auditoría corregida](auditoria-seo-geo-corregida-2026-09.md): recepción en GA4, rendimiento móvil, coherencia comercial y efecto SEO/GEO. La [tanda editorial anterior](seo-editorial-publicos-2026-09.md) permanece cerrada; este informe actualiza los pendientes correspondientes de la [conciliación](seo-conciliacion-2026-09.md).

**Estado de publicación:** cambios integrados mediante [PR121](https://github.com/mariopablobarron/startidea-web/pull/121), `d1d1364cd62f337b43fbad9cf2739638c0985db9`, y publicados. Imagen y fuente coinciden; contenedor arrancado a las 09:46:46 UTC y comprobado saludable a las 09:47. A las 09:47, salud JSON correcta y 121/121 comprobaciones públicas de productos. La comprobación móvil pública también está completada: dos cargas y ocho controles correctos. Las nueve definiciones personalizadas de GA4 están guardadas y confirmadas por API; queda observar sus valores en informes y una aceptación real de lead. No se declara una mejora de posicionamiento ni disponibilidad comercial completa.

## Recepción y configuración de GA4

La propiedad `410265807`, con zona horaria `Etc/UTC`, devuelve para el **9–11 de septiembre** un total de **45 vistas, 32 sesiones y 18 usuarios**. Son datos recibidos en GA4 posteriores a la tanda anterior; no una prueba completa del recorrido de conversión ni del origen consentido de cada evento. No aparecen eventos de aceptación de leads en la consulta. La ausencia no demuestra que el formulario falle, ni equivale a cero solicitudes o ventas.

La lectura inicial del 12 de septiembre devolvió cero definiciones personalizadas. Tras guardarlas mediante la interfaz, la lectura de API de las **09:40:26 UTC confirma 9/9**, coincidentes con el manifiesto y con ámbito Evento: `link_type`, `form_type`, `target_type`, `course_id`, `source_type`, `intent_type`, `method`, `source_path` y `target_path`.

Quedan pendientes los valores utilizables en informes. Google indica un plazo de 24–48 horas desde el envío de los datos personalizados y la creación de la dimensión; no basta con esperar desde el despliegue del código. [Ayuda oficial de GA4](https://support.google.com/analytics/answer/14239696?hl=es). No se atribuyen datos históricos al registro nuevo. La menor cobertura tras exigir consentimiento no debe confundirse con una caída de tráfico.

## Rendimiento móvil

Baseline público con móvil emulado de 390 × 844, Slow 4G y CPU 4×; cada navegación parte de un contexto nuevo. Resultados de laboratorio:

| Página | LCP observado | CLS al cargar |
|---|---:|---:|
| Portada, dos muestras | 2.354 / 2.080 ms | 0 / 0 |
| Comunicación | 1.916 ms | 0 |
| Piloto de redes | 1.931 ms | 0 |

CrUX no ofreció datos para esas páginas y PageSpeed API respondió 429. No hay puntuación Lighthouse, medición de INP ni acreditación de Core Web Vitals con usuarios reales.

Se reprodujo en la portada la descarga anticipada de Three —195.919 bytes comprimidos, más su helper— y la creación de WebGL cuando el Manifiesto estaba fuera de vista. `Manifesto.astro` ahora inicia la importación al aproximarse la sección y pausa la animación al salir o quedar oculta. Se conservan escena, contenido, resize y movimiento reducido; vídeo, Lazo, CSS y fuentes quedan intactos.

La comprobación funcional local pasa **12/12**: sin descarga/contexto/animación inicial, una sola importación y contexto, pausa y reanudación, carrera durante la descarga, resize y ausencia de errores registrados. Ocultación y movimiento reducido se comprobaron mediante propiedades controladas; no se acredita ocultación nativa real. Esta prueba en desarrollo no es comparable en tiempos al baseline público.

El artefacto optimizado también se comprueba localmente en cuatro estados: inicio sin Three/contexto/RAF; sección visible con 98 dibujos y un contexto; fuera de vista, contador estable 117→117 y ningún RAF pendiente; regreso, 145→193 dibujos con el mismo contexto. Sin errores registrados. No se atribuyen mejoras de LCP, INP, conversión o SEO al cambio.

En producción `d1d1364`, a las 09:48 UTC, dos cargas con las mismas condiciones registran LCP **2.032 / 2.018 ms**, CLS **0 / 0** y ninguna descarga de Three antes de acercarse al Manifiesto. La transferencia inicial pasa de **501.137 a 305.083 bytes** en ambas muestras: **196.054 bytes menos (39,12 %)**; el helper sigue cargando. Es ahorro observado en estas cargas, no una mejora garantizada de tiempos para toda la población. El smoke público acredita una única importación/contexto, animación visible, pausa fuera de vista (354→354 dibujos; RAF 0) y reanudación (454→526), sin errores registrados. Las **8/8 comprobaciones públicas** pasan. No se activó consentimiento ni se enviaron formularios; los tiempos se midieron sin instrumentación funcional.

## Coherencia comercial de los diez productos

Tres fichas con enlace de alta —Kit de marca, Piloto y Web para asociaciones— mostraban «Ya se puede usar» junto a estados de desarrollo y beta futura. En Piloto, la ficha aplazaba el precio a una confirmación posterior mientras el alta pública invitaba a pagar un plan. Los GET acreditaron páginas públicas de alta, no cobro ni entrega completos.

Las dos plantillas cambian únicamente los tres distintivos a **«Página de alta»** y el encabezado/párrafo de esas tres fichas a una explicación del plan y de los pasos y condiciones que debe consultar la persona en el alta. Se mantienen los diez productos, enlaces, flags, precios, impuestos, Markdown, preguntas frecuentes, metadatos y JSON-LD. Las siete fichas sin alta permanecen idénticas.

El harness compara once páginas con el baseline público congelado a las 09:33 UTC: **121/121 condiciones locales PASS**, incluidas canonicals, metas, JSON-LD, ofertas, enlaces, importes, artículos y `main`. Solo admite los cambios de texto descritos. No envía formularios, ejecuta SDK ni sigue altas externas.

**Dato comercial pendiente de Mario:** el alcance que puede contratarse y entregarse hoy en cada una de las tres altas. Los importes de Piloto ya aprobados no vuelven a preguntarse. No se modifica HUB, Stripe ni se deduce capacidad de entrega del estado Beta/Construcción. `BlogPosting` se conserva porque las fichas presentan planes editoriales; no se inventa `Offer` para convertir un plan en producto disponible.

## Efecto SEO/GEO y protocolo de comparación

La consulta de GSC solicitó 12 de agosto–11 de septiembre, filtrando el host `https://startidea.es/`. Los datos **finales** solo alcanzan el **9 de septiembre**: **105 clics y 9.856 impresiones en 29 días**, con agregación `byPage`; no deben equipararse automáticamente al total por propiedad. El 10–11 aún no es final. Del periodo posterior tomado desde el 9 únicamente existe **un día: 9 clics y 487 impresiones**. No comparar estos periodos desiguales como una mejora o pérdida.

Las cinco inspecciones dan PASS, indexación y robots permitidos, recuperación correcta y canonical de Google coincidente con el declarado. Último rastreo UTC:

| Ruta | Rastreo registrado |
|---|---|
| `/` | 12/09, 04:44 |
| `/comunicacion` | 10/09, 23:21 |
| `/que-hacemos` | 10/09, 06:54 |
| `/notas` | 06/09, 09:51 |
| `/subvenciones/boja-2026-inclusion-social` | 30/08, 08:32 |

Notas y BOJA todavía no acreditan un rastreo posterior a la tanda editorial. El rastreo de Comunicación tampoco dispone aún de días finales posteriores. PASS no demuestra que Google ya haya procesado todo el contenido nuevo ni que lo posicione mejor.

Para comparar, conservar host, filtros, agregación, zona horaria, URLs, consultas y dispositivos (esta extracción no aplica filtro de país); usar ventanas completas equivalentes y separar la tanda editorial del 8–9 de septiembre de los cambios del 12. El intervalo 9 de septiembre–6 de octubre solo podrá tratarse como 28 días completos cuando GSC publique todos esos días como finales, revisable desde el 7 de octubre de forma condicionada. Si el rastreo es posterior o la muestra insuficiente, desplazar o ampliar la observación. No es un experimento causal.

La consulta autenticada de referencias de IA en GA4, con host exacto y siete dominios de origen, devuelve tres filas de `chatgpt.com`: 18 de agosto, una sesión y cinco vistas; 26 de agosto, una sesión y una vista; 9 de septiembre, una sesión y una vista. No aparecen otros dominios de la lista. Para el 9–11 de septiembre solo hay **una sesión y una vista atribuidas a ChatGPT**; ya existía tráfico anterior y no se comparan ventanas desiguales como crecimiento. Son visitas atribuidas, no evidencia de que una respuesta haya citado Startidea ni de efecto de los cambios.

GSC tampoco mide citas de asistentes. La siguiente comprobación de respuestas debe reutilizar las ocho preguntas sin marca de la sección 7 de la auditoría corregida, manteniendo modelo, idioma, localización y búsqueda web, y conservando cada respuesta completa. Se distinguirán mención de marca, enlace citado y exactitud de la respuesta; no comparar ese panel con el 4 % histórico si sus condiciones y denominador no son los mismos. No hay una nueva prueba de citabilidad que permita atribuir efecto a esta tanda. Las FAQ permanecen completas: su revisión sigue condicionada a 21 días desde indexación acreditada y datos consulta-página; no se recortan por fecha de despliegue.

## Validación y publicación

- Build completo: **PASS, 282,35 s**. Typecheck: **PASS**. Pruebas: **261/261**, en 20 archivos.
- Productos: **121/121** sobre el artefacto local y **121/121** en público. Manifiesto: **12/12** comprobaciones funcionales, cuatro estados del artefacto local y **8/8** comprobaciones públicas; dos mediciones móviles posteriores.
- GA4: registro **9/9** confirmado por API; pendientes valores posteriores al registro y evidencia de aceptación real de lead.
- Producción `d1d1364`: fuente e imagen coincidentes, contenedor saludable, `/api/health` HTTP 200 con JSON `ok: true`, configuración y base de datos correctas. Productos: **121/121 condiciones públicas** a las 09:47 UTC. No se ha medido la duración del cambio de contenedor ni se afirma ausencia de interrupciones.

Evidencia fuera del repositorio, en `startidea-web-wt/seo-general-evidencias-20260912/`: `measurement-final-private.json`, `ga4-ai-sources-private.json` y `ga4-definitions-verified-final.json` —solo agregados y resultados sanitizados en este documento—, `productos/baseline-manifest.json`, `productos/local-report.json`, `productos/prod-report.json`, `production-runtime.txt`, `production-health.json`, `rendimiento/README.md`, `rendimiento/functional-checks.json`, `rendimiento/artifact-*.json`, `rendimiento/prod-summary.json`, `build.log`, `typecheck.log` y `tests.log`. No se incorporan consultas individuales, identificadores de visitantes ni datos personales al informe.
