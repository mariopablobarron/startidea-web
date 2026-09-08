# Primera tanda: recorridos y medición

Los servicios enlazan formación existente y lecturas seleccionadas. Las notas
orientan hacia el servicio correspondiente. La selección comercial no rota con
el mes ni se rellena con cursos o notas sin relación.

## Recorridos

| Formación | Servicio de entrada | Nota de entrada |
|---|---|---|
| Comunicación estratégica | `/comunicacion` | `/notas/plan-comunicacion-ong` |
| Email marketing | `/comunicacion` | `/notas/newsletter-segmentacion-ong-tercer-sector` |
| Primer agente de IA | `/agentes-ia`, `/tecnologia` | `/notas/agentes-ia-para-ong-tercer-sector` |
| Solicitud de subvenciones | `/financiacion-empresas` | `/notas/leer-convocatoria-subvencion-antes-de-redactar` |

ENISA/CDTI conduce a `/financiacion-empresas`. Fundraising privado conserva
`/fundraising`; las notas audiovisuales remiten a `/audiovisual`. Ninguna de
estas dos últimas recibe un curso por una coincidencia genérica de categoría.

Los contactos de un curso conservan su slug público y distinguen consulta,
edición para un grupo y aviso. Contacto valida ese slug contra el catálogo
publicado y prepara un mensaje que la persona puede revisar y editar. Un slug
desconocido no preselecciona nada. No se envía ninguna solicitud al abrir el enlace.

## Eventos

`stTrack` usa el transporte GA4 con aceptación explícita del banner. Sin
aceptación, con «solo esenciales» o en páginas privadas no se cargan los SDK ni
se guardan eventos para enviarlos después. La excepción del formulario de
presupuesto se limita a su señal de aceptación, sin visita automática.

| Evento | Cuándo ocurre | Qué acredita |
|---|---|---|
| `internal_link_click` | Enlace dentro de `main` desde página pública conocida hacia servicio, nota, curso, contacto o solicitud conocida | Clic de navegación |
| `view_course` | Apertura de una ficha; excluye `gracias` | Vista de ficha |
| `course_checkout_intent` | Envío del formulario hacia la pasarela | Intención de reservar; no pago |
| `course_contact_intent` | Clic desde un curso al contacto, con intención explícita | Intención de consulta, grupo o aviso |
| `generate_lead` con `method=curso_consulta`, `curso_grupo` o `curso_aviso` | Respuesta satisfactoria del endpoint de contacto | Consulta aceptada; no lead cualificado ni venta |

Los recorridos guardan `source_path`, `target_path`, `source_type`, `target_type`
y `link_type`. Los eventos de cursos usan `course_id`; contacto añade
`intent_type`. Solo valores de catálogo/taxonomía pública, sin copiar campos
de formulario, conversaciones, querystrings ni fragmentos.

Se sobrescriben también `page_location` y `page_referrer` en estos eventos:
GA4 los obtiene de la URL completa si no se especifican. Los referentes
externos y las rutas de utilidad se reducen al origen. `stTrack` no emite desde
portal, administración, contratos, pedidos, Mi Copiloto ni confirmaciones.
La corrección posterior también sanea las visitas automáticas de GA4 y Umami,
y excluye los SDK de páginas privadas. Véase `seo-medicion-privacidad-2026-09.md`.

Para desglosar estos parámetros en los informes estándar de GA4, revisar las
definiciones personalizadas existentes y registrar solo las que falten, con
ámbito de evento. La publicación del código no registra esas definiciones ni
acredita recepción en Analytics. La consulta de configuración del 8 de septiembre
de 2026 confirmó que todavía no hay definiciones personalizadas; los parámetros
de esta tabla siguen pendientes de registro. La API de tiempo real es accesible,
pero una respuesta sin filas no prueba recepción ni ausencia de eventos. Tras
desplegar, comprobar una navegación real en DebugView y contrastarla con el
evento esperado.

## Rastreo

- Portal, registro, pedidos, contratos, administración y errores quedan fuera
  del sitemap; las landings comerciales permanecen.
- Portal y registro emiten `noindex, follow` con canonical sin parámetros.
- El inicio del expediente y su confirmación emiten `noindex`; la landing
  `/subvenciones/presentar` sigue pública.
- El sitemap del catálogo omite `lastmod`: ni el día de la petición ni un
  `updated_at` renovado en cada sincronización representan cambios editoriales.
  El sitemap de notas conserva sus fechas editoriales reales.

No se han añadido en bloque landings territoriales, cambiado titles ni creado
ofertas o cursos. El trabajo conserva Lazo, vídeo y regalos ocultos.

## Comparación y validación

El baseline autenticado se conserva fuera del repositorio público. GSC se
consulta con `date/query/page/device` en una única petición dimensional; los
totales proceden de otro informe `date/page/device`, sin unir tablas separadas.
Host exacto, periodos de 28 días completos, `dataState=final` y paginación.
GSC omite consultas anónimas y aplica límites internos incluso al agotar páginas.
GA4 se filtra por `hostName=startidea.es`; sus usuarios no se suman entre canales.
Las zonas horarias de ambas fuentes deben acompañar cualquier comparación.

Las pruebas focalizadas cubren transporte de eventos, parámetros, exclusión de
confirmaciones/utilidades, rutas conservadas y estabilidad de `lastmod`.
La revisión de navegador comprueba entradas contextuales, destino del CTA y
curso preseleccionado; los envíos se interceptan localmente, sin correos, CRM
ni pagos. La compilación completa sigue siendo requisito antes del push.

Referencias de implementación: [eventos GA4](https://developers.google.com/analytics/devguides/collection/ga4/events),
[parámetros automáticos](https://developers.google.com/analytics/devguides/collection/ga4/reference/config#page_location),
[Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query),
[sitemap de Astro](https://docs.astro.build/en/guides/integrations-guide/sitemap/).
