/**
 * Agente B — Redactor de notas SEO.
 *
 * Genera un draft de nota editorial en `src/content/notas/draft-<slug>.md`
 * con frontmatter Astro válido, estructura H2/H3 SEO, internal links a casos
 * y notas existentes, y FAQ schema sugerido.
 *
 * Modos de entrada:
 *   - keyword explícita: el usuario indica el tema
 *   - auto: elige la mejor oportunidad p4_20 / growing_imp / content_gap del analyzer
 *
 * El draft se marca con `draft: true` — Mario revisa y edita antes de publicar.
 */

import { getDb } from '@/lib/seo/db';
import fs from 'node:fs';
import path from 'node:path';
import { chat, notifyTelegram, escapeHtml, startRun, finishRun, failRun, type ChatResult } from './shared';

const SITE = 'https://startidea.es';
const NOTAS_DIR = path.resolve(process.cwd(), 'src/content/notas');

interface OpportunityRow {
  id: number;
  kind: string;
  priority: number;
  url: string | null;
  keyword: string | null;
  metric_summary: string;
  recommendation: string;
}

export interface WriterInput {
  keyword?: string;
  audience?: 'Tercer sector' | 'Instituciones' | 'Empresas con propósito' | 'Todas';
  notes?: string;
  saveToFile?: boolean;
}

export interface WriterDraft {
  slug: string;
  title: string;
  description: string;
  audience: string;
  tags: string[];
  bodyMarkdown: string;
  faqJsonLd: { question: string; answer: string }[];
  internalLinks: string[];
  estimatedWordCount: number;
}

export interface WriterResult {
  runId: number;
  outputMd: string;
  outputJson: { draft: WriterDraft; sourceKeyword: string; filePath?: string };
  costUsd: number;
}

function pickAutoKeyword(): { keyword: string; meta: string } | null {
  const db = getDb();
  // Priorizamos oportunidades de "potencial alto" para nuevo contenido
  const row = db
    .prepare(`
      SELECT keyword, kind, priority, metric_summary
        FROM seo_opportunities
       WHERE resolved_at IS NULL
         AND keyword IS NOT NULL
         AND kind IN ('content_gap','growing_imp','p4_20')
         AND detected_at > strftime('%s','now') - 30 * 86400
       ORDER BY priority ASC, detected_at DESC
       LIMIT 1
    `)
    .get() as { keyword: string; kind: string; priority: number; metric_summary: string } | undefined;
  if (!row) return null;
  return { keyword: row.keyword, meta: `${row.kind} P${row.priority}` };
}

function listExistingNotas(): { title: string; slug: string; description: string }[] {
  if (!fs.existsSync(NOTAS_DIR)) return [];
  const out: { title: string; slug: string; description: string }[] = [];
  for (const f of fs.readdirSync(NOTAS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const slug = f.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(NOTAS_DIR, f), 'utf8');
    const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) continue;
    const fm = m[1];
    const title = fm.match(/^title:\s*['"]?([^\n'"]+)['"]?/m)?.[1]?.trim() ?? slug;
    const description = fm.match(/^description:\s*['"]?([^\n'"]+)['"]?/m)?.[1]?.trim() ?? '';
    const draft = /^draft:\s*true/m.test(fm);
    if (!draft) out.push({ title, slug, description });
  }
  return out;
}

const SYSTEM_PROMPT = `Eres redactor SEO senior especializado en agencias del tercer sector.

Reglas de estilo Startidea (no negociables):
- Español neutro: NUNCA "nosotras" ni "nosotros". Usa "Startidea" como sujeto o reformula en pasiva/impersonal.
- Tono editorial: directo, con criterio, sin jerga vacía. Frases cortas. Sin "engagement", "sinergia", "partnership 360".
- Datos concretos cuando los haya. Si no hay datos, decir "no hay datos públicos" en vez de inventar.
- Estructura H2 con preguntas que la audiencia haría literalmente, H3 para subsecciones.
- 800-1200 palabras. Ni más ni menos. Mejor menos pero útil que largo y vacío.
- Internal links naturales (no listas al final). Usa Markdown [texto](/url).
- Cierra con un párrafo de "qué hacer ahora" práctico (no CTA tipo "contáctanos").

Sobre Startidea: agencia de innovación social en Granada, fundada feb 2011 por Mario Pablo Sánchez Barrón. Atiende 3 audiencias: tercer sector, instituciones (incl. eclesiales), empresas con propósito. Servicios: estrategia, comunicación, fundraising, audiovisual, tecnología.`;

const USER_PROMPT = (input: {
  keyword: string;
  audience: string;
  existing: { title: string; slug: string; description: string }[];
  notes?: string;
}) => `Genera un draft de nota editorial para startidea.es sobre la keyword:

"${input.keyword}"

Audiencia objetivo: ${input.audience}
${input.notes ? `\nNotas adicionales del editor: ${input.notes}\n` : ''}
Notas ya publicadas en el sitio (úsalas para internal links y para NO duplicar tema):
${input.existing.map((n) => `- /notas/${n.slug} — ${n.title}: ${n.description}`).join('\n')}

Casos disponibles para internal link (si encajan):
- /casos/down-granada
- /casos/acogimiento-familiar-granada
- /casos/proyecto-hombre
- /casos/tres-mil-millones-latidos
- /casos/granada-social-5
- /casos/clinica-baca

Páginas de servicio para internal link (si encajan):
- /consultoria, /comunicacion, /fundraising, /audiovisual, /tecnologia
- /para-quien/tercer-sector, /para-quien/instituciones, /para-quien/empresas

Devuelve EXACTAMENTE este JSON (sin markdown wrapper, sin explicación previa, solo JSON válido):

{
  "slug": "kebab-case-slug-para-archivo",
  "title": "Título de la nota — máximo 70 caracteres, optimizado SEO sin clickbait",
  "description": "Meta description 150-160 chars, sin promesas vacías",
  "tags": ["tag1", "tag2", "tag3"],
  "bodyMarkdown": "Contenido completo en Markdown empezando con un párrafo de gancho. Usa ## para H2, ### para H3. Incluye internal links naturales tipo [texto](/url). Cierra con párrafo práctico.",
  "faqJsonLd": [
    {"question": "¿Pregunta frecuente 1?", "answer": "Respuesta concisa 2-3 frases"},
    {"question": "¿Pregunta frecuente 2?", "answer": "Respuesta concisa 2-3 frases"}
  ],
  "internalLinks": ["/notas/slug1", "/casos/x"]
}`;

function safeParseJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No se encontró JSON en la respuesta del LLM');
  return JSON.parse(m[0]);
}

function renderFile(draft: WriterDraft, sourceKeyword: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const escaped = (s: string) => s.replace(/'/g, "''");
  const fm = [
    '---',
    `title: '${escaped(draft.title)}'`,
    `description: '${escaped(draft.description)}'`,
    `pubDate: ${today}`,
    `audience: '${draft.audience}'`,
    `tags: [${draft.tags.map((t) => `'${escaped(t)}'`).join(', ')}]`,
    `draft: true`,
    `# Generado por agente SEO redactor — keyword: "${escaped(sourceKeyword)}"`,
    '---',
    '',
  ].join('\n');
  let body = draft.bodyMarkdown.trim();
  if (draft.faqJsonLd?.length) {
    body += '\n\n## Preguntas frecuentes\n';
    for (const f of draft.faqJsonLd) {
      body += `\n### ${f.question}\n${f.answer}\n`;
    }
  }
  return fm + body + '\n';
}

export async function runWriter(input: WriterInput = {}): Promise<WriterResult> {
  let keyword = input.keyword?.trim();
  let source = 'manual';
  if (!keyword) {
    const auto = pickAutoKeyword();
    if (!auto) {
      throw new Error(
        'No se proporcionó keyword y no hay oportunidades auto-pickeables (modo bootstrap sin GSC). Pasa una keyword explícita.',
      );
    }
    keyword = auto.keyword;
    source = `auto · ${auto.meta}`;
  }

  const audience = input.audience ?? 'Todas';
  const inputSummary = `keyword: "${keyword}" (${source}) · audience: ${audience}`;
  const run = startRun('writer', inputSummary);

  try {
    const existing = listExistingNotas();
    const result: ChatResult = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT({ keyword, audience, existing, notes: input.notes }) },
      ],
      { maxTokens: 3500, temperature: 0.4 },
    );

    const parsed = safeParseJson(result.text) as Omit<WriterDraft, 'estimatedWordCount'>;
    const wordCount = (parsed.bodyMarkdown ?? '').split(/\s+/).filter(Boolean).length;
    const draft: WriterDraft = {
      slug: parsed.slug ?? keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
      title: parsed.title ?? '',
      description: parsed.description ?? '',
      audience,
      tags: parsed.tags ?? [],
      bodyMarkdown: parsed.bodyMarkdown ?? '',
      faqJsonLd: parsed.faqJsonLd ?? [],
      internalLinks: parsed.internalLinks ?? [],
      estimatedWordCount: wordCount,
    };

    const fileContent = renderFile(draft, keyword);
    let filePath: string | undefined;
    if (input.saveToFile !== false) {
      fs.mkdirSync(NOTAS_DIR, { recursive: true });
      filePath = path.join(NOTAS_DIR, `draft-${draft.slug}.md`);
      fs.writeFileSync(filePath, fileContent, 'utf8');
    }

    finishRun(run.id, {
      outputMd: fileContent,
      outputJson: { draft, sourceKeyword: keyword, filePath },
      tokensUsed: result.inputTokens + result.outputTokens,
      costUsd: result.costUsd,
    });

    await notifyTelegram(
      [
        `📝 <b>Draft SEO redactado</b>`,
        '',
        `<b>Keyword:</b> ${escapeHtml(keyword)}`,
        `<b>Título:</b> ${escapeHtml(draft.title)}`,
        `<b>Palabras:</b> ${wordCount}`,
        filePath ? `<b>Archivo:</b> ${escapeHtml(filePath.replace(process.cwd() + '/', ''))}` : '',
        '',
        `Revisar: ${SITE}/admin/seo/agente/${run.id}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );

    return { runId: run.id, outputMd: fileContent, outputJson: { draft, sourceKeyword: keyword, filePath }, costUsd: result.costUsd };
  } catch (err) {
    failRun(run.id, (err as Error).message ?? String(err));
    throw err;
  }
}
