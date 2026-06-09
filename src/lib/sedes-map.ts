/**
 * src/lib/sedes-map.ts
 *
 * Mapeo de organismos convocantes a sus sedes electrónicas.
 * Usado por generar-expediente.ts para mejorar la guía de presentación.
 *
 * Para cada sede se incluye:
 *   - url: URL directa de acceso a la sede
 *   - tramiteHint: cómo localizar el trámite (texto descriptivo)
 *   - autofirmaRequired: si la sede requiere Autofirma o tiene firma nativa
 *   - notasEspeciales: consideraciones importantes para esta sede
 */

export interface SedeInfo {
  nombre: string;
  url: string;
  urlTramite?: string;
  tramiteHint: string;
  autofirmaRequired: boolean;
  notasEspeciales?: string;
  /** Clave del driver de tramitación asistida (container copiloto-sede). Solo
   *  las sedes con driver implementado la tienen. Sin key → no hay automatización. */
  key?: string;
}

// Patrones de detección: [patrón en URL o nombre organismo, SedeInfo]
const SEDES: Array<{ patterns: string[]; sede: SedeInfo }> = [
  {
    patterns: [
      'juntadeandalucia', 'junta de andaluc', 'trade',
      'consejeria', 'consejer', 'idae andaluc', 'feder',
    ],
    sede: {
      key: 'junta-andalucia',
      nombre: 'Junta de Andalucía',
      url: 'https://www.juntadeandalucia.es/servicios/procedimientos.html',
      urlTramite: 'https://www.juntadeandalucia.es/servicios/procedimientos.html',
      tramiteHint: `Accede al Catálogo de Procedimientos y Servicios de la Junta en https://www.juntadeandalucia.es/servicios/procedimientos.html y busca el trámite escribiendo en el buscador las palabras clave del título de la convocatoria (puedes filtrar por "Sólo abiertos"). Desde la ficha del procedimiento accedes a la presentación telemática en la sede.`,
      autofirmaRequired: true,
      notasEspeciales: `En la sede de la Junta de Andalucía: (1) Necesitas Autofirma instalado y configurado antes de acceder. (2) El certificado digital debe estar emitido por FNMT o CatCert. (3) Cuando el formulario pida "Memoria del proyecto", adjunta el fichero en PDF con el nombre normalizado (sin acentos, sin espacios). (4) La mayoría de trámites TRADE tienen un plazo de firma de 2 horas desde la generación del borrador — no dejes la firma para el último momento. (5) Guarda el justificante CSV inmediatamente después de presentar.`,
    },
  },
  {
    patterns: [
      'derechossociales', 'servicios sociales', 'inclusion social',
      'mscbs', 'imserso', 'irpf', 'plan estatal ong',
      'plan estatal de ong', '0,7', 'cero punto siete',
    ],
    sede: {
      nombre: 'Ministerio de Derechos Sociales e Inclusión',
      url: 'https://sede.serviciosocialesinclusión.gob.es/',
      tramiteHint: `Accede a https://sede.serviciosocialesinclusión.gob.es/ con certificado digital. El trámite se llama normalmente "Subvenciones para proyectos de acción social" o similar. En el menú lateral busca "Convocatorias" → "Abiertas".`,
      autofirmaRequired: true,
      notasEspeciales: `La sede del Ministerio usa Autofirma para la firma. Tras presentar recibirás un Registro de Entrada (RE/…) y un código CSV. Guarda ambos. El plazo de subsanación si te falta documentación suele ser 10 días hábiles desde la notificación en la carpeta ciudadana.`,
    },
  },
  {
    patterns: [
      'ministerio de cultura', 'cultura.gob', 'inaem', 'secc',
      'subvenciones culturales',
    ],
    sede: {
      nombre: 'Ministerio de Cultura',
      url: 'https://sede.cultura.gob.es/',
      tramiteHint: `Accede a https://sede.cultura.gob.es/ y busca el trámite en "Trámites y servicios" → "Subvenciones". Las convocatorias se clasifican por área (música, artes escénicas, patrimonio, libro...).`,
      autofirmaRequired: true,
    },
  },
  {
    patterns: [
      'sepe', 'servicio publico de empleo', 'empleo estatal',
      'fpe', 'formacion profesional para el empleo',
    ],
    sede: {
      nombre: 'SEPE — Servicio Público de Empleo Estatal',
      url: 'https://sede.sepe.gob.es/',
      tramiteHint: `Accede a https://sede.sepe.gob.es/ y localiza la convocatoria en "Empresas y autónomos" → "Subvenciones para formación". El representante debe tener certificado de representante de persona jurídica.`,
      autofirmaRequired: true,
    },
  },
  {
    patterns: [
      'ministerio de ciencia', 'cdti', 'innpacto', 'neotec',
      'cervera', 'agencia estatal investigacion',
    ],
    sede: {
      nombre: 'CDTI — Centro para el Desarrollo Tecnológico y la Innovación',
      url: 'https://sede.cdti.gob.es/',
      tramiteHint: `Accede a https://sede.cdti.gob.es/. La mayoría de convocatorias CDTI tienen formulario de preconsulta antes de la solicitud formal. Revisa si la convocatoria exige presentación previa de EOI (Expresión de Interés).`,
      autofirmaRequired: true,
      notasEspeciales: `Las solicitudes CDTI suelen requerir el informe de viabilidad técnica y el plan de empresa. Estos documentos van en PDF separados. El formulario de solicitud se envía antes del plazo de solicitud, pero la documentación técnica puede añadirse en el plazo de subsanación.`,
    },
  },
  {
    patterns: [
      'diputacion de granada', 'diputacion granada',
      'ayuntamiento de granada', 'ayuntamiento granada',
    ],
    sede: {
      nombre: 'Diputación / Ayuntamiento de Granada',
      url: 'https://sedeelectronica.dipgra.es/',
      tramiteHint: `Para la Diputación: accede a https://sedeelectronica.dipgra.es/ y busca el trámite por su convocatoria. Para el Ayuntamiento de Granada: accede a https://sede.granada.org/. En ambos casos necesitas certificado digital y Autofirma.`,
      autofirmaRequired: true,
    },
  },
  {
    patterns: [
      'infosubvenciones', 'bdns', 'base de datos nacional de subvenciones',
    ],
    sede: {
      nombre: 'BDNS / infosubvenciones.es',
      url: 'https://www.infosubvenciones.es/',
      tramiteHint: `BDNS es el portal de consulta pero la solicitud se realiza en la sede electrónica del organismo convocante. Busca la convocatoria en https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/ con el código BDNS y accede al enlace "Solicitar" que redirige a la sede correspondiente.`,
      autofirmaRequired: false,
      notasEspeciales: `BDNS no es una sede de presentación sino un registro. La presentación real se hace en la sede del organismo convocante. El código BDNS de la convocatoria permite localizar el enlace exacto de presentación.`,
    },
  },
];

/**
 * Detecta la sede electrónica a partir de la URL de convocatoria o el nombre del organismo.
 * Devuelve null si no hay match en los patrones conocidos.
 */
export function detectSede(opts: {
  convocatoriaUrl?: string | null;
  organismo?: string | null;
  convocatoriaTitle?: string | null;
}): SedeInfo | null {
  const haystack = [
    opts.convocatoriaUrl ?? '',
    opts.organismo ?? '',
    opts.convocatoriaTitle ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quitar acentos para matching

  for (const { patterns, sede } of SEDES) {
    if (patterns.some((p) => haystack.includes(p.toLowerCase()))) {
      return sede;
    }
  }

  return null;
}

/**
 * Genera el bloque de contexto de sede para incluir en el prompt de la IA.
 */
export function sedeContextoPrompt(sede: SedeInfo): string {
  const lines = [
    `SEDE ELECTRÓNICA DETECTADA: ${sede.nombre}`,
    `URL SEDE: ${sede.url}`,
    sede.urlTramite ? `URL TRÁMITE: ${sede.urlTramite}` : '',
    `CÓMO LOCALIZAR EL TRÁMITE: ${sede.tramiteHint}`,
    `REQUIERE AUTOFIRMA: ${sede.autofirmaRequired ? 'Sí' : 'No (firma nativa en sede)'}`,
    sede.notasEspeciales ? `NOTAS ESPECIALES PARA ESTA SEDE:\n${sede.notasEspeciales}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `\n\n--- INFORMACIÓN DE LA SEDE ELECTRÓNICA ---\n${lines}\n--- FIN INFORMACIÓN SEDE ---\n`;
}
