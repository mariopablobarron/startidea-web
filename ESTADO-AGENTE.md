# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026, 16:52 CEST.

## Encargo actual

Primera tanda SEO/GEO integrada y publicada tras la autorización de Mario.
Incluye medición, recorridos hacia servicios/cursos, contexto de contacto,
sitemap y fechas. Continúa el loop existente; esta tarea mantiene el ownership
de implementación, sin crear automatizaciones ni tareas duplicadas.

## Base y coordinación

- PR #101 integrada por squash: `2d0a71427365a9c8068ad42493e36a5d2c1d5a61`.
  El árbol integrado coincide con el código y documentación revisados.
- El cierre documental usa `codex/seo-cierre-publicacion-20260908`, desde ese
  remoto, en el worktree propio `codex-seo-primera-tanda-20260908`.
- Claude dejó 72 archivos versionados modificados y `CursoRelacionado.astro`
  nuevo en `plano`, rama `seo/quick-wins-2026-09`. Solo se reutilizó el subconjunto
  pertinente; su worktree permanece intacto.
- La auditoría revisada está en `8f48dec`, rama `codex/auditoria-seo-geo`.
  El informe inicial de #100 contiene conclusiones corregidas: no usar el JOIN
  de consultas/páginas como prueba de canibalización, no indexar 35 landings
  en bloque ni prometer tráfico/rich results por FAQ, Course Info o llms.txt.

## Implementación

- Siete servicios con 21 lecturas; cuatro cursos con entradas contextuales.
- ENISA/CDTI conduce al servicio empresarial; CTA sin UTM internos ni promesas.
- Contacto conserva curso público e intención en un mensaje editable.
- Eventos mediante la etiqueta GA4 activa; parámetros públicos y exclusión de
  utilidades/confirmaciones. Preferencias de consentimiento sin cambios.
- Portal, registro y pedidos fuera del sitemap; formularios/confirmaciones con
  noindex. Catálogo sin fechas artificiales; landings comerciales conservadas.
- Detalle: `docs/seo-recorridos-2026-09.md`.

## Integración, despliegue y runtime

- Validación local: 50 pruebas, build completo OK (424 s), navegador desktop/móvil.
- Cron real de KVM8 activo cada 2 min. Inició el despliegue a las 14:46:03 UTC;
  contenedor recreado a las 14:50:00 UTC. A las 14:51:12 UTC, imagen `2d0a714`,
  estado `running/healthy`, SHA completo del origen de build coincidente y log OK.
- Producción: 17 comprobaciones de recorridos en navegador, sin errores JavaScript;
  28 comprobaciones de sitemap/noindex/canonical correctas. Revisión visual móvil
  correcta. Sin envíos de formularios, CRM, correos ni pagos; terceros bloqueados
  durante la prueba de navegador para no generar tráfico analítico artificial.
- Baseline autenticado GSC/GA4 y evidencias de despliegue/navegador/sitemap en
  `../seo-baseline-privado-20260908/`, fuera del repositorio público.
- El mecanismo vigente es pull del VPS; Actions es respaldo manual. El cron
  omite cambios solo documentales. SSH directo dio timeout; `kvm8proxy` funcionó.
- HUB, Lazo, vídeo, regalos ocultos, precios y activación de productos permanecen
  fuera de esta tanda. Copiloto Pro y memorias siguen sus documentos específicos.

## Pendiente y siguiente acción

El efecto en tráfico, consultas y ventas todavía no está medido. La comprobación
read-only de GA4 confirmó cero dimensiones personalizadas; los ocho parámetros
documentados siguen sin definición para los desgloses. La API de tiempo real
es accesible, pero esto no acredita recepción de los eventos publicados.

Siguiente acción única del loop: cerrar la validación de medición en GA4
(recepción real y definiciones necesarias) antes de comparar resultados con
el baseline. Mario no necesita intervenir para el cierre de esta publicación.
