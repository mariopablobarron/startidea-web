/**
 * plano-charla.ts — el «consejero» del Plano Startidea: la primera reunión
 * con Startidea antes de tener agenda.
 *
 * Conversa como en una llamada de diagnóstico (ver ficha de conocimiento
 * `05-manual-conversacion.md`): una pregunta por turno, reformula, lleva la
 * contraria con respeto, cambia de tema cuando toca y propone servicios,
 * el Lab o un regalo tangible. Salida JSON estricta para que el cliente
 * ilumine el plano y ofrezca el regalo sin parsear prosa.
 *
 * Modelo: Haiku por defecto (`MODELO_CHARLA` para cambiarlo). Sin API key
 * o ante fallo, responde con un guion mínimo basado en patrones para que
 * el hero nunca se quede mudo.
 */
import { getCollection } from 'astro:content';
import { pickModel } from '@/lib/model-router';
import { getEnv } from '@/lib/env';
import { BRAND_CONSTITUTION } from '@/lib/brand-constitution';
import { INTENCIONES, catalogoParaModelo, clasificarPorPatron, getEstacion, getAudiencia } from '@/data/plano';
import { REGALOS, esTipoRegalo } from '@/lib/regalos';
import { contextoDocumentos } from '@/lib/knowledge-db';

export type Msg = { role: 'user' | 'assistant'; content: string };

export interface TurnoCharla {
  reply: string;
  estaciones: string[];
  intencion: string;
  /** Tipo de regalo que el asistente ofrece en este turno ('' si ninguno). */
  regalo: string;
  /** true cuando el asistente ha cerrado con resumen + siguiente paso. */
  cierre: boolean;
  fuente: 'modelo' | 'guion';
}

const MAX_TURNOS_USUARIO = 8;
const SITE_URL = 'https://startidea.es';

let kbCache: string | null = null;
async function conocimiento(): Promise<string> {
  if (kbCache !== null) return kbCache;
  try {
    const entries = await getCollection('knowledge');
    entries.sort((a, b) => a.id.localeCompare(b.id));
    kbCache = entries.map((e) => `\n\n---\n# Fuente: ${e.id}\n\n${e.body}`).join('');
  } catch (err) {
    console.error('[charla] no se pudo leer la knowledge base', err);
    kbCache = '';
  }
  return kbCache;
}

async function systemPrompt(audienciaId: string, turnosUsuario: number, ultimoMensaje = ''): Promise<string> {
  const kb = await conocimiento();
  // Fragmentos de los documentos subidos desde /admin/knowledge, recuperados
  // por petición según el último mensaje (nunca se cachean; nunca lanza).
  const docs = await contextoDocumentos(ultimoMensaje);
  const notaDocs = docs
    ? '\n\nDOCUMENTOS DE APOYO: si usas un fragmento de los documentos de apoyo, dilo con naturalidad ("según la documentación de Startidea…") sin citar nombres de fichero.'
    : '';
  const aud = getAudiencia(audienciaId);
  const regalos = REGALOS.map((r) => `- ${r.id}: ${r.nombre} — ${r.descripcion}`).join('\n');
  const faseCierre = turnosUsuario >= MAX_TURNOS_USUARIO
    ? '\n\nESTE ES EL ÚLTIMO TURNO: cierra con un resumen de tres líneas de lo hablado, el siguiente paso concreto y, si no se ha ofrecido antes, un regalo. Pon "cierre": true.'
    : turnosUsuario >= MAX_TURNOS_USUARIO - 2
      ? '\n\nQuedan pocos turnos: empieza a encaminar hacia el resumen y el siguiente paso.'
      : '';

  return `Eres Lazo, la IA de Startidea y el asistente conversacional del «Plano Startidea» en startidea.es. Te llamas Lazo por los lazos del isotipo de Startidea: lazo = vínculo. Carácter: curioso, directo, cercano, algo contestatario, nunca servil. Conversas como lo haría el fundador de Startidea en una primera llamada de diagnóstico: escuchas, haces UNA pregunta por turno, reformulas el problema cuando hace falta, llevas la contraria con respeto, cambias de tema hacia lo que de verdad mueve y propones lo que no te han pedido. Sigue al pie de la letra la ficha «05-manual-conversacion». Eres una IA y lo dices si te lo preguntan; hablas en primera persona como asistente y de Startidea en tercera persona.
${aud ? `\nLa persona se ha identificado como: ${aud.label}.` : '\nLa persona no ha dicho aún quién es: si no se deduce de lo que cuenta, pregúntalo en tu primera respuesta (empresa, institución, entidad social o proyecto que empieza).'}

FORMA: dos o tres frases, termina en una pregunta salvo en el cierre. Sin listas, sin exclamaciones, sin "genial". Español neutro, tuteo.

PLANO: cuando lo hablado apunte a un servicio, indica hasta 3 estaciones del catálogo en "estaciones" (ids exactos). Si no aplica, [].
Catálogo:
${catalogoParaModelo()}

INTENCIÓN: en "intencion" pon uno de: ${INTENCIONES.map((i) => i.id).join(', ')} o "" si no está claro.

REGALOS: cuando ya sepas quién es y qué quiere mover (nunca en tu primer mensaje), puedes ofrecer UN regalo tangible poniendo su id en "regalo" y mencionándolo con naturalidad en la respuesta ("si quieres, te preparo ahora mismo…"). Solo uno por conversación. Tipos:
${regalos}

SIGUIENTE PASO HUMANO: cuando haya algo que merezca hablarlo con una persona, propón reservar 30 minutos con Mario (el enlace lo pone la web; tú solo lo mencionas).

Responde SOLO con JSON válido, sin texto alrededor:
{"reply":"<tu respuesta>","estaciones":["<id>"],"intencion":"<id o vacío>","regalo":"<id o vacío>","cierre":false}${faseCierre}

=== CONOCIMIENTO DE STARTIDEA ===${kb}
=== FIN CONOCIMIENTO ===${notaDocs}${docs ? `\n\n${docs}` : ''}

${BRAND_CONSTITUTION}`;
}

function limpiar(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : '';
}

/** Guion mínimo cuando no hay modelo: ilumina por patrón y devuelve la pregunta del método. */
function turnoGuion(messages: Msg[], audienciaId: string): TurnoCharla {
  const ultimo = messages[messages.length - 1]?.content ?? '';
  const i = clasificarPorPatron(ultimo);
  const turnos = messages.filter((m) => m.role === 'user').length;
  if (turnos === 1) {
    const quien = getAudiencia(audienciaId) ? '' : ' Antes de nada, ¿desde dónde hablas: una empresa, una institución, una entidad social o un proyecto que empieza?';
    return {
      reply: i ? `${i.say}${quien || ' ¿Cuál es el resultado concreto que mide el éxito en un año?'}` : `Cuéntame un poco más: ¿cuál es el resultado concreto que mide el éxito en un año?${quien}`,
      estaciones: i ? i.estaciones : [],
      intencion: i?.id ?? '',
      regalo: '',
      cierre: false,
      fuente: 'guion',
    };
  }
  const preguntas = [
    '¿Qué decisión está bloqueada ahora mismo y quién tendría que tomarla?',
    '¿Qué recurso tienes y no estás usando: una base de contactos, historias, datos, gente que ya confía en ti?',
  ];
  if (turnos - 2 < preguntas.length) {
    return {
      reply: `Entendido. ${preguntas[turnos - 2]}`,
      estaciones: i ? i.estaciones : [],
      intencion: i?.id ?? '',
      regalo: '',
      cierre: false,
      fuente: 'guion',
    };
  }
  return {
    reply: 'Con esto ya hay materia para una conversación de verdad. Lo honesto es hablarlo treinta minutos con Mario y salir con una ruta clara.',
    estaciones: i ? i.estaciones : [],
    intencion: i?.id ?? '',
    regalo: '',
    cierre: true,
    fuente: 'guion',
  };
}

export async function charlar(messages: Msg[], audienciaId: string): Promise<TurnoCharla> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  const turnosUsuario = messages.filter((m) => m.role === 'user').length;
  if (!apiKey) return turnoGuion(messages, audienciaId);

  const ultimoMensaje = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const system = await systemPrompt(audienciaId, turnosUsuario, ultimoMensaje);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': 'Startidea Plano · charla',
      },
      body: JSON.stringify({
        model: getEnv('MODELO_CHARLA') || pickModel('default'),
        messages: [{ role: 'system', content: system }, ...messages.slice(-16)],
        max_tokens: 500,
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      console.error('[charla] upstream', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return turnoGuion(messages, audienciaId);
    }
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return turnoGuion(messages, audienciaId);
    const p = JSON.parse(m[0]) as Record<string, unknown>;
    const reply = limpiar(p.reply, 1200);
    if (!reply) return turnoGuion(messages, audienciaId);
    const estaciones = Array.isArray(p.estaciones)
      ? (p.estaciones as unknown[]).filter((id): id is string => typeof id === 'string' && !!getEstacion(id)).slice(0, 3)
      : [];
    const intencion = limpiar(p.intencion, 40);
    const regaloRaw = limpiar(p.regalo, 40);
    return {
      reply,
      estaciones,
      intencion: INTENCIONES.some((i) => i.id === intencion) ? intencion : '',
      regalo: esTipoRegalo(regaloRaw) ? regaloRaw : '',
      cierre: p.cierre === true || turnosUsuario >= MAX_TURNOS_USUARIO,
      fuente: 'modelo',
    };
  } catch (err) {
    console.error('[charla] modelo falló', err);
    return turnoGuion(messages, audienciaId);
  } finally {
    clearTimeout(timer);
  }
}

export function sanitizarHistorial(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) return [];
  const out: Msg[] = [];
  for (const m of raw.slice(-20)) {
    if (typeof m !== 'object' || m === null) continue;
    const role = (m as { role?: unknown }).role;
    const content = limpiar((m as { content?: unknown }).content, 2000);
    if ((role === 'user' || role === 'assistant') && content) out.push({ role, content });
  }
  return out;
}

export { MAX_TURNOS_USUARIO };
