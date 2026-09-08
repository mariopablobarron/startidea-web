> Referencia corregida recuperada del commit `8f48dec`. Describe la auditoría previa a las entregas del 8 de septiembre; para su estado de ejecución consulte la [conciliación de PR101–113](seo-conciliacion-2026-09.md).

# Auditoría SEO y GEO de Startidea

**8 de septiembre de 2026 · Informe revisado para decisión.** Alcance: arquitectura, contenido, rastreo, presentación en buscadores, formación, conversión y descubrimiento mediante IA. Reutiliza las cinco auditorías de Claude y corrige su síntesis; no ejecuta sus recomendaciones ni cambia producción.

## 1. Decisión recomendada

Mantener Lazo y el plano, acompañados de servicios y enlaces accesibles sin conversar. La oportunidad principal es conectar mejor lo que Startidea ya ofrece: una búsqueda debe llevar a una respuesta útil y de ahí a un servicio, formación o consulta pertinente. El chat puede ayudar a elegir, pero no debe convertirse en el único acceso.

No está demostrado que el cuello de botella sea exclusivamente el CTR. Hay señales de presentación poco específica, recorridos comerciales mejorables y una medición que mezcla propiedades y genera falsas alertas de canibalización. Antes de multiplicar páginas, conviene corregir esto y aprovechar las existentes.

Cuatro públicos tienen que reconocerse: empresas, instituciones, entidades sociales y personas que emprenden. Las páginas generales deben representar los cuatro. Las páginas especializadas pueden dirigirse a un sector concreto. Fundraising conserva su espacio, sin convertirse en el ejemplo universal.

## 2. Alcance, evidencia y límites

- Auditorías recuperadas: workflow `wf_9ffbb729-6a8`, resultado `wxxpg26zv`; borrador original de 339 líneas en el worktree `plano`. La crítica final había quedado interrumpida por cuota.
- Base de código para esta revisión: `origin/main` actualizado, SHA `9db5dffb74d8ee8caaa4580ea2e1ee4a71542b64`. Trabajo documental en rama `codex/auditoria-seo-geo`, worktree aislado.
- Revalidación viva: 15 recursos públicos, incluidos portada, servicios, cursos, portal, pedido, robots y tres sitemaps. Todos respondieron 200. Resultados conservados en [verificacion-2026-09-08.json](seo-geo-evidencias/verificacion-2026-09-08.json).
- Los sitemaps consultados contienen 185 + 9 entradas, 193 URL distintas al descontar `/precios`. Esto confirma inventario anunciado, no indexación. El 200 de las 193 páginas procede del rastreo anterior; esta revisión no ha repetido esa comprobación completa.
- Datos comerciales: extracción del panel realizada por Claude el 8 de septiembre. No incluye un intervalo explícito común ni desglose completo. Las filas almacenadas no equivalen a visitas. No se ha realizado una nueva exportación autenticada de GSC/GA4.
- Sin medición nueva de Core Web Vitals, backlinks, ficha de Google Business Profile ni conversiones reales. PageSpeed agotó cuota en la auditoría original. No se atribuyen pérdidas al rediseño sin comparación anterior/posterior.

### Señales del panel, con su alcance real

| Página | Impresiones de la extracción | Posición media | CTR observado | Uso correcto |
|---|---:|---:|---:|---|
| `/comunicacion` | 2.200 | 11,8 | No consta | Prioridad de análisis por consultas y audiencia |
| `/que-hacemos` | 1.398 | 6,5 | No consta | Revisar recorridos; validar tráfico de pruebas |
| `/audiovisual` | 674 | 12,1 | No consta | Contrastar demanda de producción, estudio y formación |
| Nota BOJA inclusión social | 688 | 8,2 | No consta | Separar intención informativa de convocatoria vigente |
| `/redes-sociales-granada` | 426 | No consta para la página | 0,47 % | Experimento de presentación tras segmentar |
| Nota plan de comunicación ONG | 366 | 10,8 | No consta | Mejorar conexión con servicio y formación pertinentes |
| `/sobre` | 210 | 2,7 | 0,95 % | Revisar búsquedas de marca y utilidad de la ficha |

Los CTR «esperados» del panel son modelos orientativos, no objetivos garantizados. No se trasladan datos de consultas a páginas como si fueran la misma métrica. No hay base para afirmar cero visitas a cursos ni pronosticar +150–250 visitas.

## 3. Hallazgos y prioridades

P0 significa evitar decisiones con datos defectuosos; P1, primera tanda comercial; P2, mejora posterior. El impacto es una valoración, no una predicción de posiciones.

| Prioridad | Hallazgo / evidencia | Recomendación | Criterio de aceptación |
|---|---|---|---|
| P0 | El código del panel HUB une consultas y páginas por fecha, propiedad y espacio, sin relación consulta-página | Suspender decisiones basadas en esa alerta; obtener GSC con ambas dimensiones juntas | Un resultado de canibalización muestra consulta, URL y métricas conjuntas reproducibles |
| P1 | `/comunicacion` se presenta en el title como agencia para ONG y tercer sector; `/tecnologia` solo dice «Tecnología — Startidea» | Replantear las páginas generales para representar la oferta y los cuatro públicos | Servicio, destinatarios y resultado claros en title, introducción, ejemplos y CTA |
| P1 | Los cursos ya están enlazados desde la home; el recorrido sigue dependiendo mucho del bloque general | Enlazar el curso pertinente desde cada servicio y nota relacionada | Los cuatro cursos tienen accesos contextuales permanentes; no solo navegación global |
| P1 | El CTA de financiación en notas se decide por categoría y etiquetas, sin comprobar audiencia empresarial | Elegir destino por necesidad y audiencia: financiación empresarial, subvenciones o fundraising | Una nota ENISA/CDTI conduce al servicio empresarial, sin promesas de plazo no aprobadas |
| P1 | `NotasRelacionadas` rota por mes si no recibe etiquetas | Fijar afinidad temática y editorial en páginas comerciales | Tres recomendaciones realmente relacionadas por página prioritaria, estables salvo revisión |
| P1 | `/memorias/pedido` tiene noindex y aparece en sitemap; `/portal` aparece sin meta robots ni canonical | Excluir utilidades del sitemap y definir indexación de accesos/registro; conservar públicas las landings comerciales | Sitemap sin páginas de pedido/confirmación; comprobación del HTML final y GSC |
| P1 | `sitemap-catalogo.xml.ts` asigna la fecha del día a cada URL en cada petición | Usar fecha de modificación significativa o suprimir lastmod cuando no exista | Dos consultas sin cambios editoriales conservan la misma fecha |
| P2 | `/llms.txt` no contiene `/laboratorio` | Completar catálogo público si es barato; priorizar primero las páginas HTML | Cursos, productos disponibles y casos con URL correcta; sin datos privados |
| P2 | Los productos usan BlogPosting; Course carece de instancia/docente | Ajustar semántica según contenido real y disponibilidad; no prometer rich results | Marcado coherente con lo visible, sin ofertas ni profesores inventados |
| P2 | `/prensa` utiliza dos PDF como imagen; home entrega 233.584 bytes de HTML | Miniaturas de imagen para PDF; medir carga y respuesta de Lazo/vídeo en móvil antes de optimizar | Imágenes visibles y mejoras sustentadas en mediciones, no solo tamaño del HTML |
| P2 | Auditoría previa identifica enlaces contextuales escasos y 35 landings territoriales/categorías fuera de sitemap | Validar demanda, diferenciación y grafo; piloto pequeño, sin indexación masiva | Cada candidata tiene utilidad propia, mantenimiento y enlaces desde páginas indexables |

### Fallo de medición que cambia las conclusiones

En `/Users/STARTIDEA/HUB/lib/seo/opportunities.ts`, bloque de canibalización, se observa:

```sql
FROM "GscDailyQuery" q
JOIN "GscDailyPage" p
  ON q.date = p.date
 AND q.site_url = p.site_url
 AND q.workspace_id = p.workspace_id
```

Una consulta queda relacionada con todas las páginas del mismo día y propiedad. `COUNT(DISTINCT p.page)` no indica cuántas URL posicionan por esa consulta; `SUM(q.clicks)` puede multiplicarse. Esto invalida utilizar «1.111 páginas compitiendo» como evidencia de canibalización. Hallazgo confirmado en el código leído, sin comprobar qué SHA ejecuta el HUB en producción. Se comunica para su carril; aquí no se modifica HUB.

Separar también el host `startidea.es` de merchandising y otros subdominios. Los datos de propiedades agregadas no deben decidir el contenido de esta web.

## 4. Arquitectura para que la visita avance

Conservar cuatro familias de servicio: Consultoría, Comunicación, Audiovisual y Tecnología. Dar acceso visible a Formación, Notas y Casos, además de Lazo. «Laboratorio» puede seguir como marca, acompañado de etiquetas explícitas: cursos, herramientas y productos.

La portada ya incluye enlaces HTML a las cuatro familias, al índice de cursos y a tres fichas. Por tanto, se descarta la afirmación anterior de que solo enlaza a dos páginas: buscar cadenas literales en un archivo no detecta todos los enlaces generados desde datos y componentes.

Cada página de servicio debería responder, sin abrir el chat: qué resuelve, para quién, qué entrega, cómo se trabaja, qué prueba existe y cuál es el siguiente paso. Dos salidas bastan donde proceda: «Quiero que Startidea lo haga» y «Quiero aprender a hacerlo». La segunda solo enlaza formación existente y pertinente.

| Público | Entrada y necesidad | Recorrido sugerido | Resultado que se mide |
|---|---|---|---|
| Empresa | Mejorar comunicación, captar clientes o automatizar procesos | Servicio → caso empresarial verificable → consulta; nota ENISA/CDTI → financiación empresarial | Consulta cualificada y propuesta |
| Institución | Comunicación pública, participación, formación del equipo | Nota aplicada → servicio o taller → diagnóstico del proyecto | Solicitud con alcance y responsable |
| Entidad social | Mejorar comunicación, base social o financiación | Nota especializada → servicio correspondiente → curso o diagnóstico | Inscripción o consulta pertinente |
| Persona que emprende | Definir propuesta, lanzar marca/web, priorizar inversión | Consultoría → guía útil → formación disponible o primera reunión | Consulta con proyecto definido |

No crear una página para cada combinación de público, localidad y servicio. Primero demostrar una necesidad diferenciada y evitar repetir el mismo contenido cambiando nombres.

### Notas

Mantener ensayos de autor si cumplen una función editorial. No toda nota tiene que atacar una palabra clave, pero sí tener propósito y navegación útil. En las guías, ofrecer una respuesta directa inicial, ejemplos propios, fuentes cuando proceda y un siguiente paso relacionado. Enlazar también desde servicios a notas, no solo al revés.

Revisar las supuestas 15 notas huérfanas con un grafo de HTML renderizado que distinga menú, listado y enlace editorial. Ausencia de una cadena en código no prueba orfandad. Evitar UTM en enlaces internos; registrar el origen del clic en eventos para no contaminar atribución de campañas.

### Formación y talleres

En cada ficha: qué podrá hacer la persona, destinatarios, requisitos, temario, formato, docente real, duración, fecha o condición «bajo demanda», precio y condiciones. Distinguir reserva pagada, solicitud de grupo y aviso de próxima edición. No mostrar disponibilidad inmediata si no existe.

El taller del 19 de septiembre mencionado en el inventario requiere comprobar plazas y fecha antes de destacarlo. Tras su celebración, mantener una ficha útil con materiales o próxima edición, sin urgencia vencida. No inventar un curso de videopodcast para captar una consulta: validar demanda y capacidad docente antes de publicarlo.

### Productos, herramientas, diagnósticos y casos

Distinguir productos contratables de ideas en desarrollo. Un plan de producto puede ser contenido editorial válido, pero no una oferta disponible. En herramientas, aportar pruebas propias, fecha, criterios y limitaciones; en diagnósticos, anonimización efectiva; en casos, contexto, trabajo y resultados verificables. Enlazar cada uno con su servicio, sin forzar una llamada genérica a fundraising.

## 5. Presentación en Google: pruebas concretas

Estas propuestas son textos para contrastar con consultas reales y contenido, no cambios aplicados:

| Página | Title propuesto | Qué corrige |
|---|---|---|
| `/comunicacion` | Comunicación estratégica y marketing en Granada · Startidea | Oferta general reconocible, sin exclusión de empresas |
| `/tecnologia` | Desarrollo web, plataformas y agentes de IA · Startidea | Sustituye una etiqueta genérica por servicios concretos |
| `/audiovisual` | Producción audiovisual y videopodcast en Granada · Startidea | Hace explícita la oferta local |
| `/que-hacemos` | Consultoría, comunicación, audiovisual y tecnología | Representa las cuatro líneas |
| `/laboratorio/cursos` | Cursos y talleres de comunicación e IA · Startidea | Explica qué se aprende, si refleja el catálogo vigente |
| `/notas` | Ideas y guías de comunicación, negocio e IA · Startidea | Abre la percepción más allá de captación de fondos |

Ejemplo de description para Comunicación: «Marca, contenidos, redes y campañas para empresas, instituciones, entidades sociales y proyectos que empiezan. Descubre cómo trabaja Startidea.»

La longitud se revisa para legibilidad y posible truncado, no como límite algorítmico de 60/155 caracteres. Google puede seleccionar otro title o snippet. Mantener precios cuando ayuden a cualificar: un CTR mayor con peores contactos no es éxito. [Guía de titles de Google](https://developers.google.com/search/docs/appearance/title-link).

Para probar: elegir tres páginas con suficientes impresiones, guardar texto y métricas anteriores, anotar fecha de despliegue y recrawl, comparar 28 días completos y segmento equivalente. No cambiar título, contenido, precio y CTA simultáneamente si se pretende aislar una causa. Con pocos datos, ampliar periodo y declarar resultado inconcluyente.

## 6. Subvenciones: rigor antes de volumen

La muestra `/subvenciones/territorio/andalucia` responde 200, es indexable y no figura entre las URL anunciadas por los sitemaps consultados. Esto no acredita por sí solo que sea una oportunidad prioritaria: revisar consultas, duplicidad y calidad del listado antes de añadirla.

Pilotar dos o tres páginas solo si tienen demanda y contenido distintivo: convocatorias vigentes comprobadas, fuentes oficiales, fecha de revisión, filtros útiles y explicación del alcance. No llamar «BOJA hoy» a una selección parcial de ayudas: esa consulta suele buscar el boletín oficial completo. Enlazar al boletín cuando ayude al visitante.

Separar guía explicativa y ficha de convocatoria: propósito, título y enlaces cruzados distintos. Mostrar vencimientos reales; no anunciar una edición futura no publicada. Consolidar o redirigir únicamente si ambas URL satisfacen la misma intención y los datos conjuntos lo justifican.

El sitemap del catálogo está declarado en robots.txt aunque no esté dentro del índice de sitemaps. Eso permite descubrirlo: incorporarlo al índice puede ordenar la gestión, pero su ausencia allí no demuestra invisibilidad. La prioridad reproducible es corregir lastmod y páginas de utilidad anunciadas.

## 7. GEO: que las IA encuentren motivos para citar

GEO se entiende aquí como descubrimiento y cita en respuestas de asistentes. La base es una web accesible, útil y con pruebas propias. Para Google, no hay un schema especial ni necesidad de `llms.txt`; completar este archivo es secundario y puede servir a otros consumidores. [Guía oficial de optimización para IA](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

1. **Páginas comerciales citables.** Explicar servicio, destinatarios, alcance y diferencia con ejemplos concretos. Evitar superlativos sin prueba.
2. **Entidad y equipo.** En `/sobre`, identidad, ubicación, trayectoria y responsables comprobables; enlazar biografías de autores reales. Las cifras deben tener respaldo, no añadirse por decoración.
3. **Casos y estudios propios.** Difundir el estudio de subvenciones desde notas pertinentes con metodología, universo, fecha, limitaciones y fuentes. Crear evidencia también para empresa, tecnología, audiovisual e instituciones; no inventar resultados para equilibrar el catálogo.
4. **Formación comprensible.** La ficha tiene que permitir responder quién aprende qué, cómo y cuándo, sin inferirlo desde un botón de pago.
5. **Reconocimiento externo real.** Colaboraciones, proyectos, docencia y publicaciones acreditadas. Directorios solo si son relevantes y sus condiciones están verificadas; no fabricar menciones ni reseñas.
6. **Catálogo consistente.** Datos de nombre, dirección, contacto y oferta coherentes entre HTML y marcado; `llms.txt` puede resumir lo público sin incluir conversaciones, instrucciones internas o documentación privada.

El 4 % del panel GEO es una medida de un conjunto de pruebas, no cuota de mercado ni porcentaje de búsquedas reales. Registrar consultas, modelos, fecha, idioma, localización, búsqueda web activada, respuestas completas, menciones y enlaces. Un modelo sin búsqueda no sirve para medir el descubrimiento actual de una página recién publicada.

Conjunto inicial de ocho preguntas de control, formuladas sin incluir Startidea:

- ¿Qué agencia puede ayudar a una pyme de Granada a mejorar su comunicación?
- ¿Quién desarrolla agentes de IA para procesos de una empresa en Andalucía?
- ¿Dónde puede formarse un equipo de una institución en comunicación estratégica?
- ¿Qué productora puede hacer un videopodcast institucional en Granada?
- ¿Quién puede ayudar a una asociación a preparar una estrategia de financiación?
- ¿Qué cursos prácticos de comunicación hay para entidades sociales?
- ¿Quién puede ayudar a una persona emprendedora a definir su marca y su web?
- ¿Dónde aprender a crear un primer agente de IA sin programar?

Estas preguntas equilibran la prueba; no representan demanda medida. Repetir un conjunto fijo mensual y separar mención de marca, cita con URL, visita referida y consulta comercial. No prometer que una cita genere clic.

### Datos estructurados: actualización crítica

Mantener datos correctos por su significado y posibles usos, sin atribuirles beneficios inexistentes. Google retiró **Course Info** en 2025; **Course list** es otra función, con sus propias condiciones e idioma. Añadir CourseInstance no garantiza un resultado enriquecido para estos cursos en español. [Retirada de Course Info](https://developers.google.com/search/blog/2025/06/simplifying-search-results), [documentación Course list](https://developers.google.com/search/docs/appearance/structured-data/course).

Google dejó de mostrar resultados enriquecidos FAQ desde el 7 de mayo de 2026. Las preguntas útiles pueden permanecer en la página, pero no son una palanca de ese formato de resultados. [Actualizaciones oficiales](https://developers.google.com/search/updates).

No atribuir todos los cursos a Mario sin comprobar quién los imparte. No emitir Offer disponible por el simple estado «Beta» o «Construcción». Repetir una entidad con el mismo identificador en varias páginas no demuestra un problema; no borrar Organization/WebSite mecánicamente.

## 8. Lazo, el vídeo y el SEO

La portada actual contiene texto y enlaces HTML además del módulo conversacional. La muestra confirma acceso a servicios y cursos, y elementos de vídeo. El código incluye `VideoIdea` después de servicios. No se ha probado en esta revisión la reproducción audiovisual completa en dispositivos.

El efecto SEO del rediseño puede ser positivo o negativo dependiendo del contenido, los enlaces, la experiencia y la demanda. El hecho de tener chat no determina el posicionamiento. Tampoco una reducción del número de palabras demuestra pérdida de relevancia. [Funciones de IA y fundamentos SEO de Google](https://developers.google.com/search/docs/appearance/ai-features).

Recomendaciones: conservar accesos directos, cargar lo costoso cuando haga falta, reservar dimensiones para evitar saltos, permitir teclado y movimiento reducido, probar Lazo con conexión móvil y medir INP/LCP/CLS. Para el vídeo: cartel ligero, reproducción voluntaria, subtítulos y resumen o transcripción útil. Si se quiere captar búsquedas de vídeo, valorar una página propia donde sea protagonista; no convertir automáticamente un vídeo secundario en una promesa de indexación de vídeo.

Lazo debe sugerir enlaces pertinentes, aclarar que es IA y facilitar el contacto con el equipo. El éxito es ayudar a avanzar; cambiar de tema solo si aclara una necesidad. Evitar interrogatorios o insistencia comercial en cada turno. Mantener ocultos los regalos, según decisión de Mario.

Usar las dudas del chat para detectar necesidades agregadas y redactar contenido revisado. No publicar conversaciones ni trasladar el texto libre o datos personales a las etiquetas analíticas. Una IP no identifica de forma fiable a una persona: el control de abuso no es una métrica de audiencia.

## 9. Medición y plan a 90 días

| Periodo | Entrega | Señal de finalización |
|---|---|---|
| Días 1–7 | Baseline GSC por host, fecha, consulta y página; tráfico real y conversiones; aviso del fallo de canibalización al carril HUB | Datos conjuntos reproducibles y exclusión de pruebas/bots con criterio documentado |
| Días 1–14 | Enlaces contextuales y CTA de los servicios/notas prioritarios; visibilidad de formación; sitemap y lastmod | Recorridos comprobados de principio a fin y problemas reproducibles resueltos |
| Días 15–30 | Experimento de títulos; fichas de cursos claras; miniaturas de prensa; medición móvil | Registro anterior/posterior y primeras conversiones atribuibles, sin concluir con muestra insuficiente |
| Días 31–60 | Mejoras de casos/autores, dos contenidos de demanda validada, piloto territorial si procede | Contenido útil enlazado; consultas no-marca y visitas cualificadas observables |
| Días 61–90 | Evaluar, consolidar lo que funciona y ampliar selectivamente | Comparativa por familia de servicio y decisión basada en negocio |

La primera tanda requiere coordinación de analítica, contenido y desarrollo. Estimación orientativa: 2–4 jornadas efectivas, sujeta al estado real de las integraciones; no incluye resolver el conector del HUB ni nuevos cursos. Evitar sumar todas las horas de auditores: hay tareas repetidas.

### Indicadores y definición

| Objetivo | Indicador | Regla de lectura |
|---|---|---|
| Descubrimiento | Clics orgánicos no-marca a páginas comerciales y formativas | Host exacto, periodos comparables y desglose por familia |
| Presentación | CTR por consulta-página y dispositivo | Comparar con posición e intención similares; no promedio general aislado |
| Recorrido | Sesiones de nota que pasan a servicio o curso relacionado | Evento de clic interno con URL y tipo de enlace, sin UTM internos |
| Formación | Vista de ficha → intención → reserva/inscripción confirmada | Separar aviso, solicitud y pago; validar pago en servidor |
| Negocio | Consultas cualificadas → reuniones → propuestas → contratos | Cualificación en CRM; un clic al contacto no equivale a lead |
| Lazo | Conversación útil → visita a servicio → contacto aceptado | Evitar contar cada turno como conversión; registrar datos mínimos |
| GEO | Respuestas con cita útil / respuestas válidas; visitas y leads referidos | Denominador y condiciones constantes; muestras separadas por buscador |
| Experiencia | Core Web Vitals móvil y abandonos del recorrido | Campo cuando esté disponible; laboratorio como diagnóstico |

Primer objetivo medible: que las páginas prioritarias tengan recorrido, instrumentación y destino funcional verificados. Objetivo de negocio posterior: aumentar consultas cualificadas e inscripciones por sesión de entrada, sin empeorar calidad. Fijar cifra tras disponer de baseline limpio; hasta entonces no inventar un porcentaje de mejora.

Comparar últimos 28 días completos con los anteriores; para poco volumen, 56–90 días. Separar marca/no-marca, campañas, empleo, tráfico interno y automatizado. No tratar baja conversión en `/empleo` como fracaso de captación comercial. Evitar interpretar GA4 como todo el tráfico si el consentimiento reduce su cobertura; documentar diferencias respecto a Umami y CRM.

## 10. Correcciones a la síntesis anterior

- Retiradas promesas de +70–80, +150–250 o +60–120 visitas; carecían de periodo y causalidad suficientes.
- Retirada la cifra de 1.111 páginas como prueba de canibalización; se localizó un JOIN que no demuestra relación consulta-página.
- Corregida la supuesta ausencia de cursos/enlaces de servicios en portada: están presentes en HTML.
- Las páginas generales no se convierten en páginas solo para ONG. Se preserva la oferta a los cuatro públicos.
- `llms.txt`, FAQ y CourseInstance dejan de ser grandes palancas prometidas de tráfico; se incorpora documentación vigente.
- No se indexan 35 landings ni se hacen redirecciones masivas sin validar intención, calidad y datos.
- No se orienta un buscador parcial a «BOJA hoy» ni se inventan próximas convocatorias.
- No se cambian fechas por antigüedad ni se fijan límites universales de palabras/caracteres.
- No se elimina precio por asumir que causa bajo CTR; se mide calidad de consultas.
- No se prometen respuesta en 48 horas, probabilidad de concesión, instructor o disponibilidad sin respaldo operativo.
- No se añaden UTM internos, ni se cuenta un clic como venta, ni se llama huérfana a una URL por un grep incompleto.

**Estado de entrega:** auditoría revisada y evidencia conservada. Recomendaciones propuestas; sin cambios de aplicación, integración ni despliegue. Siguiente acción: primera tanda de medición limpia y recorridos hacia servicios/formación, en una implementación separada.
