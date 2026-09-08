# Conciliación del informe SEO/GEO y las entregas PR101–113

8 de septiembre de 2026. Revisión de lectura y documentación sobre `origin/main` actualizado, `58691987fe589c3055fc8a0eac96cc0ec4804905`. No es otra auditoría ni una nueva tanda de código.

El criterio es el [informe corregido de `8f48dec`](auditoria-seo-geo-corregida-2026-09.md). El archivo homónimo que volvió a main con las entregas de Claude contiene el borrador anterior; queda identificado como histórico. Se recuperan el informe corregido y su evidencia pública original, sin convertir aquella fotografía en una comprobación actual.

## Decisión de cierre

**Pausar las microtandas automáticas de código.** Los defectos funcionales acometidos tienen validación e historial de publicación. Quedan resultados por medir, recomendaciones sin diagnóstico suficiente y textos comerciales que requieren una revisión acotada. La auditoría completa no está «resuelta».

La única acción inmediata de esta conciliación es eliminar la ambigüedad entre los documentos y dejar un inventario fiable. No se registra una nueva automatización, ni se modifica la que pueda coordinar el loop: la recomendación de pausa se devuelve al coordinador.

## Matriz por prioridad

«Resuelto» se refiere al criterio técnico o editorial comprobado, nunca a una mejora de tráfico, indexación efectiva o ventas.

| Prioridad | Punto del informe corregido | Estado | Evidencia y límite |
|---|---|---|---|
| P0 | Baseline separado por host, consulta y página | **Resuelto con evidencia para la extracción inicial** | PR101: GSC conjunto `date/query/page/device`, totales aparte sin JOIN y GA4 con host exacto. Dos ventanas completas anteriores a los cambios. No certifica todo el tráfico ni todos los bots; no es un resultado posterior. [Recorridos y medición](seo-recorridos-2026-09.md#comparación-y-validación). |
| P0 | Falsa alerta de canibalización del HUB | **Fuera de alcance; reparación no acreditada** | El informe corregido documenta el JOIN defectuoso. El baseline independiente evita usarlo; aquí no se ha cambiado ni revalidado el HUB. No usar «1.111 páginas» para decidir consolidaciones. |
| P0/P1 | Emisión analítica con consentimiento y solicitudes aceptadas | **Resuelto con evidencia en navegador; recepción pendiente de medición** | PR103/104: consentimiento, URLs saneadas, utilidades excluidas, señal de un solo uso tras aceptación. SDK real con receptores interceptados. Google no está acreditado como receptor de una solicitud real consentida posterior. [Privacidad](seo-medicion-privacidad-2026-09.md). |
| P1 | Cuatro cursos accesibles desde servicios/notas; ENISA/CDTI hacia empresas | **Resuelto con evidencia** | PR101/102: cuatro cursos con entradas contextuales, ENISA/CDTI → `/financiacion-empresas#expediente`; 17 comprobaciones públicas de recorridos. Siete servicios con 21 lecturas seleccionadas. No se añadió plazo de 48 horas. [Mapa de recorridos](seo-recorridos-2026-09.md#recorridos). |
| P1 | Recomendaciones de notas que rotaban mensualmente | **Resuelto en servicios prioritarios** | Selección explícita y estable en `src/components/NotasRelacionadas.astro`; entradas de los servicios publicadas en PR101. No equivale a haber revisado todo el grafo editorial. |
| P1 | Utilidades anunciadas en sitemap; portal sin directivas | **Resuelto técnicamente; efecto en GSC pendiente de tiempo** | PR101/102: 28 comprobaciones públicas de sitemap/noindex/canonical. Pedidos/confirmaciones/portal fuera del sitemap, landings comerciales conservadas. Un noindex publicado no demuestra que Google ya haya retirado una URL. |
| P1 | `lastmod` inventado en cada petición | **Resuelto con evidencia** | Catálogo omite la fecha; notas conservan fechas editoriales. Pruebas de estabilidad en `tests/seo-sitemaps.test.ts`, con publicación validada en PR101. |
| P1 | Títulos, oferta y cuatro públicos en páginas generales | **Parcial: cambios entregados resueltos; resto editorial fuera de las tandas cerradas** | PR106/108 mejora Tecnología, Audiovisual, portada y otras metas. Comunicación conserva title e introducción especializados (`comunicacion.astro:197,211`); Notas sigue priorizando fundraising/subvenciones (`notas.astro:56`); Qué hacemos conserva una introducción anterior de tres públicos (`que-hacemos.astro:311`). No afirmar ejecución completa de esta recomendación. |
| P1/P2 | BOJA: distinguir guía, convocatoria y futuro | **Parcial; revisión editorial/operativa fuera de esta tanda** | Se corrigen 16 líneas, metadatos y enlaces cruzados; cierre 2026 visible. La ventana 2027 se presenta como estimación, no como publicación oficial: no se ha demostrado una convocatoria abierta falsa. La promesa «lo presenta el primer día de plazo» (`boja-2026-inclusion-social.astro:586`) sigue sin respaldo operativo acreditado aquí. |
| P1/P2 | Cursos claros, docente real y edición vencida | **Resuelto técnicamente; datos comerciales por mantener** | PR108/109: docente solo donde consta, caducidad por petición y fecha de Madrid, sin oferta/formulario/checkout tras vencer. 261 pruebas, 212 comprobaciones HTTP con el mismo artefacto antes/después del corte y 14 recursos públicos. PR110/111 deja «Ver condiciones» en promoción estática. Esto no confirma plazas, celebración ni docentes aún desconocidos. [Revisión](revision-pr106-2026-09.md). |
| P2 | Catálogo público para IA | **Resuelto sustancialmente; efecto pendiente de medición** | llms incluye cursos, productos, herramientas, casos y diagnósticos; notas sin la barra final que redirigía. Enlaza sus índices aunque no la raíz literal `/laboratorio`. Esa omisión no prueba invisibilidad. No se prometen citas ni resultados enriquecidos. |
| P2 | Semántica de las diez fichas de productos | **Recomendación pendiente, fuera de esta tanda** | Conservan `BlogPosting`, Breadcrumb y FAQ opcional en `productos/[...slug].astro:38–55`; no hay `Offer` ni `SoftwareApplication` específicos del producto. BlogPosting puede describir un plan editorial. Elegir otro tipo requiere coherencia con la oferta real; Beta/Construcción no justifica por sí sola una Offer. |
| P2 | Estado del producto frente al alta disponible | **Ambigüedad reproducida en código, pendiente de conciliación operativa** | PR105 incorpora tres altas. Kit conserva Diseño/Beta Q1 2027 (`kit-de-marca-expres.md:13–18`), y Piloto/Web Construcción/Beta Q4 2026; el componente muestra «Ya se puede usar» (`productos/[...slug].astro:194–205`). No se ha probado el HUB ni se afirma que el alta falle o que el servicio esté plenamente disponible. |
| P2 | Miniaturas de prensa | **Resuelto con evidencia** | PR112/113: dos PNG correspondientes a sus PDF, descargas originales intactas, cuatro públicos; 47/47 comprobaciones públicas en escritorio y móvil. Contraste previo del logo blanco: **defecto documentado pendiente**, sin priorizar otro build. [Prensa](seo-prensa-2026-09.md). |
| P2 | Rendimiento móvil, Lazo y vídeo | **Pendiente de medición** | No hay nueva medición de LCP/INP/CLS en estas entregas. El tamaño del HTML y un HTTP 200 no demuestran degradación ni rendimiento satisfactorio. Existen precauciones de carga/vídeo, pero no sustituyen pruebas móviles y de accesibilidad completas. No se ha optimizado a ciegas. |
| P2 | 35 landings, grafo editorial, casos/autores y reconocimiento externo | **Fuera de alcance; recomendaciones condicionadas** | No se abre el inventario masivamente. Se añadieron enlaces, sin acreditar un grafo completo de cero huérfanas. Pilotos, contenidos y pruebas propias requieren demanda, diferenciación, mantenimiento y datos reales; no fabricar casos, menciones ni reseñas. |
| P2 | Recorte de FAQ y pruebas de CTR/GEO | **Pendiente de medición/tiempo; recorte fuera de alcance** | Las FAQ se conservan. El gate previo exige 21 días desde indexación acreditada y consulta-página; no 21 días desde deploy ni autorización automática al llegar una fecha. CTR/citas necesitan periodos comparables, muestra y protocolo constantes. |

El catálogo sigue anunciado en robots aunque no esté dentro del índice de sitemaps. El informe corregido ya distinguía esta organización del descubrimiento: no se registra como defecto pendiente.

## Recepción en GA4: qué se puede afirmar

Se han leído únicamente los resúmenes privados saneados ya disponibles. El baseline del 8 de septiembre a las 14:07 UTC cubre 12 de julio–8 de agosto y 9 de agosto–5 de septiembre; ambos intervalos son anteriores a estas entregas. Se conserva fuera del repositorio público.

La consulta autorizada de configuración, a las 14:47 UTC, acreditó acceso de solo lectura y cero definiciones personalizadas. Tiempo real devolvió cero filas para toda la propiedad, sin filtro de host. Es anterior al despliegue de privacidad, comprobado hacia las 16:03 UTC; ni ese resultado ni los ensayos interceptados acreditan recepción posterior.

No se dispone de un evento real consentido posterior cuyo origen pueda acreditarse en esta conciliación. Por tanto, **recepción externa pendiente**. No se han generado formularios/eventos, consultado PII, cambiado definiciones/políticas ni hecho nuevas consultas al HUB o a Google. Las definiciones pendientes son una configuración separada; su ausencia no demuestra que Google descarte los eventos.

La idempotencia del receptor del HUB ante una respuesta perdida sigue sin acreditarse y queda en su carril. Una solicitud aceptada no equivale a correo entregado, lead cualificado o venta.

## Entregas y prueba de publicación

| Entrega | Integración | Evidencia conservada |
|---|---|---|
| PR101/102 | `2d0a714` / `652b0a3` | Recorridos, baseline, sitemap y medición inicial; imagen `2d0a714` saludable, verificada a las 14:51 UTC. |
| PR103/104 | `dca237f` / `8afc124` | Consentimiento y señal de aceptación; producción y SDK real con transporte interceptado. |
| PR105 | `c0a6d6f` | Tres enlaces de alta incorporados al código; esta conciliación no prueba el servicio receptor. |
| PR106/107 | `4e2acc7` / `d9a0300` | Títulos/metas, BOJA, enlaces, portada y llms; no adoptar su borrador como criterio corregido. |
| PR108/109 | `8dd7413` / `fd92602` | Corrección de públicos, docentes y vigencia; build, 261 pruebas, 212 HTTP locales y 14 recursos públicos. |
| PR110/111 | `f3aafbb` / `b9ffe12` | Promoción estática con etiqueta estable; dos páginas y cinco enlaces verificados. |
| PR112/113 | `7b7aca0` / `5869198` | Prensa: build 328,60 s y 47/47 locales/públicas. Última evidencia de producción: 18:22 UTC, imagen y fuente `7b7aca0` saludable. |

Tras fetch, el código de `5869198` coincide con `7b7aca0`; las diferencias son documentales. En esta conciliación no se ha ejecutado otro build, despliegue ni revisión de infraestructura. La evidencia de salud citada es la de cierre, no una nueva medición.

## Riesgos y próxima ventana útil

No se puede afirmar pérdida ni ganancia de posicionamiento causada por estas entregas. Cambiaron varias variables y no constituyen un experimento aislado de títulos. El baseline inicial es pequeño y anterior a los cambios; comparar agosto con septiembre tampoco elimina estacionalidad.

La cobertura de GA4/Umami ahora depende del consentimiento: una bajada de eventos frente al histórico no demuestra pérdida orgánica. El cambio de cursos a respuesta por petición añade dependencia del servidor; su funcionamiento se comprobó, pero no una prueba de carga o Core Web Vitals.

En PR110 se observaron 404 transitorios al recrear el contenedor, recuperados cuando quedó saludable. Duración exacta e impacto SEO no medidos; no se cambia infraestructura aquí. Permanecen también la ambigüedad comercial de productos y las afirmaciones editoriales pendientes descritas en la matriz.

**Siguiente acción única recomendada al coordinador: pausar el loop de código y reabrir una revisión de medición cuando exista evidencia útil.** El primer intervalo posible de 28 días completos tras el último cambio del 8 de septiembre es **9 de septiembre–6 de octubre**, revisable desde el **7 de octubre de 2026** únicamente si GSC ofrece esos días como finales y hay muestra comparable. Registrar el recrawl; si ocurrió más tarde o faltan datos, desplazar/ampliar el periodo. Esta fecha no asegura significación ni un resultado causal.

Una aceptación real consentida identificable puede permitir antes una comprobación acotada de recepción en Google. No se fabricará para cerrar el pendiente. Una incoherencia comercial confirmada o una incidencia real puede justificar una tarea específica antes; no autoriza reabrir todo el inventario. Para FAQ no se fija fecha: falta acreditar la indexación que inicia sus 21 días.

Acción de Mario: ninguna inmediata. No quedan cambios de código asignados en esta conciliación.
