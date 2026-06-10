/**
 * brand-constitution.ts — Constitutional AI de Startidea.
 *
 * Reglas editoriales y de cumplimiento que TODO texto generado por IA debe
 * respetar (patrón Constitutional AI de all-agentic-architectures).
 * Centralizadas aquí para reutilizarlas en cualquier agente: copiloto de
 * subvenciones, redactor SEO, chat, emails, etc.
 *
 * Dos formas de usarlas:
 *  - BRAND_CONSTITUTION: el texto de reglas, para inyectar en el system prompt
 *    de un agente que ya hace una llamada (coste cero extra). Así lo usa el
 *    copiloto en su generación y en su reflexión.
 *  - enforceConstitution(): pasada independiente que revisa y corrige un texto
 *    ya generado (para agentes sin paso propio de revisión). Coste: +1 llamada.
 */

export const BRAND_CONSTITUTION = `CONSTITUCIÓN DE MARCA STARTIDEA — reglas OBLIGATORIAS para cualquier texto:
1. Español neutro siempre. NUNCA uses "nosotros" ni "nosotras": di "Startidea" como sujeto, o reformula en pasiva/impersonal ("se ofrece", "el equipo de Startidea acompaña").
2. NUNCA prometas ni des por hecho que la subvención/ayuda se concederá. Habla de "preparar y optimizar la solicitud" o "maximizar las opciones", nunca de garantizar la concesión.
3. ASE significa "Acción Social Empresarial" (NO "Asociación Sectorial de Comunicación Eclesial").
4. Tono directo y editorial: frases cortas, sin clickbait, sin jerga vacía. Evita palabras como "engagement", "sinergia"/"sinergias", "disrupción", "ecosistema" como muletilla.
5. Las tres audiencias de Startidea son: tercer sector, instituciones (incluidas las eclesiales) y empresas con propósito. No excluyas a ninguna al generalizar.
6. No inventes datos: si falta un dato concreto, déjalo como [COMPLETAR: ...] en lugar de rellenarlo.`;

/**
 * Pasada de "constitución": reescribe un texto ya generado para que cumpla las
 * reglas, sin cambiar su significado, estructura ni datos. Es una mejora, nunca
 * un bloqueo: ante error/timeout o respuesta sospechosamente corta devuelve el
 * texto original intacto.
 */
export async function enforceConstitution(
  openrouterKey: string,
  texto: string,
): Promise<string> {
  if (!openrouterKey || !texto || texto.trim().length < 20) return texto;

  const system = `Eres el editor de estilo de Startidea. Reescribe el texto que te paso para que cumpla ESTRICTAMENTE la constitución de marca, SIN cambiar su significado, su estructura ni sus datos (conserva cifras, listas, formato Markdown y las marcas [COMPLETAR]). Corrige únicamente lo que infrinja las reglas. Responde SOLO con el texto corregido, sin comentarios ni preámbulo.

${BRAND_CONSTITUTION}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://startidea.es',
        'X-Title': 'Startidea — constitución de marca',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: texto },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn('[constitucion] HTTP', res.status, '— conservo original');
      return texto;
    }
    const json = await res.json();
    const out = (json.choices?.[0]?.message?.content ?? '').trim();
    if (out.length < texto.length * 0.5) {
      console.warn('[constitucion] salida demasiado corta — conservo original');
      return texto;
    }
    return out;
  } catch (err) {
    console.warn('[constitucion] error — conservo original:', err);
    return texto;
  }
}
