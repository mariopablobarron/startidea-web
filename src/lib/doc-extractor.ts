/**
 * doc-extractor.ts
 *
 * Extrae texto legible de los documentos que el cliente sube con su expediente.
 * Soporta: PDF, Excel (.xlsx, .xls), CSV, TXT.
 *
 * El texto extraído se añade como contexto adicional al prompt de generación IA,
 * permitiendo que el modelo use información real de la organización
 * (memorias anteriores, estatutos, presupuestos pasados, etc.).
 *
 * Se invoca desde /api/generar-expediente antes de llamar a runAiGeneration.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

// ─── Límites ──────────────────────────────────────────────────────────────────

/** Máximo de caracteres por documento individual (evitar contexto excesivo) */
const MAX_CHARS_PER_DOC = 4000;

/** Máximo total de caracteres sumados de todos los documentos */
const MAX_TOTAL_CHARS = 10000;

/** Tamaño máximo de archivo a procesar (5 MB) */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ExtractedDoc {
  fileName: string;    // nombre original del archivo
  fieldName: string;   // campo del formulario (docMemoria, docEstatutos, etc.)
  mimeHint: string;    // tipo detectado (pdf, excel, csv, txt)
  chars: number;       // caracteres extraídos
  text: string;        // texto extraído (truncado a MAX_CHARS_PER_DOC)
}

export interface ExtractionResult {
  docs: ExtractedDoc[];
  totalChars: number;
  errors: string[];
}

// ─── Etiquetas legibles por campo ─────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  docMemoriaAnual: 'Memoria de actividades anual',
  docEstatutos:    'Estatutos de la organización',
  docMemoria:      'Borrador de memoria técnica del proyecto',
  docPresupuesto:  'Presupuesto existente',
  docOtros:        'Documentación adicional',
  docHacienda:     'Certificado AEAT',
  docSS:           'Certificado Seguridad Social',
};

// ─── Extractores por tipo ─────────────────────────────────────────────────────

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse v1 exporta directamente una función (pdf-parse/lib/pdf-parse.js)
    // Usamos createRequire para compatibilidad con ESM de Astro
    type PdfParseFunc = (buf: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number }>;
    const pdfParse = _require('pdf-parse') as PdfParseFunc;
    const data = await pdfParse(buffer, { max: 0 });
    return data.text ?? '';
  } catch (err) {
    console.warn('[doc-extractor] Error parsing PDF:', err instanceof Error ? err.message : err);
    return '';
  }
}

async function extractExcel(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    console.warn('[doc-extractor] Error parsing Excel:', err instanceof Error ? err.message : err);
    return '';
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Lee todos los archivos guardados en el directorio del expediente y extrae texto.
 * Solo procesa archivos con extensiones útiles (PDF, Excel, CSV, TXT).
 * Los certificados (AEAT, SS) se incluyen solo para confirmar que existen.
 *
 * @param expedienteDir  Ruta al directorio del expediente en el servidor
 * @returns Objeto con docs extraídos, total de caracteres y errores
 */
export async function extractDocsFromExpediente(expedienteDir: string): Promise<ExtractionResult> {
  const result: ExtractionResult = { docs: [], totalChars: 0, errors: [] };

  let files: string[];
  try {
    files = await readdir(expedienteDir);
  } catch {
    // El directorio puede no existir si no se adjuntaron docs
    return result;
  }

  // Filtrar solo archivos con extensiones procesables y orden de prioridad
  const PRIORITY_ORDER = ['docMemoriaAnual', 'docEstatutos', 'docMemoria', 'docPresupuesto', 'docOtros', 'docHacienda', 'docSS'];
  const processable = files
    .filter((f) => {
      const ext = extname(f).toLowerCase();
      return ['.pdf', '.xlsx', '.xls', '.csv', '.txt'].includes(ext);
    })
    .sort((a, b) => {
      const ai = PRIORITY_ORDER.findIndex((p) => a.startsWith(p));
      const bi = PRIORITY_ORDER.findIndex((p) => b.startsWith(p));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  for (const fileName of processable) {
    if (result.totalChars >= MAX_TOTAL_CHARS) break;

    const filePath = join(expedienteDir, fileName);
    const ext = extname(fileName).toLowerCase();

    // Detectar campo original del formulario
    const fieldName = PRIORITY_ORDER.find((p) => fileName.startsWith(p)) ?? 'otro';

    try {
      const fileStat = await stat(filePath);
      if (fileStat.size > MAX_FILE_BYTES) {
        result.errors.push(`${fileName}: demasiado grande (${(fileStat.size / 1024 / 1024).toFixed(1)} MB)`);
        continue;
      }

      const buffer = await readFile(filePath);
      let rawText = '';

      if (ext === '.pdf') {
        rawText = await extractPdf(buffer);
      } else if (ext === '.xlsx' || ext === '.xls') {
        rawText = await extractExcel(buffer);
      } else if (ext === '.csv' || ext === '.txt') {
        rawText = buffer.toString('utf-8');
      }

      // Limpiar y truncar
      const clean = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')   // colapsar líneas vacías múltiples
        .replace(/[ \t]{4,}/g, '   ') // colapsar espacios excesivos
        .trim();

      if (!clean) continue;

      const truncated = clean.slice(0, MAX_CHARS_PER_DOC);

      result.docs.push({
        fileName,
        fieldName,
        mimeHint: ext.slice(1),
        chars: truncated.length,
        text: truncated,
      });
      result.totalChars += truncated.length;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${fileName}: ${msg}`);
    }
  }

  return result;
}

/**
 * Formatea el resultado de la extracción para incluirlo en el prompt IA.
 * Devuelve un bloque de texto bien estructurado o string vacío si no hay docs.
 */
export function formatExtractedDocsForPrompt(extraction: ExtractionResult): string {
  if (!extraction.docs.length) return '';

  const parts: string[] = [
    '---',
    'DOCUMENTOS APORTADOS POR LA ORGANIZACIÓN (usa esta información para enriquecer los documentos):',
  ];

  for (const doc of extraction.docs) {
    const label = FIELD_LABELS[doc.fieldName] ?? doc.fieldName;
    const truncMark = doc.chars >= MAX_CHARS_PER_DOC ? '\n[... texto truncado ...]' : '';
    parts.push(`\n[${label} — ${doc.fileName}]\n${doc.text}${truncMark}`);
  }

  if (extraction.errors.length) {
    parts.push(`\n[Nota: No se pudo extraer texto de: ${extraction.errors.join(', ')}]`);
  }

  return parts.join('\n');
}
