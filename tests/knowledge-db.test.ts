import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Sin red en los tests: solo FTS. Se fija ANTES de importar el módulo.
process.env.PLANO_EMBEDDINGS = 'off';

import {
  insertarDoc,
  borrarDoc,
  listarDocs,
  getDoc,
  buscarChunks,
  contextoDocumentos,
  sanearConsultaFts,
  embedChunksPendientes,
  embeddingsActivos,
  cerrarKnowledgeDb,
} from '../src/lib/knowledge-db';
import { trocear, normalizarTexto } from '../src/lib/knowledge-extract';
import { origenCoincide, dentroDeKnowledge, knowledgeRoot, fallo, redirigirPanel, quiereJson } from '../src/lib/knowledge-auth';

const previousDir = process.env.EXPEDIENTES_DIR;
let root = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'startidea-knowledge-'));
  process.env.EXPEDIENTES_DIR = root;
});

afterAll(() => {
  cerrarKnowledgeDb();
  if (previousDir === undefined) delete process.env.EXPEDIENTES_DIR;
  else process.env.EXPEDIENTES_DIR = previousDir;
  rmSync(root, { recursive: true, force: true });
});

const DOC_SUBVENCIONES = [
  'Guía de subvenciones para asociaciones pequeñas.',
  'La subvención de la Junta de Andalucía para inclusión social se convoca cada año en primavera.',
  'Startidea acompaña la tramitación: memoria técnica, presupuesto y checklist de documentación.',
  'El plazo habitual es de veinte días hábiles desde la publicación en el BOJA.',
].join('\n\n');

const DOC_COMUNICACION = [
  'Manual de comunicación para entidades sociales.',
  'Un plan de comunicación empieza por decidir a quién le hablas y qué quieres que haga después.',
  'La newsletter mensual sigue siendo el canal con mejor retorno para organizaciones sin ánimo de lucro.',
].join('\n\n');

describe('knowledge-db', () => {
  it('crea la BD en EXPEDIENTES_DIR e inserta dos documentos troceados', () => {
    const a = insertarDoc({ id: 'doc-subv', nombre: 'guia-subvenciones.md', ext: '.md', titulo: 'Guía subvenciones', texto: DOC_SUBVENCIONES });
    const b = insertarDoc({ id: 'doc-comu', nombre: 'manual-comunicacion.txt', ext: 'txt', notas: 'interno', texto: DOC_COMUNICACION });
    expect(existsSync(join(root, 'knowledge.db'))).toBe(true);
    expect(a.n_chunks).toBeGreaterThanOrEqual(1);
    expect(b.n_chunks).toBeGreaterThanOrEqual(1);
    expect(listarDocs().map((d) => d.id).sort()).toEqual(['doc-comu', 'doc-subv']);
    expect(getDoc('doc-subv')?.titulo).toBe('Guía subvenciones');
    expect(getDoc('doc-comu')?.ext).toBe('txt');
  });

  it("buscarChunks('subvencion') encuentra el trozo con «subvención» (diacríticos plegados)", async () => {
    const hits = await buscarChunks('subvencion');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].doc_id).toBe('doc-subv');
    expect(hits[0].nombre).toBe('guia-subvenciones.md');
    expect(hits[0].texto.toLowerCase()).toContain('subvención');
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits[0].fuente).toBe('fts');
    // Y no devuelve el manual de comunicación para esta consulta.
    expect(hits.some((h) => h.doc_id === 'doc-comu')).toBe(false);
  });

  it('una consulta con frase de chat y signos sigue encontrando lo relevante', async () => {
    const hits = await buscarChunks('¿Cuál es el plazo de la subvención de la Junta?');
    expect(hits[0]?.doc_id).toBe('doc-subv');
  });

  it('devuelve [] si la consulta queda vacía tras sanear', async () => {
    expect(sanearConsultaFts('¿¿ !! ... ---')).toBe('');
    expect(await buscarChunks('¿¿ !! ... ---')).toEqual([]);
    expect(await buscarChunks('   ')).toEqual([]);
  });

  it('sanearConsultaFts entrecomilla tokens y quita signos', () => {
    const q = sanearConsultaFts('subvención "junta" (2026)');
    expect(q).toBe('"subvencion" OR "junta" OR "2026"');
  });

  it('contextoDocumentos devuelve un bloque marcado como datos', async () => {
    const ctx = await contextoDocumentos('newsletter para asociaciones');
    expect(ctx.startsWith('=== DOCUMENTOS DE APOYO')).toBe(true);
    expect(ctx).toContain('[manual-comunicacion.txt#');
    expect(ctx).toContain('=== FIN DOCUMENTOS ===');
    expect(ctx.length).toBeLessThanOrEqual(6000 + 200);
  });

  it('borrarDoc elimina fila y trozos y deja el FTS limpio', async () => {
    expect(borrarDoc('doc-subv')).toBe(true);
    expect(getDoc('doc-subv')).toBeNull();
    expect(listarDocs().map((d) => d.id)).toEqual(['doc-comu']);
    expect(await buscarChunks('subvencion')).toEqual([]);
    expect(borrarDoc('doc-subv')).toBe(false);
  });

  it('contextoDocumentos devuelve "" sin documentos', async () => {
    borrarDoc('doc-comu');
    expect(await contextoDocumentos('newsletter')).toBe('');
    expect(await buscarChunks('newsletter')).toEqual([]);
  });
});

describe('embeddings solo de forma explícita (PLANO_EMBEDDINGS=on)', () => {
  const envPrevio = { key: process.env.OPENROUTER_API_KEY, emb: process.env.PLANO_EMBEDDINGS };

  afterAll(() => {
    vi.unstubAllGlobals();
    if (envPrevio.key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = envPrevio.key;
    process.env.PLANO_EMBEDDINGS = envPrevio.emb ?? 'off';
    borrarDoc('doc-sin-emb');
  });

  it('embeddingsActivos() es false sin la variable, con off o con cualquier valor que no sea on', () => {
    process.env.OPENROUTER_API_KEY = 'clave-de-prueba';
    delete process.env.PLANO_EMBEDDINGS;
    expect(embeddingsActivos()).toBe(false);
    process.env.PLANO_EMBEDDINGS = 'off';
    expect(embeddingsActivos()).toBe(false);
    process.env.PLANO_EMBEDDINGS = 'true';
    expect(embeddingsActivos()).toBe(false);
    process.env.PLANO_EMBEDDINGS = 'on';
    expect(embeddingsActivos()).toBe(true);
    delete process.env.OPENROUTER_API_KEY;
    expect(embeddingsActivos()).toBe(false);
  });

  it('sin PLANO_EMBEDDINGS no se llama a OpenRouter ni al indexar ni al buscar', async () => {
    process.env.OPENROUTER_API_KEY = 'clave-de-prueba';
    delete process.env.PLANO_EMBEDDINGS;
    const fetchMock = vi.fn(async () => { throw new Error('no debería llamarse'); });
    vi.stubGlobal('fetch', fetchMock);
    insertarDoc({ id: 'doc-sin-emb', nombre: 'sin-emb.txt', ext: 'txt', texto: DOC_SUBVENCIONES });
    await embedChunksPendientes('doc-sin-emb');
    const hits = await buscarChunks('subvencion');
    expect(hits[0]?.doc_id).toBe('doc-sin-emb');
    expect(hits[0]?.fuente).toBe('fts');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('embeddings best-effort (fetch simulado)', () => {
  const envPrevio = { key: process.env.OPENROUTER_API_KEY, emb: process.env.PLANO_EMBEDDINGS };

  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = 'clave-de-prueba';
    process.env.PLANO_EMBEDDINGS = 'on';
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    if (envPrevio.key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = envPrevio.key;
    process.env.PLANO_EMBEDDINGS = envPrevio.emb ?? 'off';
    borrarDoc('doc-emb');
  });

  it('si OpenRouter falla, embedChunksPendientes no lanza y buscarChunks sigue con FTS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red'); }));
    insertarDoc({ id: 'doc-emb', nombre: 'emb.txt', ext: 'txt', texto: DOC_SUBVENCIONES });
    await expect(embedChunksPendientes('doc-emb')).resolves.toBeUndefined();
    expect(getDoc('doc-emb')?.embebido).toBe(0);
    const hits = await buscarChunks('subvencion');
    expect(hits[0]?.doc_id).toBe('doc-emb');
    expect(hits[0]?.fuente).toBe('fts');
  });

  it('con embeddings guardados, la búsqueda fusiona texto y vector', async () => {
    // Vector determinista: todos iguales → coseno 1 para cualquier trozo.
    const vector = Array.from({ length: 8 }, (_, i) => (i + 1) / 10);
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: { body?: string }) => {
      const n = (JSON.parse(init?.body ?? '{}').input as string[]).length;
      return new Response(JSON.stringify({ data: Array.from({ length: n }, (_, index) => ({ index, embedding: vector })) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }));
    await embedChunksPendientes('doc-emb');
    expect(getDoc('doc-emb')?.embebido).toBe(1);
    const hits = await buscarChunks('subvencion');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].doc_id).toBe('doc-emb');
    expect(hits[0].fuente).toBe('ambos');
  });
});

describe('trocear', () => {
  const parrafo = 'Este es un párrafo de prueba con varias frases. Cada frase aporta algo. Y la última cierra el párrafo con una idea.';
  const largo = Array.from({ length: 60 }, (_, i) => `Párrafo ${i + 1}. ${parrafo}`).join('\n\n');

  it('respeta el tamaño máximo y solapa trozos consecutivos', () => {
    const trozos = trocear(largo, { tam: 900, solape: 150 });
    expect(trozos.length).toBeGreaterThan(5);
    for (const t of trozos) {
      expect(t.length).toBeLessThanOrEqual(900);
      expect(t.length).toBeGreaterThan(0);
      expect(largo).toContain(t);
    }
    // Solape: el arranque de cada trozo ya aparecía al final del anterior.
    for (let i = 1; i < trozos.length; i++) {
      const arranque = trozos[i].slice(0, 40);
      expect(trozos[i - 1]).toContain(arranque);
    }
    // Cobertura: el principio y el final del texto están en los trozos.
    expect(trozos[0].startsWith('Párrafo 1.')).toBe(true);
    expect(trozos[trozos.length - 1].endsWith('una idea.')).toBe(true);
  });

  it('corta preferentemente por párrafo', () => {
    const trozos = trocear(largo, { tam: 900, solape: 150 });
    // Con párrafos de ~130 chars, cada trozo (salvo el último) debe terminar en punto.
    for (const t of trozos.slice(0, -1)) expect(t.endsWith('.')).toBe(true);
  });

  it('devuelve un único trozo para textos cortos y [] para vacío', () => {
    expect(trocear('hola')).toEqual(['hola']);
    expect(trocear('   ')).toEqual([]);
  });

  it('no se queda colgado con texto sin espacios', () => {
    const sinEspacios = 'a'.repeat(2500);
    const trozos = trocear(sinEspacios, { tam: 900, solape: 150 });
    expect(trozos.length).toBeGreaterThanOrEqual(3);
    for (const t of trozos) expect(t.length).toBeLessThanOrEqual(900);
  });
});

describe('normalizarTexto', () => {
  it('quita caracteres de control y colapsa espacios', () => {
    const nul = String.fromCharCode(0);
    const entrada = `Hola${nul} mundo\r\n\r\n\r\n\r\ncon   espacios\t\t y tabs  \n`;
    expect(normalizarTexto(entrada)).toBe('Hola mundo\n\ncon espacios y tabs');
  });
});

describe('knowledge-auth (helpers compartidos por upload y delete)', () => {
  const peticion = (headers: Record<string, string> = {}) =>
    new Request('https://startidea.es/api/admin/knowledge-upload', { method: 'POST', headers });

  it('origenCoincide acepta sin Origin, el mismo host y x-forwarded-host; rechaza otro host o basura', () => {
    expect(origenCoincide(peticion())).toBe(true);
    expect(origenCoincide(peticion({ origin: 'https://startidea.es' }))).toBe(true);
    expect(origenCoincide(peticion({ origin: 'https://startidea.es', host: 'startidea.es' }))).toBe(true);
    expect(origenCoincide(peticion({ origin: 'https://panel.startidea.es', 'x-forwarded-host': 'panel.startidea.es' }))).toBe(true);
    expect(origenCoincide(peticion({ origin: 'https://evil.example' }))).toBe(false);
    expect(origenCoincide(peticion({ origin: 'no-es-una-url' }))).toBe(false);
  });

  it('dentroDeKnowledge contiene la ruta en EXPEDIENTES_DIR/knowledge y rechaza traversal', () => {
    expect(knowledgeRoot()).toBe(join(root, 'knowledge'));
    expect(dentroDeKnowledge('abc', 'doc.pdf')).toBe(join(root, 'knowledge', 'abc', 'doc.pdf'));
    expect(() => dentroDeKnowledge('..')).toThrow('knowledge_path_outside_root');
    expect(() => dentroDeKnowledge('../otro')).toThrow('knowledge_path_outside_root');
    expect(() => dentroDeKnowledge()).toThrow('knowledge_path_outside_root');
    expect(() => dentroDeKnowledge('/etc/passwd')).toThrow('knowledge_path_outside_root');
  });

  it('fallo() devuelve JSON con status real si se pide JSON, y 303 al panel si no', async () => {
    const api = fallo(peticion({ accept: 'application/json' }), 'demasiado_grande', 413, { max_mb: 40 }, { 'retry-after': '5' });
    expect(api.status).toBe(413);
    expect(api.headers.get('content-type')).toBe('application/json');
    expect(api.headers.get('retry-after')).toBe('5');
    expect(await api.json()).toEqual({ ok: false, error: 'demasiado_grande', max_mb: 40 });

    const navegador = fallo(peticion({ accept: 'text/html,application/xhtml+xml' }), 'sin_content_length', 411);
    expect(navegador.status).toBe(303);
    expect(navegador.headers.get('location')).toBe('/admin/knowledge?error=sin_content_length');
    expect(quiereJson(peticion())).toBe(false);
  });

  it('redirigirPanel codifica subido/errores/detalle en la query', () => {
    const r = redirigirPanel(new URLSearchParams({ subido: '1', errores: '1', detalle: 'a.pdf: sin texto legible · b.exe: extensión no admitida' }));
    expect(r.status).toBe(303);
    const loc = new URL(r.headers.get('location') ?? '', 'https://startidea.es');
    expect(loc.pathname).toBe('/admin/knowledge');
    expect(loc.searchParams.get('subido')).toBe('1');
    expect(loc.searchParams.get('detalle')).toBe('a.pdf: sin texto legible · b.exe: extensión no admitida');
    expect(redirigirPanel(new URLSearchParams()).headers.get('location')).toBe('/admin/knowledge');
  });
});
