# Estado del trabajo: radar de tendencias

Foto de relevo: 12 de septiembre de 2026. Radar publicado; generación real pendiente de completar por crédito del proveedor.

## Encargo actual

Publicar el radar interno y comprobar una generación real. Mario ha autorizado ambas acciones; no volver a pedir permiso de publicación. La publicación está completada, la generación real todavía no. Las tandas SEO/comerciales anteriores conservan su evidencia en `docs/seo-general-medicion-2026-09.md`.

## Código, integración y validación

- Base remota actualizada `5664fed`. Worktree propio `/Users/STARTIDEA/startidea-web-wt/codex-radar-publicacion-20260912`; rama de implementación `codex/radar-publicacion-20260912`, cierre `codex/radar-cierre-20260912`. Checkout observador y prototipo original intactos.
- [PR124](https://github.com/mariopablobarron/startidea-web/pull/124) integrada a las 11:45:30 UTC: `ab25218aac0d3aad35627d8d623b5aaabbc60bc2`. Árbol integrado idéntico al revisado; no hubo cambios funcionales respecto a la rama original del radar.
- TypeScript correcto, 281/281 pruebas en 24 suites y build Astro completo en 272,55 s. Revisión independiente sin bloqueos estáticos. El primer build se detuvo por ENOSPC del Mac; se retiraron únicamente archivos generados por esta sesión y se reconstruyó correctamente. Persisten avisos previos de páginas prerenderizadas de subvenciones.
- Despliegue real por cron del VPS, detectado a las 11:46:03 UTC. Imagen `cmoh7d8hi001bp2a4qwjobhzy:ab25218`; fuente del build con SHA completo coincidente y árbol limpio. Arranque inicial 11:50:03 UTC y estado healthy comprobado. GitHub Actions queda como respaldo manual.
- Panel HTTPS200 con cookie, no-store/noindex y entrada desde Admin. Sin sesión 302, escritura anónima 401, origen externo 403. Salud JSON 200 con configuración y BD correctas. Captura real: 10 tendencias de Google; Reddit 403, lectura parcial informada. Backup SQLite previo íntegro en el volumen persistente.

## Generación real y bloqueo

Se validó una tendencia real y se llamó al endpoint público. El intento de artículo con 3000 tokens devolvió 502 y recuperó Validada. El diagnóstico con el generador desplegado acreditó OpenRouter 402 por crédito insuficiente. Se ensayó temporalmente el límite documentado de 2000 tokens; artículo y contenido social devolvieron 502, sin borrador válido. Esas respuestas no permiten conocer el fallo intermedio exacto porque el endpoint no registra el detalle. El diagnóstico posterior volvió a acreditar402, ahora incluso para 2000 tokens.

Se ha restaurado la configuración original de 3000 tokens; mismo modelo, credenciales y código. Último arranque 11:57:48 UTC; a las 11:59:14 UTC, contenedor healthy, salud y panel HTTPS 200. Las tablas previas del Copiloto conservan su esquema. Nueve tendencias Detectadas y una Validada; ningún borrador guardado. No se ha recargado saldo ni cambiado de proveedor. La tendencia queda Validada, sin texto simulado ni borrador acreditado. No se ha activado cron del radar ni publicado contenido fuera del panel. El coste exacto de los intentos no queda medido por esta aplicación.

La [guía del radar](docs/radar-tendencias.md) recoge el uso y los límites. Resumen verificable: `docs/radar-produccion-20260912.json`. Evidencia local completa: `/Users/STARTIDEA/startidea-web-wt/radar-publicacion-evidencias-20260912/`. El cierre documental no cambia la aplicación ni requiere otro build.

## Acción de Mario y siguiente acción

Acción de Mario: recargar crédito en OpenRouter y avisar. Se ha solicitado durante la tarea; no hay aprobación de compra o recarga automática.

Estado de ejecución: publicación terminada; comprobación de una generación real sin completar. No queda un proceso de generación activo. Única siguiente acción: con saldo suficiente, repetir por HTTPS una generación en el panel, comprobar estado Lista, JSON persistido y texto completo servido. Si devuelve 502, diagnosticar la respuesta del proveedor; el saldo no acredita por sí solo calidad ni finalización. Para continuar en una tarea nueva: «Ya hay saldo en OpenRouter; completa la generación real del radar y verifica el borrador en producción».
