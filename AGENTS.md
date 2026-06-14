# startidea-web — Guía para Codex Action

Web institucional de **Startidea** (agencia de innovación social en Granada, fundada feb 2011 por Mario Pablo Sánchez Barrón).

## Stack

- **Astro 5** + `@astrojs/node` (SSR standalone)
- **TypeScript** + **Tailwind 3**
- **Content Collections** (`src/content/notas/`, `src/content/diagnosticos/`, `src/content/knowledge/`, `src/content/cursos/`)
- **Better-sqlite3** + **googleapis** para conector SEO (GA4 + Search Console)
- **OpenRouter** (Codex Haiku 4.5) para chat IA y agentes SEO

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

## Gotchas de Astro 5 — patrones que rompen el build o el runtime

Aprendidos a costa de varios deploys fallidos. Antes de hacer commit con cambios en `.astro`, verificar que no se incurre en ninguno:

### 1. Regex literal dentro de IIFE en expresión JSX → "Unterminated regular expression"

**Síntoma:** build falla con `Unterminated regular expression` y un offset que NO coincide con la línea real (esbuild reporta col errónea).

**Causa:** dentro de un `{(() => { ... })()}` o `{items.map(x => { const m = x.match(/pattern/); ... })}`, esbuild interpreta el primer `/` de la regex literal como operador división (porque está en contexto JSX/expression). Falla silenciosamente.

**Patrón seguro:** mover la regex a una función del frontmatter (TypeScript sin ambigüedad). El JSX queda con un ternario o llamada limpia.

```astro
---
// ✅ Bien: regex en frontmatter
function buildFichaUrl(slug: string | null): string | null {
  if (!slug) return null;
  const m = slug.match(/^(boja-\d{4}-inclusion)(?:-l\d+)?$/);
  return m ? `/subvenciones/${m[1]}-social` : `/subvenciones/${slug}`;
}
const fichaUrl = buildFichaUrl(exp.convocatoria_slug);
---
<a href={fichaUrl}>Ver ficha</a>

<!-- ❌ Mal: regex en IIFE JSX -->
{(() => {
  const m = exp.convocatoria_slug.match(/^(boja-\d{4}-inclusion)(?:-l\d+)?$/);
  return m ? <a href={`/subvenciones/${m[1]}-social`}>...</a> : null;
})()}
```

### 2. TypeScript dentro de `<script>` sin `lang="ts"` → SyntaxError silencioso en navegador

**Síntoma:** el script no se ejecuta en navegador, los handlers no se registran, sin error visible en consola. Algunos navegadores parsean parte y descartan resto.

**Causa:** `<script>` (sin atributos) y `<script define:vars={{...}}>` se emiten **literal al HTML**, sin transpilar TypeScript. Cualquier sintaxis TS (casts, generics, non-null `!`) rompe el parse del navegador.

**Sintaxis TS que NO sobrevive en `<script>` plain:**
- `as HTMLInputElement`, `as { ok: boolean }`, `as CustomType`, `as Foo[]`
- `querySelectorAll<HTMLButtonElement>(...)` (generic)
- `el!`, `el!.foo`, `el!.method()` (non-null assertion)
- `: string`, `: Type` (type annotations)
- `interface`, `type Foo =`

**Solución 1 (recomendada):** añadir `lang="ts"` al `<script>`. Astro lo procesa con loader TS.

```astro
<script lang="ts">
  const btn = document.getElementById('btn') as HTMLButtonElement;
</script>
```

**Solución 2:** si el script necesita `define:vars`, escribir JS plain sin tipos.

```astro
<script define:vars={{ apiUrl }}>
  // JavaScript puro — sin casts, sin generics, sin "!"
  const btn = document.getElementById('btn');
  btn?.addEventListener('click', () => fetch(apiUrl));
</script>
```

**Cómo verificar antes de commit:** `awk '/^<script.* define:vars/{flag=1; next} /^<\/script>/{flag=0} flag' archivo.astro > /tmp/x.js && node --check /tmp/x.js`.

### 3. `npm run build` local es el árbitro final, no `tsc --noEmit`

`tsc --noEmit` no detecta los problemas anteriores porque no parsea los `<script>` inline ni el JSX del template. **Antes de cualquier push con cambios en `.astro`, correr `npm run build` local**. Tarda ~2 min pero evita ciclos de deploy fallido en Coolify.

### 4. Auto-deploy SÍ activo vía GitHub Actions (NO vía panel Coolify)

**Cada push a `main` despliega solo.** El mecanismo NO es el panel de Coolify, es el workflow `.github/workflows/deploy.yml`: en cada push a `main` (salvo cambios solo en `docs/`, `reports/`, `README.md`, `infra/`) hace SSH al VPS con la key dedicada (`secret VPS_SSH_KEY`, restringida con `command="..."` en `authorized_keys` a ejecutar solo `/root/deploy-startidea-web.sh` → build + recreate). ~3-4 min. Coolify solo gestiona Traefik/certs/panel.

- **Verificar un deploy**: `gh run list --workflow=deploy.yml --limit 5` (debe salir `success`).
- **Forzar deploy sin commit nuevo**: `gh workflow run deploy.yml`.
- **Si un cambio NO aparece en prod**: confirmar que el path no está en `paths-ignore` (p.ej. solo tocar `reports/` NO dispara deploy — es a propósito).
- ~~"Coolify no auto-deploya, hay que pulsar Deploy"~~ **OBSOLETO** (era cierto antes del 12-may-2026). Ya NO hay que tocar el panel.

## Cómo pedir cosas a Codex en este repo

Ejemplos útiles:
- `@Codex revisa este PR por SEO (titles, descriptions, internal links, JSON-LD)`
- `@Codex implementa una nueva nota en src/content/notas/ a partir de esta keyword: "X"`
- `@Codex añade una redirect 301 desde /url-vieja a /url-nueva`
- `@Codex refactoriza este componente para eliminar duplicación con Y`
- `@Codex check accessibility de este componente`

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
