# Revisión acotada de los quick wins de PR106

8 de septiembre de 2026. Base revisada: `d9a030021267d89ac12d1becd1c4a17d09eee0f1`, que incluye PR106 (`4e2acc7`).

La referencia editorial es la [auditoría corregida en 8f48dec](https://github.com/mariopablobarron/startidea-web/blob/8f48dec/docs/auditoria-seo-geo-2026-09.md): cuatro públicos en páginas generales, docencia y disponibilidad acreditadas y mejoras medibles. El documento de quick wins que volvió a publicar Claude no sustituye esas decisiones.

## Defectos reproducidos y corrección

| Antes de esta revisión | Resultado del cambio |
|---|---|
| Nuevos títulos de páginas generales limitaban la oferta a ONG; portada y metas omitían personas que emprenden | Se corrigen las incorporaciones de PR106 para representar empresas, instituciones, entidades sociales y personas que emprenden. Las fichas especializadas mantienen su público propio |
| El bloque nuevo de portada concentraba tres de seis accesos en subvenciones | Seis necesidades enlazan a servicios existentes, incluyendo comunicación institucional, consultoría para emprender y tecnología para empresas |
| La meta nueva de audiovisual ofrecía formación sin un curso audiovisual acreditado | Se retira esa promesa; se conserva el precio existente |
| Los cuatro cursos atribuían docencia a Mario por defecto en marcado y textos para IA | Campo docente opcional; solo comunicación tiene respaldo previo. `instructor` pertenece a `CourseInstance`, sin atribución inventada en los otros tres cursos |
| Fechas de cursos e índices se evaluaban al generar la web; podían anunciar indefinidamente una edición pasada | Las cuatro fichas, el índice y los dos documentos llms se sirven por petición. El corte es el final del día publicado en Europe/Madrid |
| Tras vencer, el estado original podía conservar una oferta y una invitación a reservar | Cabecera, pie, índice, llms y marcado comparten vigencia. Se conserva el programa público, se ofrece consultar próximas ediciones y el endpoint impide iniciar Stripe para la edición pasada |
| Dos errores TS7006 en las pruebas de consentimiento de Google | Tipado de las listas de comandos corregido, sin cambiar el comportamiento de medición |

## Disponibilidad y rastreo

La URL de cada curso sigue siendo permanente, responde con HTML completo y conserva su canonical e indexabilidad. Cambiar de generación estática a [renderizado en servidor por petición](https://docs.astro.build/en/guides/on-demand-rendering/) permite comprobar la fecha sin JavaScript del visitante y sin esperar otro despliegue. El sitemap enumera explícitamente los cuatro cursos publicados porque su ruta dinámica ya no usa `getStaticPaths`.

Al pasar la fecha, se retiran la instancia y la oferta de esa edición; no se inventa otra fecha, una cancelación o plazas agotadas. Los cursos a demanda sin fecha mantienen el recorrido existente y la señal de 50 €. El corte es diario: no determina si una sesión ha comenzado por su hora ni confirma que un evento se haya celebrado.

La docencia explícita usa [instructor en CourseInstance](https://schema.org/instructor). El marcado describe lo publicado; no promete resultados enriquecidos ni citas de asistentes.

## Verificación

- Suite completa: 261 pruebas en 20 archivos, incluidas 13 de calendario, 5 de checkout, 5 de esquema y 38 de consentimiento de Google.
- TypeScript sin errores tras sincronizar las colecciones de Astro.
- Las pruebas de checkout ejecutan la ruta real con colección, Stripe, reserva y limitador simulados. Incluyen los cortes de Madrid en verano/invierno y preservación del depósito. No se crean pagos, reservas, contactos ni eventos analíticos reales.
- Revisión independiente del diff: corregida la contradicción del pie de la ficha al caducar; sin bloqueantes pendientes.
- Build completo correcto en 309,50 s. Prueba HTTP sobre ese artefacto: 212/212 comprobaciones en 19 GET locales. El mismo proceso y el mismo hash de todos los archivos del servidor pasan de 19/09 a 20/09 en Madrid: desaparecen fecha anunciada, oferta y formulario de la edición vencida; se conservan programa, canonical, indexabilidad y sitemap. Los otros tres cursos mantienen su oferta. El reloj del sistema no se modifica y el servidor de prueba queda cerrado.
- Evidencia privada local: `pr106-runtime.json` y `pr106-public-before.json` en el directorio de evidencias SEO del 8 de septiembre; sin datos de usuarios.
- [PR108](https://github.com/mariopablobarron/startidea-web/pull/108) integrada y desplegada: `8dd74134a4ab9fc70bd9a04d940a6f9b2e713b4b`. Verificada a las 19:32 de Madrid: imagen `8dd7413`, `running/healthy`, log OK y fuente completa coincidente. Los 14 recursos públicos, títulos/metas, docentes, cuatro fichas únicas en sitemap y redirect a consultoría pasan. Evidencia privada `pr106-public-after.json`. Sin peticiones de medición ni acciones comerciales de prueba.

## Riesgos y límites

Los cambios en títulos y enlaces pueden alterar qué consultas traen visitas y su CTR. No hay datos posteriores suficientes para atribuir una mejora o pérdida de posiciones. Se conserva el acceso a las páginas y no se elimina contenido especializado. Google puede volver a rastrear y elegir un título distinto del propuesto; ver su [documentación de títulos](https://developers.google.com/search/docs/appearance/title-link).

Servir siete recursos por petición introduce trabajo de servidor frente al HTML estático: se comprueba su respuesta y salud en producción. Las ediciones seguirán necesitando revisión editorial si cambia su fecha, docente o condiciones; el reloj solo evita prolongar una edición pasada.

No se cambia la lista de 35 landings, el recorte de FAQ sujeto a 21 días, Lazo, el plano, precios, política de privacidad ni el receptor del HUB. La apertura masiva de landings no se convierte en una aprobación pendiente. No se envían campañas ni se tramitan contactos de prueba.

La recepción de la próxima aceptación real consentida en GA4 continúa pendiente, igual que el límite de idempotencia ante respuesta perdida descrito en [el cierre de privacidad](seo-medicion-privacidad-2026-09.md). Las pruebas de emisión no demuestran recepción en Google. El menor volumen de una muestra consentida no acredita pérdida de tráfico orgánico.

## Siguiente microtanda separada

La banda estática de portada `FormacionPromo.astro`, anterior a PR106, aún lee el estado original y puede mostrar «Próxima edición» tras pasar la fecha. No impide el bloqueo de checkout ni cambia la fecha evaluada por la ficha. Queda autorizada una corrección posterior, limitada a ese componente: etiqueta estable «Ver condiciones», manteniendo cursos y destinos. El cierre de PR108 no atribuye a esta etiqueta antigua la caducidad por petición.
