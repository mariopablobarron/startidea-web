import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateRadarIdea, toPack } from '../src/lib/radar/generator';
import type { RadarCandidate } from '../src/lib/radar/types';

const pack = {
  resumen_operativo: 'Idea para revisar', titulo_propuesta: 'Propuesta', eje_mensaje: 'Participacion',
  idea_implementable: 'Composicion visual\nTexto inferior', texto_para_publicar: 'Introduccion\n\n## Contexto\n' + 'Contenido del articulo. '.repeat(100),
  call_to_action: 'Comparte tu experiencia', hashtags: ['social'], riesgos: ['Contrastar las cifras'],
  formatos_recomendados: ['articulo'], tono: 'Directo',
};
const candidate = { title: 'DATO_EXTERNO_NO_INSTRUCCION', summary: 'Tema publico', source:'google-trends', evidence:['https://example.org'], tags:[], publishedAt:1789201800, sourceSignal:1000 } as unknown as RadarCandidate;

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('radar generator', () => {
  it('conserva un articulo completo y sus parrafos, normaliza hashtags y rechaza respuestas vacias', () => {
    expect(toPack(pack).texto_para_publicar).toBe(pack.texto_para_publicar.trim());
    expect(toPack(pack).idea_implementable).toContain('\n');
    expect(toPack(pack).hashtags).toEqual(['#social']);
    expect(() => toPack({})).toThrow();
    expect(() => toPack(null)).toThrow();
  });
  it('mantiene datos externos fuera del mensaje de sistema y acota tiempo y salida', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'local-test-only');
    vi.stubEnv('OPENROUTER_RADAR_MAX_TOKENS', '99999');
    const mocked = vi.fn().mockResolvedValue({ ok:true,json:async () => ({choices:[{finish_reason:'stop',message:{content:JSON.stringify(pack)}}]}) });
    vi.stubGlobal('fetch', mocked);
    const result = await generateRadarIdea(candidate,'articulo');
    expect(result.texto_para_publicar).toBe(pack.texto_para_publicar.trim());
    const options = mocked.mock.calls[0][1];
    const body = JSON.parse(options.body);
    expect(body.messages[0].content).not.toContain(candidate.title);
    expect(body.messages[1].content).toContain(candidate.title);
    expect(body.max_tokens).toBe(5000);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('rechaza salida truncada y no propaga cuerpos de error del proveedor', async () => {
    vi.stubEnv('OPENROUTER_API_KEY','local-test-only');
    const mocked = vi.fn().mockResolvedValueOnce({ok:true,json:async () => ({choices:[{finish_reason:'length',message:{content:JSON.stringify(pack)}}]})}).mockResolvedValueOnce({ok:false,status:429,text:async () => 'provider-private-body'});
    vi.stubGlobal('fetch',mocked);
    await expect(generateRadarIdea(candidate,'articulo')).rejects.toThrow('incompleta');
    await expect(generateRadarIdea(candidate,'meme')).rejects.toThrow('OpenRouter HTTP 429');
  });
});
