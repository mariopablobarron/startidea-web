# Piloto de redes: precios más IVA

Encargo puntual separado del loop SEO. Mario confirma que los precios Base 49, Activo 99 y Agencia 149 €/mes llevan IVA aparte; el coordinador de coherencia comercial transmite la confirmación literal «aparte» el 8 de septiembre de 2026.

Se añade «+ IVA» en cinco lugares de `src/content/productos/piloto-redes-sociales.md`: metaDescription, precio_desde y las tres celdas de la tabla. La ficha, el listado y los dos documentos llms consumen esa misma fuente. No se modifica el importe base, no se infiere una tasa ni se toca disponibilidad, checkout, HUB, Stripe u otros productos.

Base: `74a8f5850d15ca0a85b7cf49ac0f2f27e2308200`. Worktree y rama nuevos, sin modificaciones concurrentes del Markdown en los otros worktrees revisados. La actualización paralela del HUB tiene otro responsable.

## Verificación

- Baseline público: 13/13 comprobaciones en ficha, listado, llms.txt y llms-full.txt. Confirma importes previos sin «+ IVA».
- Build completo: PASS, 333,80 s.
- Artefacto final servido localmente: 17/17 comprobaciones en cuatro recursos. Ficha y tabla, meta description/Open Graph/Twitter/BlogPosting, tarjeta del listado y ambos documentos llms muestran los precios con «+ IVA».
- Los extractos comparados con producción anterior son idénticos al retirar únicamente esa indicación: mismos importes, resto de textos, estado, beta y enlace de alta. Revisión independiente sin hallazgos. Servidor local cerrado.
- PR115 integrada: `e473d8561c64c7175b4fb0f091c8adfa5f5e1390`; fuentes iguales al head validado `45b9ceac329bf30b425387c42fd09037427018bc` tras fetch.
- Producción comprobada a las `2026-09-08T22:06:50.500880+00:00`: imagen `e473d85` en estado `running/healthy`, fuente completa coincidente y log de despliegue OK. El contenedor arrancó el 8 de septiembre a las 22:06 UTC (9 de septiembre a las 00:06 CEST).
- HTTPS público: 17/17 comprobaciones en los cuatro recursos, con «+ IVA» en los tres planes y sus superficies derivadas. Extractos equivalentes al baseline al retirar únicamente esa indicación. Evidencia `production-after.json`; ningún envío de alta, formulario o evento.
- Cierre documental posterior; sin cambios de aplicación ni segundo despliegue necesario.
- Evidencia privada en `piloto-iva-evidencias-20260908`, fuera del repositorio. Solo GET públicos y análisis del HTML/texto; sin ejecutar etiquetas, abrir el alta ni enviar formularios.

El alcance es la indicación de IVA en la web. No acredita configuración fiscal de Stripe, disponibilidad del producto o funcionamiento del alta del HUB.
