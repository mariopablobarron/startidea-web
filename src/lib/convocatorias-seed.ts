/**
 * convocatorias-seed.ts
 *
 * Datos iniciales de las 7 convocatorias BOJA 2026 de inclusión social.
 * Se insertan automáticamente en la BD la primera vez que se inicializa,
 * usando INSERT OR IGNORE para ser idempotente.
 */

export interface ConvocatoriaSeed {
  slug: string;
  codigo: string;
  titulo: string;
  titulo_full: string;
  organo: string;
  tipo_beneficiario: string;  // 'privada' | 'local' | 'empresa' | 'mixto'
  beneficiario_label: string;
  deadline: string;
  deadline_short: string;
  deadline_note: string | null;
  deadline_iso: string | null;  // YYYY-MM-DD
  importe_min: number | null;
  importe_max: number | null;
  importe_range: string;
  importe_detalle: string;
  tipo_entidades: string;
  financia_resumen: string[];  // 3 bullets para la tarjeta
  gastos_ok: string[];
  gastos_no: string[];
  requisitos: string[];
  nota: string | null;
  url_boja: string | null;
  url_bases: string | null;
  url_sede: string | null;
  fuente: string;
  fuente_id: string | null;
  activa: number;
  destacada: number;
}

export const CONVOCATORIAS_SEED: ConvocatoriaSeed[] = [
  /* ── Tercer sector / entidades privadas ───────────────── */
  {
    slug: 'boja-2026-inclusion-l10',
    codigo: 'L10',
    titulo: 'Mantenimiento de entidades privadas de acción social',
    titulo_full: 'BOJA 2026 — L10: Mantenimiento de entidades privadas de acción social (Junta de Andalucía)',
    organo: 'Junta de Andalucía — Consejería de Inclusión Social',
    tipo_beneficiario: 'privada',
    beneficiario_label: 'Asociaciones, fundaciones y entidades religiosas de acción social',
    deadline: '16 de junio de 2026',
    deadline_short: '16 jun',
    deadline_note: null,
    deadline_iso: '2026-06-16',
    importe_min: 3000,
    importe_max: 80000,
    importe_range: '3.000 € – 80.000 €',
    importe_detalle: 'Sin límite máximo fijado en bases. Depende del presupuesto real de la entidad y de los créditos disponibles. En ediciones anteriores: entre 3.000 € y 80.000 €, con la mayoría de concesiones entre 8.000 € y 35.000 €.',
    tipo_entidades: 'Entidades privadas sin ánimo de lucro con actividad de acción social en Andalucía: asociaciones (CIF G), fundaciones (F/G), entidades religiosas (R) y similares.',
    financia_resumen: [
      'Alquiler de locales e instalaciones donde se presta el servicio',
      'Nóminas del personal de gestión y administración de la entidad',
      'Suministros, seguros y mantenimiento ordinario',
    ],
    gastos_ok: [
      'Arrendamiento de locales e instalaciones',
      'Suministros (luz, agua, gas, teléfono, internet)',
      'Nóminas del personal de gestión y administración',
      'Seguros, mantenimiento y reparaciones ordinarias',
      'Material de oficina, gestoría, auditoría y otros gastos generales de funcionamiento',
    ],
    gastos_no: [
      'Inversiones en inmuebles, equipamiento o vehículos',
      'Gastos directos de proyectos o programas concretos (esos van a la línea L11)',
      'Amortizaciones sobre bienes inmuebles propios',
    ],
    requisitos: [
      'Inscripción en el Registro de Entidades de Servicios Sociales de la Junta de Andalucía',
      'CIF activo y al corriente de obligaciones con AEAT y TGSS',
      'Actividad de acción social continuada en Andalucía (no puntual)',
      'Presentación de memoria de actividades del ejercicio anterior',
    ],
    nota: null,
    url_boja: null,
    url_bases: null,
    url_sede: null,
    fuente: 'boja',
    fuente_id: 'BOJA-2026-L10',
    activa: 1,
    destacada: 1,
  },
  {
    slug: 'boja-2026-inclusion-l11',
    codigo: 'L11',
    titulo: 'Programas de acción social para entidades privadas',
    titulo_full: 'BOJA 2026 — L11: Programas de acción social para entidades privadas (Junta de Andalucía)',
    organo: 'Junta de Andalucía — Consejería de Inclusión Social',
    tipo_beneficiario: 'privada',
    beneficiario_label: 'Asociaciones, fundaciones y entidades religiosas de acción social',
    deadline: '16 de junio de 2026',
    deadline_short: '16 jun',
    deadline_note: null,
    deadline_iso: '2026-06-16',
    importe_min: 5000,
    importe_max: 120000,
    importe_range: '5.000 € – 120.000 €',
    importe_detalle: 'Sin límite máximo fijado. Depende del presupuesto del programa y la dotación disponible. En ediciones anteriores: entre 5.000 € y 120.000 €. Los programas con mayor alcance territorial y número de beneficiarios suelen obtener más.',
    tipo_entidades: 'Entidades privadas sin ánimo de lucro con programas de acción social en Andalucía: asociaciones (CIF G), fundaciones (F/G), entidades religiosas (R) y similares.',
    financia_resumen: [
      'Personal de intervención directa del programa (educadores, trabajadores sociales…)',
      'Materiales, actividades y talleres con los beneficiarios del proyecto',
      'Desplazamientos, difusión y gastos directos del programa',
    ],
    gastos_ok: [
      'Personal de intervención directa: educadores, trabajadores sociales, psicólogos, auxiliares…',
      'Material didáctico, consumibles y recursos específicos del programa',
      'Actividades, talleres y acciones directas con los beneficiarios',
      'Dietas y desplazamientos del personal del proyecto',
      'Difusión y comunicación del programa',
    ],
    gastos_no: [
      'Gastos estructurales o de administración de la entidad (arrendamiento, administración… → van a L10)',
      'Obra civil o adquisición de inmuebles',
      'Actividades ya financiadas por otras subvenciones públicas incompatibles',
    ],
    requisitos: [
      'Inscripción en el Registro de Entidades de Servicios Sociales de la Junta de Andalucía',
      'CIF activo y al corriente de AEAT y TGSS',
      'El programa debe atender a personas en situación de vulnerabilidad en Andalucía',
      'Memoria descriptiva del programa: objetivos, metodología, cronograma e indicadores de evaluación',
    ],
    nota: null,
    url_boja: null,
    url_bases: null,
    url_sede: null,
    fuente: 'boja',
    fuente_id: 'BOJA-2026-L11',
    activa: 1,
    destacada: 1,
  },
  {
    slug: 'boja-2026-inclusion-l7',
    codigo: 'L7',
    titulo: 'Solidaridad y Garantía Alimentaria de Andalucía',
    titulo_full: 'BOJA 2026 — L7: Solidaridad y Garantía Alimentaria de Andalucía (Junta de Andalucía)',
    organo: 'Junta de Andalucía — Consejería de Inclusión Social',
    tipo_beneficiario: 'privada',
    beneficiario_label: 'Entidades privadas con programas alimentarios o escuelas de verano',
    deadline: '16 de junio de 2026 (Mod. 2 Escuelas de verano: 2 de junio)',
    deadline_short: '2–16 jun',
    deadline_note: 'Mod. 2 Escuelas de verano: cierra el 2 de junio',
    deadline_iso: '2026-06-16',
    importe_min: null,
    importe_max: null,
    importe_range: 'Variable por modalidad y plaza',
    importe_detalle: 'Variable según la modalidad y el crédito disponible en la convocatoria. La Modalidad 2 tiende a financiarse por plaza de menor atendida. Contacta con Startidea para orientación personalizada.',
    tipo_entidades: 'Entidades privadas sin ánimo de lucro con programas de solidaridad alimentaria (Modalidad 1) o escuelas de verano para menores en zonas desfavorecidas (Modalidad 2) en Andalucía.',
    financia_resumen: [
      'Mod. 1 — Emergencia alimentaria: alimentos, distribución, logística y personal',
      'Mod. 2 — Escuelas de verano: monitores, transporte, material lúdico y comedor para menores',
      'Coordinación y seguimiento del programa',
    ],
    gastos_ok: [
      'Mod. 1: Adquisición de alimentos, logística, almacenamiento y personal de distribución',
      'Mod. 2: Monitores y personal de atención, transporte, material educativo/lúdico, comedor',
      'Coordinación del programa, seguimiento y gastos de gestión directa',
    ],
    gastos_no: [
      'Gastos de administración general de la entidad',
      'Equipamiento permanente o inversiones en instalaciones',
    ],
    requisitos: [
      'Inscripción en el Registro de Entidades de Servicios Sociales de la Junta de Andalucía',
      'Al corriente de AEAT y TGSS',
      'Experiencia acreditada en programas alimentarios o en actividades con menores',
    ],
    nota: '⚠️ La Modalidad 2 (Escuelas de verano para menores) cierra el 2 de junio de 2026. El resto de modalidades, el 16 de junio.',
    url_boja: null,
    url_bases: null,
    url_sede: null,
    fuente: 'boja',
    fuente_id: 'BOJA-2026-L7',
    activa: 1,
    destacada: 0,
  },
  {
    slug: 'boja-2026-inclusion-l16',
    codigo: 'L16',
    titulo: 'Atención a mujeres jóvenes del sistema de protección de menores',
    titulo_full: 'BOJA 2026 — L16: Atención integral a mujeres jóvenes procedentes del sistema de protección de menores (Junta de Andalucía)',
    organo: 'Junta de Andalucía — Consejería de Inclusión Social',
    tipo_beneficiario: 'privada',
    beneficiario_label: 'Entidades privadas con programas de atención a jóvenes ex-tuteladas',
    deadline: '16 de junio de 2026',
    deadline_short: '16 jun',
    deadline_note: null,
    deadline_iso: '2026-06-16',
    importe_min: null,
    importe_max: null,
    importe_range: 'Variable según proyecto',
    importe_detalle: 'Variable según el presupuesto del programa y la dotación disponible. La línea es específica (menos solicitada), lo que puede beneficiar el porcentaje de concesión.',
    tipo_entidades: 'Entidades privadas sin ánimo de lucro con programas específicos de atención integral a mujeres jóvenes ex-tuteladas (procedentes del sistema de protección de menores) en Andalucía.',
    financia_resumen: [
      'Personal de acompañamiento: educadores, psicólogos, trabajadores sociales',
      'Acciones de inserción laboral, formativa y habitacional',
      'Material y recursos de apoyo al proceso de incorporación social',
    ],
    gastos_ok: [
      'Personal de intervención y acompañamiento (educadores, psicólogos, trabajadores sociales)',
      'Acciones de inserción laboral, formativa y habitacional',
      'Material y recursos de apoyo al proceso de incorporación social',
      'Gastos de seguimiento e intervención individualizada',
    ],
    gastos_no: [
      'Gastos estructurales de la entidad',
      'Actividades dirigidas a colectivos distintos a mujeres jóvenes ex-tuteladas',
    ],
    requisitos: [
      'Inscripción en el Registro de Entidades de Servicios Sociales de la Junta de Andalucía',
      'Experiencia demostrable en atención a jóvenes ex-tutelados o mujeres en situación de vulnerabilidad',
      'Al corriente de AEAT y TGSS',
    ],
    nota: null,
    url_boja: null,
    url_bases: null,
    url_sede: null,
    fuente: 'boja',
    fuente_id: 'BOJA-2026-L16',
    activa: 1,
    destacada: 0,
  },
  /* ── Entidades locales ────────────────────────────────── */
  {
    slug: 'boja-2026-inclusion-l4',
    codigo: 'L4',
    titulo: 'Programas dirigidos a la Comunidad Gitana',
    titulo_full: 'BOJA 2026 — L4: Programas dirigidos a la Comunidad Gitana (Junta de Andalucía, entidades locales)',
    organo: 'Junta de Andalucía — Consejería de Inclusión Social',
    tipo_beneficiario: 'local',
    beneficiario_label: 'Ayuntamientos, mancomunidades y diputaciones de Andalucía',
    deadline: '16 de junio de 2026',
    deadline_short: '16 jun',
    deadline_note: null,
    deadline_iso: '2026-06-16',
    importe_min: null,
    importe_max: null,
    importe_range: 'Variable según programa',
    importe_detalle: 'Variable según el presupuesto del programa y los créditos asignados. Startidea realiza el diagnóstico de encaje antes de comenzar.',
    tipo_entidades: 'Entidades locales: ayuntamientos, mancomunidades de municipios y diputaciones provinciales de Andalucía.',
    financia_resumen: [
      'Programas de inserción social, educativa, laboral o sanitaria para la Comunidad Gitana',
      'Personal técnico del programa (mediadores, educadores)',
      'Materiales y actividades específicas del programa',
    ],
    gastos_ok: [
      'Programas de inserción social, empleo, educación, salud o vivienda para la Comunidad Gitana',
      'Personal técnico del programa y gastos de ejecución directa',
      'Actividades de sensibilización e integración social',
    ],
    gastos_no: [
      'Gastos de funcionamiento ordinario del ayuntamiento no relacionados con el programa',
      'Inversiones en infraestructuras',
    ],
    requisitos: [
      'Entidad local de Andalucía (ayuntamiento, mancomunidad o diputación)',
      'Programa dirigido específicamente a la Comunidad Gitana con objetivos medibles',
      'Al corriente de obligaciones tributarias y con la Seguridad Social',
    ],
    nota: null,
    url_boja: null,
    url_bases: null,
    url_sede: null,
    fuente: 'boja',
    fuente_id: 'BOJA-2026-L4',
    activa: 1,
    destacada: 0,
  },
  {
    slug: 'boja-2026-inclusion-l6',
    codigo: 'L6',
    titulo: 'Atención a personas inmigrantes y emigrantes temporeras',
    titulo_full: 'BOJA 2026 — L6: Atención a personas inmigrantes y emigrantes temporeras (Junta de Andalucía, entidades locales)',
    organo: 'Junta de Andalucía — Consejería de Inclusión Social',
    tipo_beneficiario: 'local',
    beneficiario_label: 'Ayuntamientos, mancomunidades y diputaciones de Andalucía',
    deadline: '16 de junio de 2026',
    deadline_short: '16 jun',
    deadline_note: null,
    deadline_iso: '2026-06-16',
    importe_min: null,
    importe_max: null,
    importe_range: 'Variable según programa',
    importe_detalle: 'Variable según el presupuesto del programa y los créditos asignados en la convocatoria.',
    tipo_entidades: 'Entidades locales: ayuntamientos, mancomunidades y diputaciones provinciales de Andalucía.',
    financia_resumen: [
      'Servicios de atención, acogida e integración de personas inmigrantes',
      'Orientación a temporeros agrícolas andaluces y sus familias',
      'Personal técnico: mediadores, intérpretes, trabajadores sociales',
    ],
    gastos_ok: [
      'Servicios de atención, acogida e integración de personas inmigrantes',
      'Orientación y asesoramiento a temporeros agrícolas andaluces y sus familias',
      'Personal técnico: mediadores interculturales, intérpretes, trabajadores sociales',
      'Actividades de inclusión y aprendizaje del idioma',
    ],
    gastos_no: [
      'Gastos de funcionamiento general de la administración local no vinculados al programa',
      'Actividades no relacionadas directamente con el colectivo beneficiario',
    ],
    requisitos: [
      'Entidad local andaluza (ayuntamiento, mancomunidad o diputación)',
      'Programa de atención específica a inmigrantes y/o temporeros con indicadores claros',
      'Al corriente de obligaciones tributarias y con la Seguridad Social',
    ],
    nota: null,
    url_boja: null,
    url_bases: null,
    url_sede: null,
    fuente: 'boja',
    fuente_id: 'BOJA-2026-L6',
    activa: 1,
    destacada: 0,
  },
  {
    slug: 'boja-2026-inclusion-l9',
    codigo: 'L9',
    titulo: 'Promoción de la participación ciudadana',
    titulo_full: 'BOJA 2026 — L9: Promoción de la participación ciudadana (Junta de Andalucía, entidades locales)',
    organo: 'Junta de Andalucía — Consejería de Inclusión Social',
    tipo_beneficiario: 'local',
    beneficiario_label: 'Ayuntamientos, mancomunidades y diputaciones de Andalucía',
    deadline: '16 de junio de 2026',
    deadline_short: '16 jun',
    deadline_note: null,
    deadline_iso: '2026-06-16',
    importe_min: null,
    importe_max: null,
    importe_range: 'Variable según programa',
    importe_detalle: 'Variable según el presupuesto del programa y los créditos disponibles en la convocatoria.',
    tipo_entidades: 'Entidades locales andaluzas: ayuntamientos, mancomunidades y diputaciones provinciales.',
    financia_resumen: [
      'Procesos participativos, consejos ciudadanos, presupuestos participativos',
      'Personal y material para el desarrollo de las actividades',
      'Fomento de la participación activa en la vida municipal y comunitaria',
    ],
    gastos_ok: [
      'Actividades concretas de fomento de la participación ciudadana activa',
      'Procesos participativos, consejos ciudadanos, presupuestos participativos',
      'Personal y material para el desarrollo de las actividades',
    ],
    gastos_no: [
      'Gastos ordinarios de funcionamiento del ayuntamiento no vinculados al programa',
      'Inversiones en equipamiento permanente',
    ],
    requisitos: [
      'Entidad local andaluza (ayuntamiento, mancomunidad o diputación)',
      'Actividades concretas de participación ciudadana (no genéricas ni difusas)',
      'Al corriente de obligaciones tributarias y con la Seguridad Social',
    ],
    nota: null,
    url_boja: null,
    url_bases: null,
    url_sede: null,
    fuente: 'boja',
    fuente_id: 'BOJA-2026-L9',
    activa: 1,
    destacada: 0,
  },
];
