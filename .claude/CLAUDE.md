# startidea-web — Guía para Claude Code Action

Web institucional de **Startidea** (agencia de innovación social en Granada, fundada feb 2011 por Mario Pablo Sánchez Barrón).

## Stack

- **Astro 5** + `@astrojs/node` (SSR standalone)
- **TypeScript** + **Tailwind 3**
- **Content Collections** (`src/content/notas/`, `src/content/diagnosticos/`, `src/content/knowledge/`, `src/content/cursos/`)
- **Better-sqlite3** + **googleapis** para conector SEO (GA4 + Search Console)
- **OpenRouter** (Claude Haiku 4.5) para chat IA y agentes SEO

## Despliegue

- Producción: `https://startidea.es` en VPS Hostinger (Coolify v3 + Traefik)
- Build: Docker `node:20-alpine` con build tools (`python3 make g++ git`) para better-sqlite3
- DNS gestionado en **IONOS** (NS `ns1117.ui-dns.*`)

## Reglas de redacción y comunicación

- **Español neutro siempre.** Nunca usar "nosotras" ni "nosotros". Decir "Startidea" como sujeto, o reformular en pasiva/impersonal.
- **3 audiencias** del negocio: tercer sector, instituciones (incluidas eclesiales), empresas con propósito.
- **ASE = Acción Social Empresarial** (NO "Asociación Sectorial de Comunicación Eclesial").
- Tono editorial: directo, sin clickbait, sin jerga vacía. Frases cortas. Sin "engagement" ni "sinergia".

## Cosas específicas a respetar al editar código

- No reproducir literalmente keys ni tokens en commits ni en respuestas — están en `.env` del container Coolify y nunca en el repo.
- `.env.example` mantiene la plantilla. Si añades una variable nueva, actualiza también ese archivo.
- Las redirecciones legacy del WP viejo viven en `astro.config.mjs` → bloque `redirects:`. Si una URL antigua aparece en GSC sin redirect, ahí va.
- JSON-LD (Organization, WebSite, LocalBusiness, BlogPosting, etc.) está en `src/lib/jsonld.ts`. Usar siempre los helpers, no inline.
- Cualquier nota nueva en `src/content/notas/` se publica con `draft: false` cuando esté lista. Mientras se redacta, `draft: true`.
- Los agentes SEO (analista + redactor) viven en `src/lib/seo-agents/`. Su output persiste en `seo_agent_outputs` (SQLite).
- Cron diario 06:00 UTC sincroniza GA4/GSC; lunes 07:00 UTC corre el analista. Si modificas esos scripts, están en la VPS en `/usr/local/bin/seo-*-*.sh`.

## Cómo pedir cosas a Claude en este repo

Ejemplos útiles:
- `@claude revisa este PR por SEO (titles, descriptions, internal links, JSON-LD)`
- `@claude implementa una nueva nota en src/content/notas/ a partir de esta keyword: "X"`
- `@claude añade una redirect 301 desde /url-vieja a /url-nueva`
- `@claude refactoriza este componente para eliminar duplicación con Y`
- `@claude check accessibility de este componente`

## Pendientes/sprints conocidos

- ~~S3: 3 notas editoriales más (agencia pequeña vs grande, cómo elegir agencia, método del diagnóstico)~~ ✅ DONE
- ~~S4: newsletter segmentation + Google AdGrants landing~~ ✅ DONE (2026-05-26)
- ~~S5: Startidea Lab Cursos~~ ✅ DONE (2026-05-26) — 3 cursos publicados

- S6: Copiloto de Subvenciones — Fase 2 (Playwright sede electrónica)
  - Admin panel placeholder en `/admin/expedientes/[id]` → sección "Fase 2 — Automatización sede electrónica"
  - Pendiente: implementar por sede (Junta de Andalucía, BDNS/infosubvenciones.es, OEPM...)
  - Requiere container separado con Playwright (NO meter en imagen principal)

- ~~S7 (editorial): 2-3 notas adicionales~~ ✅ DONE (2026-05-26)
  - roi-tramitar-subvenciones-agencia.md
  - fundraising-individual-asociaciones-pequenas.md
  - medir-resultados-email-marketing-esfl.md

## Datos sensibles

- API key OpenRouter, GOOGLE_CLIENT_SECRET, ADMIN_TOKEN, etc. NUNCA en commits.
- Si encuentras un secret expuesto en código, pídeme que lo rote antes de cualquier otro cambio.
