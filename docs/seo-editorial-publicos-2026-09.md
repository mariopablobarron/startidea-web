# Revisión editorial: públicos, servicios y compromiso BOJA

9 de septiembre de 2026. Tanda autorizada por Mario mediante «revisa y sigue», transmitida por el coordinador SEO después del cierre separado de IVA del Piloto (PR115/116). Criterio: [auditoría corregida](auditoria-seo-geo-corregida-2026-09.md).

Base remota actualizada: `7127ae4b700f130d6fe9211ea618c3cae46cf825`. Worktree y rama nuevos `codex-seo-editorial-publicos-20260909` / `codex/seo-editorial-publicos-20260909`. La comparación por contenido de los cuatro archivos en los demás worktrees detectó restos de un borrador previo a PR106 en `plano`, sin cambios concurrentes durante la comprobación. Ese worktree permanece intacto.

## Cambio

| Página | Antes | Después |
|---|---|---|
| Comunicación | Título centrado en ONG; presentación general sin personas que emprenden; marketing descrito como exclusivo de causas. | Título de comunicación estratégica y marketing en Granada; cuatro públicos en la presentación y Service; objetivos comerciales, institucionales y sociales. |
| Qué hacemos | Introducción con tres públicos y seis servicios que situaba fundraising entre las cuatro líneas principales. | Cuatro públicos y enlaces a Consultoría, Comunicación, Audiovisual y Tecnología. Fundraising, financiación y protección digital conservan su contenido especializado. |
| Notas | Título centrado en fundraising y subvenciones. | Comunicación, estrategia, financiación y tecnología; cuatro públicos en introducción y metadatos. |
| BOJA inclusión social | Compromiso de expediente preparado antes de la orden y presentación el primer día, sin respaldo operativo acreditado. | Revisión de requisitos y documentación; preparación y presentación ajustadas a bases y plazo oficial. |

La [Orden de 20 de mayo de 2026](https://www.juntadeandalucia.es/boja/2026/99/c01/1) está en BOJA 99 **Complementario 1**. Se verificó la fuente oficial para el párrafo de proceso; no se añaden plazos concretos, garantías ni fechas futuras. El cambio no revalida el resto de afirmaciones de la ficha.

Se conservan las preguntas y respuestas, su gate de 21 días desde indexación acreditada, los pasos de la guía para ONG, las ofertas y precios, las llamadas a la acción y los contenidos especializados. Notas mantiene su colección, categorías y filtros editoriales actuales. No se cambian rutas, canonical, formularios, medición, productos, HUB ni infraestructura.

## Validación y publicación

Baseline público congelado el 8 de septiembre a las 22:11 UTC (9 de septiembre a las 00:11 CEST): **152/152 comprobaciones**. Las cuatro páginas y 115 destinos internos únicos responden 200; nueve anclas válidas. Se guardan 53 preguntas en FAQPage (8/39/6), un HowTo, 23 bloques con importes, 122 tarjetas renderizadas de Notas (incluyen su repetición por categorías) y 13 controles de filtrado. HTML y resultados fuera del repositorio en `seo-editorial-evidencias-20260909`.

- Build completo: **PASS, 314,55 s**, salida 0.
- Artefacto final servido localmente: **214/214 comprobaciones**. Canonicals, robots, FAQPage/HowTo/Offer, bloques de FAQ/precios y formularios conservados; 122 tarjetas y 13 filtros de Notas idénticos. Todos los enlaces anteriores presentes; cuatro enlaces nuevos a las familias existentes. Los 115 destinos internos y nueve anclas funcionan.
- Metadatos y presentación revisados en el HTML; nuevo párrafo BOJA presente y promesa retirada. Revisión independiente del diff sin hallazgos bloqueantes.
- Solo GET y análisis local de HTML. Sin navegador, SDK, eventos ni envíos. Servidor temporal cerrado.
- PR117 integrada: `78e98d931d245e34c4a3b4201ac515cd453aea7e`, el 8 de septiembre a las 22:18 UTC (9 de septiembre a las 00:18 CEST). Fuentes iguales al head validado `34938b98fd332b9e144623690da2fef1005d2eae` tras fetch.
- Producción: imagen `78e98d9`, fuente completa coincidente, `running/healthy` y log de despliegue OK. Arranque `2026-09-08T22:24:00.736842363Z` (9 de septiembre a las 00:24 CEST).
- HTTPS público, 00:24:48–00:25:05 CEST: **214/214 comprobaciones**, con los mismos criterios de preservación y enlaces. **40/40 comparaciones** adicionales de metadatos, H1, introducciones, texto y enlaces del main, JSON-LD, tarjetas y filtros coinciden con el artefacto final validado localmente. El contenido nuevo está servido, incluido el párrafo BOJA.
- Evidencia: `editorial-production-before.json`, `editorial-local-after.json`, `editorial-production-after.json`, `artifact-production-match.json` y `build.log`, fuera del repositorio. Cierre documental posterior, sin más cambios de aplicación ni otro despliegue necesario.

## Límites

El cambio de títulos y presentación puede modificar qué consultas encuentran estas páginas y sus clics. Conservar URLs, contenido especializado y enlaces reduce el alcance de la modificación, pero no demuestra ausencia de fluctuaciones ni mejora de posicionamiento. No es un experimento aislado y no permite atribuir resultados causales.

Esta tanda no acredita indexación, citas de IA, recepción de eventos en Google ni rendimiento móvil. La [conciliación anterior](seo-conciliacion-2026-09.md) sigue como inventario histórico de los demás pendientes. La ventana allí propuesta para cambios del 8 de septiembre no debe reutilizarse automáticamente como evaluación completa de esta tanda del día 9; el periodo deberá considerar su publicación y recrawl efectivos.
