/**
 * knowledge-extract.ts — extracción de texto y troceado para «Entrenar a Lazo».
 *
 * Convierte los documentos que sube el admin (PDF, DOCX, TXT, MD, CSV, XLSX)
 * en texto plano normalizado y lo parte en trozos solapados para indexarlos
 * en knowledge.db (ver knowledge-db.ts).
 *
 * pdf-parse y xlsx se cargan con createRequire (mismo patrón que
 * doc-extractor.ts): son paquetes CommonJS y el import ESM de pdf-parse
 * rompe en el bundle SSR de Astro. mammoth (DOCX) sigue el mismo camino.
 */
import { createRequire } from 'node:module';
import { extractPdf } from '@/lib/doc-extractor';

const _require = createRequire(import.meta.url);

/** Tope de caracteres por documento (≈ 330 trozos de 900). */
export const MAX_CHARS_DOC = 300_000;

/** Extensiones que sabemos leer. Con punto y en minúsculas. */
export const EXTENSIONES_SOPORTADAS = ['.pdf', '.docx', '.txt', '.md', '.csv', '.xlsx', '.xls'] as const;

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = _require('mammoth') as typeof import('mammoth');
    const r = await mammoth.extractRawText({ buffer });
    return r.value ?? '';
  } catch (err) {
    console.warn('[knowledge-extract] error leyendo DOCX:', err instanceof Error ? err.message : err);
    return '';
  }
}

/** Copia del patrón de doc-extractor.ts: máximo 3 hojas, cada una como CSV. */
async function extractExcel(buffer: Buffer): Promise<string> {
  try {
    const XLSX = _require('xlsx') as typeof import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 3)) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false } as Parameters<typeof XLSX.utils.sheet_to_csv>[1]);
      if (csv.trim()) {
        lines.push(`[Hoja: ${sheetName}]`);
        lines.push(csv.trim());
      }
    }
    return lines.join('\n');
  } catch (err) {
    console.warn('[knowledge-extract] error leyendo Excel:', err instanceof Error ? err.message : err);
    return '';
  }
}

/** Normaliza saltos y espacios, quita caracteres de control y aplica el tope. */
export function normalizarTexto(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    // Caracteres de control (salvo \n y \t): rompen FTS y no aportan nada.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t\u00A0]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS_DOC);
}

/**
 * Texto plano de un buffer según su extensión ('.pdf' o 'pdf', da igual).
 * Devuelve '' si el formato no se soporta o no hay texto legible
 * (p. ej. un PDF escaneado sin capa OCR).
 */
export async function extractText(buffer: Buffer, ext: string): Promise<string> {
  const e = (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase();
  let raw = '';
  switch (e) {
    case '.pdf':
      raw = await extractPdf(buffer);
      break;
    case '.docx':
      raw = await extractDocx(buffer);
      break;
    case '.txt':
    case '.md':
    case '.csv':
      raw = buffer.toString('utf-8');
      break;
    case '.xlsx':
    case '.xls':
      raw = await extractExcel(buffer);
      break;
    default:
      return '';
  }
  return normalizarTexto(raw);
}

/** Posición (absoluta) justo después del último match de `re` dentro de [desde, hasta); -1 si no hay. */
function ultimoCorte(texto: string, desde: number, hasta: number, re: RegExp): number {
  const ventana = texto.slice(desde, hasta);
  let pos = -1;
  for (const m of ventana.matchAll(re)) pos = (m.index ?? 0) + m[0].length;
  return pos === -1 ? -1 : desde + pos;
}

/**
 * Parte el texto en trozos de ≈`tam` caracteres con `solape` de contexto entre
 * trozos consecutivos. Corta por párrafo, luego por frase, luego por línea,
 * luego por palabra; solo troncha una palabra si no hay ningún espacio en la
 * segunda mitad de la ventana. Ningún trozo supera `tam` caracteres.
 */
export function trocear(texto: string, opts: { tam?: number; solape?: number } = {}): string[] {
  const tam = Math.max(100, opts.tam ?? 900);
  const solape = Math.min(Math.max(0, opts.solape ?? 150), Math.floor(tam / 2));
  const t = texto.trim();
  if (!t) return [];
  if (t.length <= tam) return [t];

  const SEPARADORES = [/\n\s*\n/g, /[.!?…]["»)]?\s/g, /\n/g, /\s/g];
  const trozos: string[] = [];
  let inicio = 0;
  while (inicio < t.length) {
    let fin = Math.min(inicio + tam, t.length);
    if (fin < t.length) {
      // Solo aceptamos cortes en la segunda mitad de la ventana para no
      // generar trozos minúsculos.
      const minimo = inicio + Math.floor(tam / 2);
      for (const re of SEPARADORES) {
        const corte = ultimoCorte(t, minimo, fin, re);
        if (corte > inicio) { fin = corte; break; }
      }
    }
    const trozo = t.slice(inicio, fin).trim();
    if (trozo) trozos.push(trozo);
    if (fin >= t.length) break;

    // Siguiente inicio: retrocede `solape` y avanza hasta el primer espacio
    // para no empezar a mitad de palabra. Siempre progresa.
    let siguiente = Math.max(fin - solape, inicio + 1);
    const espacio = t.slice(siguiente, fin).search(/\s/);
    if (espacio >= 0) siguiente += espacio + 1;
    if (siguiente <= inicio || siguiente > fin) siguiente = fin;
    inicio = siguiente;
  }
  return trozos;
}
