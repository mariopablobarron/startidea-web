// Renderiza un Landing validado a HTML usando la paleta y clases
// Tailwind de Startidea (magenta, ink, paper, Montserrat). El resultado
// es un fragmento HTML autocontenido que se puede inyectar dentro de
// cualquier <main> con las clases globales del sitio cargadas.
//
// Decisión de seguridad: TODO texto del modelo pasa por escapeHtml antes
// de aterrizar en el HTML. Aunque el schema Zod limita longitud, no podemos
// confiar en que el modelo no incluya HTML/script en los campos de texto.
import type { Landing } from './schema';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sustituye accent dentro del headline por <em> en magenta cursiva.
// Como ambos pasan por escapeHtml por separado y headlineAccent es
// substring de headline, se compara sobre el texto ya escapado.
function renderHeadline(headline: string, accent: string): string {
  const safeHeadline = escapeHtml(headline);
  const safeAccent = escapeHtml(accent);
  if (!safeAccent || !safeHeadline.includes(safeAccent)) {
    return safeHeadline;
  }
  return safeHeadline.replace(
    safeAccent,
    `<em class="italic text-magenta">${safeAccent}</em>`,
  );
}

function renderCta(
  cta: { text: string; href: string },
  variant: 'primary' | 'ghost' = 'primary',
  trackId?: string,
): string {
  const cls =
    variant === 'primary'
      ? 'btn'
      : 'btn-ghost';
  const track = trackId
    ? ` data-track="cta" data-track-id="${escapeHtml(trackId)}"`
    : '';
  return `<a href="${escapeHtml(cta.href)}" class="${cls}"${track}>${escapeHtml(cta.text)}<span aria-hidden="true">→</span></a>`;
}

function renderFeatureGrid(s: Extract<Landing['sections'][number], { kind: 'feature-grid' }>): string {
  const intro = s.intro
    ? `<p class="mt-6 max-w-measure text-lede text-ink/85">${escapeHtml(s.intro)}</p>`
    : '';
  const cols = s.items.length <= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3';
  const items = s.items
    .map(
      (it, i) => `
      <li class="bg-paper-warm p-8">
        <span class="font-display text-5xl text-magenta">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="mt-4 font-display text-2xl leading-tight text-ink">${escapeHtml(it.title)}</h3>
        <p class="mt-3 text-sm leading-relaxed text-ink/80">${escapeHtml(it.body)}</p>
      </li>`,
    )
    .join('');
  return `
  <section class="bg-paper-warm py-20 md:py-28">
    <div class="container-x">
      <div class="grid grid-cols-12 gap-x-8 border-t border-ink/15 pt-8">
        <div class="col-span-12 lg:col-span-3">
          <span class="label">— Detalle</span>
        </div>
        <div class="col-span-12 mt-6 lg:col-span-9 lg:mt-0">
          <h2 class="font-display text-display-md leading-tight text-ink">${escapeHtml(s.title)}</h2>
          ${intro}
          <ol class="mt-12 grid gap-px border-2 border-ink/15 bg-ink/15 ${cols}">${items}</ol>
        </div>
      </div>
    </div>
  </section>`;
}

function renderCtaBlock(s: Extract<Landing['sections'][number], { kind: 'cta-block' }>): string {
  return `
  <section class="bg-ink py-20 text-paper md:py-28">
    <div class="container-x">
      <div class="grid grid-cols-12 gap-x-8">
        <div class="col-span-12 lg:col-span-3"><span class="label !text-paper/60">— Siguiente paso</span></div>
        <div class="col-span-12 mt-6 lg:col-span-9 lg:mt-0">
          <h2 class="font-display text-display-md leading-tight text-paper">${escapeHtml(s.title)}</h2>
          <p class="mt-5 max-w-measure text-lede text-paper/85">${escapeHtml(s.body)}</p>
          <div class="mt-10">
            <a href="${escapeHtml(s.cta.href)}" class="btn !bg-paper !text-ink !border-paper hover:!bg-magenta hover:!text-paper hover:!border-magenta" data-track="cta" data-track-id="landing_ai_ctablock">
              ${escapeHtml(s.cta.text)} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderFaqs(s: Extract<Landing['sections'][number], { kind: 'faqs' }>): string {
  const items = s.items
    .map(
      (it) => `
      <details class="group py-6">
        <summary class="flex cursor-pointer list-none items-start justify-between gap-6">
          <span class="font-display text-xl leading-tight text-ink group-hover:text-magenta">${escapeHtml(it.q)}</span>
          <span aria-hidden="true" class="mt-1 font-mono text-2xl text-magenta transition-transform group-open:rotate-45">+</span>
        </summary>
        <p class="mt-4 max-w-measure text-ink/85">${escapeHtml(it.a)}</p>
      </details>`,
    )
    .join('');
  return `
  <section id="faqs" class="bg-paper py-20 md:py-28">
    <div class="container-x">
      <div class="grid grid-cols-12 gap-x-8 border-t border-ink/15 pt-8">
        <div class="col-span-12 lg:col-span-3"><span class="label">— Preguntas frecuentes</span></div>
        <div class="col-span-12 mt-6 lg:col-span-9 lg:mt-0">
          <h2 class="font-display text-display-md leading-tight text-ink">${escapeHtml(s.title)}</h2>
          <div class="mt-12 divide-y divide-ink/15 border-y-2 border-ink/15">${items}</div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderQuote(s: Extract<Landing['sections'][number], { kind: 'quote' }>): string {
  const author = s.author
    ? `<footer class="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink-mute">— ${escapeHtml(s.author)}</footer>`
    : '';
  return `
  <section class="bg-paper-warm py-20 md:py-28">
    <div class="container-x">
      <blockquote class="mx-auto max-w-3xl border-l-4 border-magenta pl-8">
        <p class="font-display text-display-md leading-tight text-ink">"${escapeHtml(s.text)}"</p>
        ${author}
      </blockquote>
    </div>
  </section>`;
}

function renderSection(s: Landing['sections'][number]): string {
  switch (s.kind) {
    case 'feature-grid':
      return renderFeatureGrid(s);
    case 'cta-block':
      return renderCtaBlock(s);
    case 'faqs':
      return renderFaqs(s);
    case 'quote':
      return renderQuote(s);
  }
}

export function renderLanding(landing: Landing): string {
  const heroSecondary = landing.hero.secondaryCta
    ? renderCta(landing.hero.secondaryCta, 'ghost', 'landing_ai_hero_secondary')
    : '';

  const sections = landing.sections.map(renderSection).join('\n');

  return `
<article>
  <!-- Hero -->
  <section class="border-b border-ink/15 bg-paper py-16 md:py-24 lg:py-28">
    <div class="container-x">
      <span class="label">${escapeHtml(landing.hero.eyebrow)}</span>
      <h1 class="mt-4 font-display text-display-xl leading-[0.96] text-ink">
        ${renderHeadline(landing.hero.headline, landing.hero.headlineAccent)}
      </h1>
      <p class="mt-8 max-w-measure text-lede text-ink/80">${escapeHtml(landing.hero.subtitle)}</p>
      <div class="mt-10 flex flex-wrap gap-4">
        ${renderCta(landing.hero.primaryCta, 'primary', 'landing_ai_hero_primary')}
        ${heroSecondary}
      </div>
    </div>
  </section>

  ${sections}

  <!-- Closing CTA -->
  <section class="border-t border-ink/15 bg-paper-warm py-20 md:py-28">
    <div class="container-x">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="font-display text-display-md leading-tight text-ink">${escapeHtml(landing.closingCta.title)}</h2>
        <p class="mt-6 text-lede text-ink/80">${escapeHtml(landing.closingCta.body)}</p>
        <div class="mt-10">
          ${renderCta(landing.closingCta.primaryCta, 'primary', 'landing_ai_closing')}
        </div>
      </div>
    </div>
  </section>
</article>`;
}
