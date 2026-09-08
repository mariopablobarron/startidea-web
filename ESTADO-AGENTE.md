# Estado del trabajo — startidea-web

Foto de relevo · 8 de septiembre de 2026.

## Encargo actual

Primera tanda de la auditoría SEO/GEO revisada: medición, enlaces de servicios
hacia formación y notas, CTA pertinentes, sitemap y fechas. Mario autorizó
implementarla y pidió comprobar antes lo que había hecho Claude.

## Base y coordinación

- Base remota comprobada: `origin/main` en `30672da` (PR #100, auditoría inicial).
- Rama propia: `codex/seo-primera-tanda-20260908`, worktree aislado del observador.
- Claude dejó 72 archivos versionados modificados y `CursoRelacionado.astro`
  nuevo en el worktree `plano`, rama `seo/quick-wins-2026-09`. Se reaprovechó
  solo el subconjunto pertinente; su trabajo permanece intacto.
- La revisión de la auditoría está en `8f48dec`, rama `codex/auditoria-seo-geo`.
  El informe inicial de #100 contiene conclusiones corregidas: no usar el JOIN
  de consultas/páginas como prueba de canibalización, no indexar 35 landings
  en bloque y no prometer tráfico/rich results por FAQ, Course Info o llms.txt.

## Implementación de esta tanda

- Siete servicios con 21 lecturas editoriales; cuatro cursos con entradas
  contextuales desde servicios y notas. Selección estable y sin relleno ajeno.
- ENISA/CDTI conduce al servicio empresarial. CTA de notas sin UTM internos ni
  plazos/promesas de probabilidad. Alertas básicas identificadas correctamente.
- Contacto conserva curso público e intención (consulta, grupo, aviso) en un
  mensaje editable. La intención de reserva sigue separada del pago confirmado.
- Eventos por la etiqueta GA4 activa; rutas sin parámetros y exclusión de
  utilidades/confirmaciones. No se modifican las preferencias de consentimiento.
- Portal/registro/pedido fuera del sitemap; formularios y confirmaciones con
  noindex. Catálogo sin fechas artificiales. Landings comerciales conservadas.
- Detalle y protocolo de validación: `docs/seo-recorridos-2026-09.md`.

## Evidencia y estado

- 50 pruebas focalizadas pasan. Build completo OK (424 s). Navegador desktop/móvil OK,
  sin errores JavaScript; envíos interceptados localmente, sin CRM/correos/pagos.
- Baseline autenticado GSC/GA4 extraído en solo lectura, con host exacto y
  consulta-página conjunta; datos privados fuera del repositorio público.
- PR #101 abierta en borrador, fusionable; código validado en `59e55d5`.
  Rama publicada. Sin integración ni despliegue de esta tanda.
  El último workflow de despliegue consultado es
  `9db5dff`, success; no es prueba de runtime actual de esta tanda.
- HUB, Lazo, vídeo, regalos ocultos, precios y productos permanecen fuera de
  las modificaciones. Las tareas de Copiloto Pro y memorias siguen sus docs
  `docs/copiloto-pro.md` y `docs/generador-memorias.md`; no se activan servicios.

## Siguiente acción

Revisar y autorizar integración/publicación de la PR #101:
https://github.com/mariopablobarron/startidea-web/pull/101
Según el código vigente, el VPS recoge main mediante cron;
`.github/workflows/deploy.yml` es solo respaldo manual (la guía antigua que
atribuye el auto-deploy a Actions está desfasada). Revalidar el cron al publicar,
y después comprobar SHA/runtime y recepción de eventos en GA4; revisar las
definiciones personalizadas para los desgloses.
