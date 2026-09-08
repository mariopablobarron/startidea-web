# Piloto de redes: precios más IVA

Encargo puntual separado del loop SEO. Mario confirma que los precios Base 49, Activo 99 y Agencia 149 €/mes llevan IVA aparte; el coordinador de coherencia comercial transmite la confirmación literal «aparte» el 8 de septiembre de 2026.

Se añade «+ IVA» en cinco lugares de `src/content/productos/piloto-redes-sociales.md`: metaDescription, precio_desde y las tres celdas de la tabla. La ficha, el listado y los dos documentos llms consumen esa misma fuente. No se modifica el importe base, no se infiere una tasa ni se toca disponibilidad, checkout, HUB, Stripe u otros productos.

Base: `74a8f5850d15ca0a85b7cf49ac0f2f27e2308200`. Worktree y rama nuevos, sin modificaciones concurrentes del Markdown en los otros worktrees revisados. La actualización paralela del HUB tiene otro responsable.

## Verificación

- Baseline público: 13/13 comprobaciones en ficha, listado, llms.txt y llms-full.txt. Confirma importes previos sin «+ IVA».
- Build completo: PASS, 333,80 s.
- Artefacto final servido localmente: 17/17 comprobaciones en cuatro recursos. Ficha y tabla, meta description/Open Graph/Twitter/BlogPosting, tarjeta del listado y ambos documentos llms muestran los precios con «+ IVA».
- Los extractos comparados con producción anterior son idénticos al retirar únicamente esa indicación: mismos importes, resto de textos, estado, beta y enlace de alta. Revisión independiente sin hallazgos. Servidor local cerrado.
- Integración y comprobación de producción: pendientes.
- Evidencia privada en `piloto-iva-evidencias-20260908`, fuera del repositorio. Solo GET públicos y análisis del HTML/texto; sin ejecutar etiquetas, abrir el alta ni enviar formularios.

El alcance es la indicación de IVA en la web. No acredita configuración fiscal de Stripe, disponibilidad del producto o funcionamiento del alta del HUB.
