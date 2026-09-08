# Prensa: miniaturas de PDF y ficha de públicos

8 de septiembre de 2026. Microtanda del loop SEO/GEO sobre `b9ffe12b6f02dc4aef59945cfaeca313c53a9ee5`, conforme al P2 de la auditoría corregida en `8f48dec`.

## Cambio acotado

`src/pages/prensa.astro` utilizaba el PDF como `src` de una imagen. Las dos descargas vectoriales conservan sus URL y atributos `download`, pero muestran los PNG existentes del mismo logo:

| Descarga conservada | Miniatura |
|---|---|
| `/brand/logo-original.pdf` | `/brand/logo-original.png` |
| `/brand/logo-rosa.pdf` | `/brand/logo-rosa.png` |

Se añade una propiedad opcional `preview` a esas dos entradas y la imagen usa `preview ?? src`. La fila «Audiencias» pasa a «Empresas, instituciones, entidades sociales y personas que emprenden».

No se editan assets, cronología, biografía, boilerplate, metadatos, datos estructurados, medición ni otros contenidos de la página. El único archivo de código cambiado es `prensa.astro`.

## Coordinación

El archivo de prensa marcado como modificado en el worktree `plano` solo tenía el título ya integrado. Su contenido completo coincidía byte a byte con `origin/main` actualizado; no se ha duplicado ese trabajo ni editado ese worktree.

## Validación

- Assets locales comprobados: PNG reales de 538 × 538 con transparencia; PDF de una página de 538 × 538 puntos. Correspondencia visual confirmada para las variantes gris/rosa y rosa.
- Las comprobaciones del navegador se limitan a lectura y descargas públicas por GET, con JavaScript desactivado y sin formularios ni eventos de medición.
- Baseline en producción: 29/29 comprobaciones; las dos imágenes PDF tenían `naturalWidth=0` tanto en escritorio como en móvil. Los archivos originales respondían 200.
- `npm run build`: PASS, 328,60 s.
- Artefacto final servido localmente y Chrome: 47/47 comprobaciones en 1440 × 1000 y 390 × 844. Miniaturas cargadas y visibles, cuatro públicos y canonical conservado, cuatro enlaces de descarga con los mismos atributos y cuatro archivos con SHA256 idéntico a producción anterior.
- Revisión independiente: exactamente cuatro sustituciones de líneas; resto de la página y assets sin cambios. `git diff --check` PASS.
- El primer pase del navegador marcó una imagen 0,36 px fuera del viewport porque el desplazamiento automático no la centraba. Se centró con el desplazamiento nativo en el comprobador; el código de la página no cambió. El pase final completo pasó. Navegador y servidor local cerrados.
- Evidencia privada en `seo-baseline-privado-20260908`: `prensa-production-before.json`, `prensa-local-after.json`, `prensa-build.log` y capturas. Las capturas limitan recursos a las dos variantes objetivo; otros logos bloqueados intencionalmente no forman parte de la validación visual.
- PR112 integrada: `7b7aca0f5f7aa3edc2fd658c62f4f0c0af5012d7`, código idéntico al head validado `9e2d90b1f74a47fbbfa71b2b044be5ef8da9a654` tras fetch y comparación.
- Producción verificada el 8 de septiembre de 2026 a las 20:22 CEST (18:22 UTC): imagen `cmoh7d8hi001bp2a4qwjobhzy:7b7aca0`, estado `running/healthy`, fuente completa `7b7aca0f5f7aa3edc2fd658c62f4f0c0af5012d7`, log de despliegue OK. El despliegue automático comenzó a las 18:18:02 UTC; contenedor arrancado a las 18:21:28 UTC.
- Chrome sobre HTTPS: 47/47 comprobaciones en los dos tamaños, miniaturas cargadas y visibles, cuatro públicos y canonical correctos. Los cuatro archivos tienen los mismos SHA256 antes, local y producción; los cuatro enlaces conservan sus atributos. Evidencia `prensa-production-after.json`, terminada a las 18:22:18 UTC, y capturas privadas. Navegador cerrado.
- En esta tanda se esperó al estado saludable antes de la comprobación pública; no se mide ni se afirma disponibilidad continua durante el arranque.

## Límites conservados

Esta corrección permite ver las miniaturas de las dos descargas PDF; no acredita cambios de posicionamiento o citas de IA. Se mantiene el pendiente externo de recepción real consentida en GA4 y de idempotencia del receptor del HUB, sin intervenir en ellos.

El logo blanco transparente tiene un problema de contraste previo sobre el fondo claro. No pertenece a las dos miniaturas PDF de esta microtanda y no se cambia dentro del alcance indicado.

Los despliegues actuales recrean el contenedor y en la tanda anterior se observaron 404 transitorios durante el arranque, recuperados al quedar saludable. La nueva versión publicada se ha verificado saludable y con la página y los archivos respondiendo 200; no se altera infraestructura ni se garantiza disponibilidad continua durante la recreación.
