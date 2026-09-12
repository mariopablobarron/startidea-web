# Estado del trabajo: radar de tendencias

Foto de relevo: 12 de septiembre de 2026. Publicación del radar autorizada y en preparación.

## Encargo actual

Radar interno de Startidea para detectar temas, revisar encaje de marca y generar borradores de memes, articulos y contenido social. Uso y limites: [guia del radar](docs/radar-tendencias.md). Las tandas SEO/comerciales anteriores conservan su evidencia en `docs/seo-general-medicion-2026-09.md`; este encargo no modifica productos, precios ni HUB.

## Codigo y validacion

- Base: `origin/main` actualizada, `5664fed`. Rama nueva `codex/radar-20260912-01a09546`, worktree `/Users/STARTIDEA/startidea-web-wt/codex-radar-20260912-01a09546`. El prototipo del checkout observador permanece intacto; se trasladaron solo los archivos del radar y se adapto la tarjeta del panel a la base remota.
- Fuentes con errores visibles, identidades estables, fechas, comparacion de senales, enlaces de contraste y orden por potencial/encaje/recencia. Generacion requiere validacion y claim atomico; recupera errores, conserva articulos completos y usa el selector de modelos existente.
- Implementacion guardada en el commit local `c1b48dd`; cierre posterior de documentacion y espacios sin efecto funcional.
- Validacion local: TypeScript correcto; 281/281 pruebas en 24 suites, incluidas 20 del radar; build completo correcto en 258,96 segundos. El build mantiene advertencias preexistentes sobre cabeceras en paginas prerenderizadas de subvenciones.
- Smoke real aislado: 10 tendencias Google, segunda lectura sin duplicados; Reddit devuelve 403 y se informa lectura parcial. Panel200/noindex/no-store, acceso anonimo302, origen externo403, formulario303, JSON invalido400 y ausencia de conexion IA503. Articulo largo simulado renderizado con parrafos, idea, riesgos y boton copiar; fixture retirado. Evidencia: `docs/radar-validacion-20260912.json`.

## Integracion, limites y accion siguiente

Mario ha autorizado publicar y comprobar una generación real. Se ha creado el worktree nuevo `/Users/STARTIDEA/startidea-web-wt/codex-radar-publicacion-20260912`, rama `codex/radar-publicacion-20260912`, desde `origin/main` actualizada (`5664fed`), incorporando el radar sin cambios funcionales. La revisión independiente no encuentra bloqueos. Producción tiene la conexión de IA y el volumen configurados; existe backup íntegro previo de la base de datos. Integración, despliegue y generación real pendientes de cerrar en esta tanda; hasta aquí, las pruebas de IA usan respuestas simuladas. Los memes son conceptos y texto, no imagenes generadas. No se acredita notoriedad ni rendimiento editorial. El servidor de pruebas esta cerrado.

Acción de Mario: ninguna; publicación y prueba real ya autorizadas. Estado de ejecución: comprobación local y publicación en curso. El despliegue vigente se ha verificado: cron del VPS cada dos minutos, con lock y build; GitHub Actions queda como respaldo manual. Única siguiente acción: integrar tras el build correcto, comprobar el SHA desplegado, ejecutar una generación real y cerrar el relevo con su evidencia. No activar cron del radar ni publicar el borrador fuera del panel.
