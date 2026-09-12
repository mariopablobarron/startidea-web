/**
 * Tipos del radar de tendencias de Startidea.
 *
 * Objetivo:
 * - Detectar temas en bruto con señales de viralidad.
 * - Guardarlos en BD con scoring.
 * - Convertirlos en propuesta accionable (meme/artículo/contenido) con IA.
 */

export type RadarSource = 'google-trends' | 'reddit';

export type RadarStatus =
  | 'detectada'
  | 'validada'
  | 'descartada'
  | 'generando'
  | 'lista'
  | 'publicada';

export type RadarFocus = 'meme' | 'articulo' | 'contenido';

export interface RadarCandidateInput {
  source: RadarSource;
  sourceItemId: string;
  sourceUrl: string | null;
  title: string;
  summary: string;
  tags: string[];
  evidence: string[];
  sourceSignal: number;
  viralityScore: number;
  relevanceScore: number;
  topic: string | null;
  publishedAt: number | null;
}

export interface RadarAiPack {
  resumen_operativo: string;
  titulo_propuesta: string;
  eje_mensaje: string;
  idea_implementable: string;
  texto_para_publicar: string;
  call_to_action: string;
  hashtags: string[];
  riesgos: string[];
  formatos_recomendados: string[];
  tono: string;
}

export interface RadarCandidate extends RadarCandidateInput {
  id: string;
  status: RadarStatus;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  reviewedAt: number | null;
  aiLastFocus: RadarFocus | null;
  aiPack: RadarAiPack | null;
  aiGeneratedAt: number | null;
  previousSignal: number | null;
  previousSeenAt: number | null;
  generationStartedAt: number | null;
}

export interface RadarCollection {
  candidates: RadarCandidateInput[];
  sources: Array<{ source: RadarSource; ok: boolean; count: number; error?: string }>;
}

export interface RadarStats {
  total: number;
  detectada: number;
  validada: number;
  descartada: number;
  generando: number;
  lista: number;
  publicada: number;
  bySource: Record<RadarSource | 'total', number>;
}
