/** Una métrica con valor + etiqueta + opcionalmente fuente verificable. */
export interface CasoMetric {
  value: string;
  label: string;
  /** Fuente del dato (ej. "Auditoría externa OnTech 2024"). Si está,
   *  se renderiza como nota al pie de la métrica. */
  source?: string;
}

/** Un hito de la línea de tiempo del proyecto. */
export interface CasoMilestone {
  /** Ej. "Mes 1", "Sesión 3", "Lanzamiento", "T+90 días post-launch". */
  when: string;
  /** Título corto del hito. */
  title: string;
  /** Detalle de qué ocurrió. */
  detail?: string;
}

/** Mención de prensa o repercusión externa del proyecto. */
export interface CasoPressMention {
  /** Nombre del medio o entidad. */
  source: string;
  /** Titular o cita del medio. */
  title: string;
  /** URL original si está pública. */
  url?: string;
  /** Fecha (ej. "abril 2024"). */
  date?: string;
}

/** Miembro del equipo que participó en el proyecto (Startidea + cliente). */
export interface CasoTeamMember {
  name: string;
  /** Rol en el proyecto, ej. "Dirección creativa", "Programación", "Validación accesibilidad". */
  role: string;
  /** "startidea" | "cliente" para distinguir lado. */
  side: 'startidea' | 'cliente';
}

export interface Caso {
  slug: string;
  num: string;
  cliente: string;
  sector: string;
  intervention: string;
  audience: 'Tercer sector' | 'Instituciones' | 'Empresas con propósito' | 'Iniciativa propia';
  discipline: 'Estrategia' | 'Comunicación' | 'Producto digital';
  kind?: 'cliente' | 'propio'; // distingue cliente externo vs producto propio
  year: string;
  duration: string;
  title: string;
  body: string;
  /** @deprecated Usar `metrics` (array de 1-3). Mantenido por retrocompatibilidad. */
  metric: { value: string; label: string };
  /** Hasta 3 métricas destacadas. Si vacío, se usa `metric` (legacy). */
  metrics?: CasoMetric[];
  externalUrl?: string; // si tiene web pública propia
  // Detalle
  context: string;
  challenge: string;
  approach: string[];
  deliverables: string[];
  result: string[];
  testimonial?: {
    quote: string;
    author: string;
    role: string;
    /** Path relativo a /public si hay foto del testimoniante. */
    photoSrc?: string;
  };
  /** Línea de tiempo opcional con 3-6 hitos del proyecto. */
  timeline?: CasoMilestone[];
  /** Equipo opcional (Startidea + cliente). Da contexto humano al proyecto. */
  team?: CasoTeamMember[];
  /** Repercusión mediática opcional. Si hay, refuerza autoridad GEO. */
  press?: CasoPressMention[];
  next?: string; // slug del siguiente caso
  prev?: string; // slug del anterior
}

export const casos: Caso[] = [
  {
    slug: 'down-granada',
    num: '01',
    cliente: 'Down Granada',
    sector: 'Asociación Síndrome de Down',
    intervention: 'Estrategia digital + Web',
    audience: 'Tercer sector',
    discipline: 'Producto digital',
    year: '2024',
    duration: '4 meses',
    title: 'Una web accesible, clara y humana para una entidad de referencia.',
    body: 'Diseño y desarrollo de la web institucional de la Asociación Síndrome de Down de Granada. Foco en accesibilidad WCAG, claridad de servicios y narrativa cercana.',
    metric: { value: 'AA', label: 'cumplimiento accesibilidad WCAG 2.1' },
    context:
      'Down Granada es la asociación de referencia en Andalucía oriental para personas con síndrome de Down y sus familias. Su web institucional anterior funcionaba como folleto: explicaba qué era la asociación pero no ayudaba a una familia que llegaba en momento delicado a entender, en cinco minutos, qué podía esperar de la organización.',
    challenge:
      'Construir una puerta de entrada útil para tres públicos muy distintos sin perder a ninguno: familias buscando programas y orientación, voluntariado queriendo sumarse, y empresas explorando colaboración. Cumplir accesibilidad WCAG 2.1 AA por convicción, no como casilla. Y mantener un tono que respeta sin paternalismo.',
    approach: [
      'Sesiones de trabajo con dirección y equipo de programas para mapear los recorridos reales de cada audiencia.',
      'Arquitectura de información validada con familias usuarias antes de tocar diseño.',
      'Sistema de componentes accesible desde cero: contraste AA, navegación por teclado, lectores de pantalla, lenguaje fácil donde aplica.',
      'Stack moderno (Astro + Tailwind) para garantizar rendimiento y bajo coste de mantenimiento.',
    ],
    deliverables: [
      'Web responsive con sistema de programas filtrable',
      'Lenguaje fácil en secciones clave',
      'Documentación técnica para equipo interno',
      'Capacitación de equipo de comunicación',
      'Auditoría de accesibilidad WCAG 2.1 AA',
    ],
    result: [
      'Cumplimiento WCAG 2.1 nivel AA verificado por terceros.',
      'Tiempo medio de carga por debajo de 1.2s en móvil.',
      'Equipo interno autónomo para actualizar programas y noticias sin tocar código.',
      'Reducción del volumen de llamadas con preguntas básicas: la web responde antes que el teléfono.',
    ],
    testimonial: {
      quote:
        'No queríamos una web bonita. Queríamos una herramienta que sirviera. Eso es lo que tenemos.',
      author: 'Equipo de Comunicación',
      role: 'Down Granada',
    },
    // ─── Enriquecimientos (Sprint case-studies-v2) ─────────────────
    metrics: [
      {
        value: 'AA',
        label: 'cumplimiento WCAG 2.1',
        source: 'Auditoría externa accesibilidad · 2024',
      },
      {
        value: '<1.2s',
        label: 'tiempo de carga en móvil 4G',
        source: 'PageSpeed Insights percentil 90',
      },
      {
        value: '−38%',
        label: 'llamadas con preguntas básicas tras el lanzamiento',
        source: 'Comparativa 6 meses pre vs 6 meses post',
      },
    ],
    timeline: [
      {
        when: 'Semana 1-2',
        title: 'Mapeo de audiencias',
        detail:
          'Sesiones con dirección y equipo de programas. Recorridos reales de familias, voluntariado y empresas.',
      },
      {
        when: 'Semana 3-5',
        title: 'Arquitectura de información',
        detail:
          'Validación con familias usuarias antes de tocar diseño. Test de comprensión en lenguaje fácil.',
      },
      {
        when: 'Semana 6-12',
        title: 'Diseño + desarrollo',
        detail:
          'Sistema de componentes accesible desde cero. Astro + Tailwind. Contraste AA, navegación por teclado, lectores de pantalla.',
      },
      {
        when: 'Semana 13-14',
        title: 'Auditoría WCAG 2.1 AA',
        detail:
          'Validación por tercera parte independiente. Ajustes finales sobre el informe.',
      },
      {
        when: 'Semana 15-16',
        title: 'Lanzamiento + capacitación',
        detail:
          'Migración limpia, capacitación al equipo de comunicación, documentación técnica.',
      },
      {
        when: 'T+6 meses',
        title: 'Revisión post-lanzamiento',
        detail:
          'Métricas medidas con criterio. Equipo interno actualiza programas y noticias sin tocar código.',
      },
    ],
    team: [
      { name: 'Mario Pablo Sánchez Barrón', role: 'Dirección de proyecto', side: 'startidea' },
      { name: 'Equipo Startidea', role: 'Diseño y desarrollo', side: 'startidea' },
      { name: 'Equipo de Comunicación Down Granada', role: 'Validación editorial', side: 'cliente' },
      { name: 'Dirección Down Granada', role: 'Aprobación estratégica', side: 'cliente' },
    ],
    prev: 'acogimiento-familiar-granada',
    next: 'granada-social-5',
  },
  {
    slug: 'granada-social-5',
    num: '02',
    cliente: 'Granada Social',
    sector: '5º Aniversario · Plataforma sociocultural',
    intervention: 'Producción audiovisual + Comunicación',
    audience: 'Instituciones',
    discipline: 'Comunicación',
    year: '2025',
    duration: '6 semanas',
    title: 'Un quinto aniversario que sirvió para contar quiénes somos.',
    body: 'Cobertura audiovisual integral del evento conmemorativo del 5º aniversario de Granada Social.',
    metric: { value: '5 años', label: 'de plataforma sociocultural en Granada' },
    context:
      'Granada Social cumplía 5 años en 2025. Una plataforma de contenido y eventos socioculturales que ha pasado de ser un proyecto pequeño a convertirse en una voz pública relevante en Granada. El aniversario era a la vez celebración y oportunidad estratégica: contarse a sí misma con la altura que tiene ahora.',
    challenge:
      'Producir cobertura audiovisual de un evento único e irrepetible — sin segundas tomas, sin guion ensayado — y a la vez generar piezas reutilizables que sirvieran al posicionamiento del proyecto durante los 12 meses siguientes. Un evento, dos calendarios.',
    approach: [
      'Plan de cobertura con equipo de cámara doble y dirección audiovisual in situ.',
      'Briefing previo con ponentes para captar momentos planificados sin perder los espontáneos.',
      'Pipeline de postproducción paralelo: piezas cortas para redes en 48h, vídeo institucional en 3 semanas.',
      'Coordinación con prensa local y trabajo de comunicación pre-evento para asegurar afluencia y eco mediático.',
    ],
    deliverables: [
      'Vídeo institucional resumen (3-5 min)',
      'Serie de 8 piezas cortas para redes',
      'Cobertura fotográfica completa',
      'Banco editorial reutilizable a 12 meses',
      'Plan de comunicación pre y post evento',
    ],
    result: [
      'Cobertura periodística en medios locales y digitales especializados.',
      'Repunte de seguidores en RRSS sostenido durante el mes posterior.',
      'Material reutilizable para contenido institucional durante todo el siguiente año.',
      'Refuerzo del relato de marca: de "evento" a "comunidad consolidada".',
    ],
    metrics: [
      { value: '5 años', label: 'de plataforma sociocultural en Granada' },
      { value: '8 piezas', label: 'cortas para redes producidas + 1 vídeo institucional 3-5 min' },
      { value: '12 meses', label: 'de banco editorial reutilizable post-evento' },
    ],
    timeline: [
      { when: 'Semana 1-2', title: 'Briefing pre-evento', detail: 'Planificación de cobertura con ponentes. Captar lo previsto sin perder lo espontáneo.' },
      { when: 'Día del evento', title: 'Producción in situ', detail: 'Equipo de cámara doble y dirección audiovisual en directo.' },
      { when: '48 horas', title: 'Primeras piezas para redes', detail: 'Pipeline de postproducción acelerado para mantener tracción.' },
      { when: 'Semana 3-5', title: 'Vídeo institucional final', detail: 'Pieza resumen 3-5 min con guion editado en sala.' },
      { when: 'Semana 6', title: 'Banco editorial entregado', detail: 'Materiales reutilizables a 12 meses + plan de comunicación post.' },
    ],
    team: [
      { name: 'Dirección Startidea', role: 'Dirección audiovisual', side: 'startidea' },
      { name: 'Equipo Startidea', role: 'Cámara, producción y postproducción', side: 'startidea' },
      { name: 'Dirección Granada Social', role: 'Coordinación editorial del evento', side: 'cliente' },
      { name: 'Equipo Granada Social', role: 'Logística + comunicación pre-evento', side: 'cliente' },
    ],
    prev: 'down-granada',
    next: 'proyecto-hombre',
  },
  {
    slug: 'proyecto-hombre',
    num: '03',
    cliente: 'Proyecto Hombre Granada',
    sector: 'Fundación · Adicciones y reinserción',
    intervention: 'Campaña de sensibilización',
    audience: 'Tercer sector',
    discipline: 'Comunicación',
    year: '2024',
    duration: '3 meses',
    title: 'Sensibilizar sin victimizar. Hablar de adicciones con respeto.',
    body: 'Campaña social para Proyecto Hombre Granada centrada en la sensibilización ciudadana sobre adicciones y procesos de reinserción.',
    metric: { value: '+ comunidad', label: 'que entiende sin juzgar' },
    context:
      'Proyecto Hombre lleva décadas trabajando en prevención y tratamiento de adicciones. La conversación pública sobre el tema sigue cargada de estigma: o se trata con sensacionalismo (drama, fracaso) o con épica simplista (rehabilitación heroica). Las dos versiones le hacen daño al objetivo real: que más gente pida ayuda antes y que la sociedad acompañe sin juzgar.',
    challenge:
      'Diseñar una campaña que cambiara el registro de la conversación. Ni alarmismo, ni heroización. Mostrar la realidad de los procesos sin convertirlos en pornografía emocional. Hablar a la ciudadanía y a las propias personas en proceso al mismo tiempo, en el mismo material.',
    approach: [
      'Trabajo previo con personas usuarias y profesionales de Proyecto Hombre para definir el tono permitido y el inaceptable.',
      'Decisión estratégica: protagonismo a la mirada de quien acompaña, no solo de quien ha pasado por el proceso.',
      'Producción audiovisual con equipo de personas reales (no actores).',
      'Plan de medios mixto: redes orgánicas, medios locales, soportes presenciales en barrios.',
    ],
    deliverables: [
      'Spot principal de campaña (60s + corte 30s)',
      'Serie de testimonios audiovisuales (4 piezas)',
      'Soportes gráficos para redes y exteriores',
      'Argumentario para portavoces y voluntariado',
    ],
    result: [
      'Eco mediático en prensa local respetando el tono propuesto.',
      'Aumento de consultas de información en el periodo posterior a la campaña.',
      'Material reutilizado por la entidad en intervenciones formativas y eventos.',
      'Conversación pública desplazada del estigma hacia el acompañamiento.',
    ],
    metrics: [
      { value: '60s + 30s', label: 'spot principal con dos cortes (campaña + redes)' },
      { value: '4 testimonios', label: 'audiovisuales con personas reales (no actores)' },
      { value: '0 estigma', label: 'criterio editorial revisado por el equipo clínico de Proyecto Hombre' },
    ],
    timeline: [
      { when: 'Mes 1', title: 'Sesiones con personas usuarias y profesionales', detail: 'Definición del tono permitido y el inaceptable antes de tocar guion.' },
      { when: 'Mes 1-2', title: 'Guion + producción audiovisual', detail: 'Grabación con personas reales. Decisión de protagonismo: la mirada de quien acompaña.' },
      { when: 'Mes 2', title: 'Postproducción + soportes gráficos', detail: 'Cortes para redes + argumentario para portavoces y voluntariado.' },
      { when: 'Mes 3', title: 'Lanzamiento + plan de medios mixto', detail: 'Redes orgánicas, prensa local, soportes presenciales en barrios.' },
      { when: 'Post-campaña', title: 'Material reutilizado en formación interna', detail: 'Las piezas se integran en intervenciones formativas y eventos.' },
    ],
    team: [
      { name: 'Dirección Startidea', role: 'Dirección creativa de campaña', side: 'startidea' },
      { name: 'Equipo Startidea', role: 'Producción audiovisual + diseño gráfico', side: 'startidea' },
      { name: 'Equipo clínico Proyecto Hombre', role: 'Validación editorial + tono', side: 'cliente' },
      { name: 'Dirección Proyecto Hombre Granada', role: 'Aprobación estratégica', side: 'cliente' },
    ],
    prev: 'granada-social-5',
    next: 'tres-mil-millones-latidos',
  },
  {
    slug: 'tres-mil-millones-latidos',
    num: '04',
    cliente: 'Tres Mil Millones de Latidos',
    sector: 'Plataforma de mentoría con IA · Bienestar emocional',
    intervention: 'Producto digital propio + Estrategia + Supervisión clínica',
    audience: 'Iniciativa propia',
    discipline: 'Producto digital',
    kind: 'propio',
    year: '2025',
    duration: 'En desarrollo activo',
    title: 'Una conversación. Un siguiente paso. Salud mental con tecnología y supervisión humana.',
    body: 'Plataforma propia de mentoría con IA en español. Acompañamiento emocional sin registro: cuentas lo que te bloquea y sales con una acción concreta para hoy. Diseñada por Startidea con asesoría clínica de Amaya Prado.',
    metric: { value: '< 10 min', label: 'de conversación a acción concreta' },
    externalUrl: 'https://tresmilmillonesdelatidos.es',
    context:
      'La salud mental es la conversación pendiente del sector con propósito. Acceso desigual a profesionales, listas de espera de meses, y una generación que ya no entra a un despacho de psicólogo a la primera. Hay tecnología capaz de hacer la primera milla — escuchar sin juicio, ayudar a poner palabras al malestar, sugerir un paso pequeño — pero entregarla bien requiere un método y una supervisión clínica que la mayoría de productos de "wellness con IA" no tienen.',
    challenge:
      'Construir una plataforma que ayude de verdad sin pretender sustituir a un profesional. Que no exija registro, que no recoja datos sensibles, que devuelva valor en menos de diez minutos. Y que tenga una supervisión clínica seria detrás — no un disclaimer al pie. La línea entre "herramienta útil" y "intervención irresponsable" es fina y la queríamos clara.',
    approach: [
      'Definición del método de conversación con asesoría clínica desde el día cero (no como auditoría posterior).',
      'Diseño de producto sin registro y sin email: el usuario escribe, conversa, sale con un paso. Sin trazas.',
      'Construcción técnica con stack moderno y supervisión continua del comportamiento del sistema.',
      'Disclaimer reiterado en cada interacción: "no sustituye terapia ni intervención psicológica profesional".',
      'Comunidad y reto de 30 días para quien quiera estructura más allá de una conversación puntual.',
    ],
    deliverables: [
      'Plataforma web tresmilmillonesdelatidos.es',
      'Método de conversación supervisado clínicamente',
      'Calculadora de latidos (herramienta complementaria)',
      'Test gratuito de evaluación inicial',
      'Programa "El reto 30 días"',
      'Sistema de comunidad colaborativa',
    ],
    result: [
      '+200 personas usándolo cada semana de forma orgánica.',
      'Conversaciones completadas en menos de 10 minutos con acción concreta sugerida.',
      'Caso de referencia para la línea de innovación social propia de Startidea.',
      'Demuestra que la agencia no solo asesora — también construye productos digitales con propósito.',
    ],
    testimonial: {
      quote: 'La IA es la herramienta. El método y la supervisión los pone un equipo humano.',
      author: 'Mario Pablo Sánchez Barrón',
      role: 'Fundador · Startidea',
    },
    metrics: [
      { value: '< 10 min', label: 'de conversación a acción concreta sugerida' },
      { value: '+200/sem', label: 'personas usándolo de forma orgánica' },
      { value: '0 datos', label: 'sensibles recogidos · sin registro, sin email' },
    ],
    timeline: [
      { when: 'Fase 0', title: 'Diseño del método con supervisión clínica', detail: 'Amaya Prado entra como asesoría desde el día cero, no como auditoría posterior.' },
      { when: 'Fase 1', title: 'Diseño de producto sin registro', detail: 'El usuario escribe, conversa, sale con un paso. Sin trazas, sin email.' },
      { when: 'Fase 2', title: 'Construcción técnica', detail: 'Stack moderno + supervisión continua del comportamiento del sistema.' },
      { when: 'Fase 3', title: 'Programa "El reto 30 días"', detail: 'Estructura para quien quiera más allá de una conversación puntual.' },
      { when: 'En curso', title: 'Comunidad colaborativa', detail: 'Test gratuito de evaluación inicial + calculadora de latidos + comunidad.' },
    ],
    team: [
      { name: 'Mario Pablo Sánchez Barrón', role: 'Dirección de producto', side: 'startidea' },
      { name: 'Equipo Startidea', role: 'Construcción técnica + IA + comunidad', side: 'startidea' },
      { name: 'Amaya Prado', role: 'Asesoría clínica', side: 'cliente' },
    ],
    prev: 'proyecto-hombre',
    next: 'clinica-baca',
  },
  {
    slug: 'clinica-baca',
    num: '05',
    cliente: 'Clínica Dental Arturo Baca',
    sector: 'Salud privada · Granada',
    intervention: 'Web + Redes sociales',
    audience: 'Empresas con propósito',
    discipline: 'Comunicación',
    year: '2024',
    duration: '12 meses (recurrente)',
    title: 'Clínica de barrio con narrativa de marca de referencia.',
    body: 'Nueva web institucional y gestión continua de redes sociales para Clínica Dental Arturo Baca, una clínica con vocación de proximidad pero ambición de marca.',
    metric: { value: '12 meses', label: 'de relación recurrente' },
    context:
      'Clínica Baca es una clínica dental granadina con un estilo claro: trato cercano, diagnóstico honesto, comunicación sin ruido. La web anterior y las redes existían como obligación, no como activo. El cliente nuevo no las leía y el cliente antiguo no las recordaba.',
    challenge:
      'Construir una identidad digital coherente con el trato real en consulta. Sin antes-y-después agresivos, sin marketing de miedo, sin promesas vacías. Una web que el paciente puede leer la noche anterior a la primera cita y salir con menos dudas y más confianza, y unas redes que mantienen ese mismo registro semana tras semana.',
    approach: [
      'Sesiones de descubrimiento con el equipo clínico para mapear los recorridos reales del paciente.',
      'Sistema visual sobrio, con la fotografía propia del equipo como elemento central — sin stock.',
      'Web orientada a respuesta: tratamientos, equipo, financiación y reserva en menos de tres clics.',
      'Calendario editorial de redes con tono educativo, sin clickbait dental.',
    ],
    deliverables: [
      'Nueva web institucional',
      'Sistema visual y de tono editorial',
      'Calendario y producción mensual de redes',
      'Sesiones de fotografía con el equipo',
      'Reportes trimestrales con métricas reales (no vanity)',
    ],
    result: [
      'Aumento de reservas online sostenido durante el primer trimestre tras el lanzamiento.',
      'Pacientes que llegan a primera consulta mejor informados sobre el proceso y los plazos.',
      'Comunidad estable en redes con engagement orgánico (sin ads).',
      'Relación que se ha extendido en formato recurrente — no proyecto puntual.',
    ],
    metrics: [
      { value: '12 meses', label: 'de relación recurrente (no proyecto puntual)' },
      { value: '0 ads', label: 'comunidad estable en redes con engagement orgánico' },
      { value: '< 3 clics', label: 'del paciente a la reserva online' },
    ],
    timeline: [
      { when: 'Semana 1-2', title: 'Sesiones de descubrimiento', detail: 'Recorridos reales del paciente con el equipo clínico.' },
      { when: 'Semana 3-5', title: 'Sistema visual + sesiones fotográficas', detail: 'Fotografía propia del equipo. Sin stock. Sin antes-y-después agresivos.' },
      { when: 'Semana 6-10', title: 'Web institucional nueva', detail: 'Tratamientos + equipo + financiación + reserva en menos de tres clics.' },
      { when: 'Semana 11-12', title: 'Calendario editorial de redes', detail: 'Tono educativo sin clickbait dental. Producción mensual sostenida.' },
      { when: 'Trimestrales', title: 'Reportes con métricas reales', detail: 'Reservas, comportamiento de pacientes, engagement orgánico — sin vanity metrics.' },
      { when: 'Recurrente', title: 'Relación que continúa', detail: 'Proyecto inicial → contrato recurrente de gestión continua.' },
    ],
    team: [
      { name: 'Dirección Startidea', role: 'Dirección de cuenta + estrategia editorial', side: 'startidea' },
      { name: 'Equipo Startidea', role: 'Diseño + desarrollo + fotografía + gestión de redes', side: 'startidea' },
      { name: 'Dr. Arturo Baca', role: 'Dirección clínica y validación editorial', side: 'cliente' },
      { name: 'Equipo Clínica Baca', role: 'Participación en sesiones fotográficas y contenido', side: 'cliente' },
    ],
    prev: 'tres-mil-millones-latidos',
    next: 'acogimiento-familiar-granada',
  },
  {
    slug: 'acogimiento-familiar-granada',
    num: '06',
    cliente: 'Aldaima',
    sector: 'Asociación · Acogimiento familiar',
    intervention: 'Web + Campaña de sensibilización',
    audience: 'Tercer sector',
    discipline: 'Comunicación',
    year: '2024',
    duration: '12 semanas',
    title: 'Una casa digital para captar familias acogedoras.',
    body: 'Plataforma acogimientofamiliargranada.org y campaña multimedia para Aldaima — la asociación andaluza de referencia en acogimiento familiar de menores. Una web pensada para que una familia interesada pase de la duda a la primera reunión.',
    metric: { value: 'acogimientofamiliargranada.org', label: 'plataforma de captación' },
    externalUrl: 'https://acogimientofamiliargranada.org',
    context:
      'Aldaima trabaja desde Granada en programas de acogimiento familiar, mediación y atención a la infancia. La conversación pública sobre acogimiento sigue cargada de dudas legítimas — "¿lo podría hacer mi familia?", "¿cuánto tiempo dura?", "¿y si me encariño?". Las respuestas existen y son claras, pero estaban repartidas entre PDFs, llamadas y reuniones presenciales.',
    challenge:
      'Construir el primer punto de contacto digital para familias que están considerando acogimiento — claro, cálido, sin paternalismo, con respuestas directas a las preguntas reales. Y a la vez una pieza audiovisual ("Valientes") que se pueda mostrar en aulas, eventos, redes y presentaciones institucionales. Web y campaña al servicio de un único objetivo: que más familias den el paso.',
    approach: [
      'Co-construcción de la arquitectura informativa con el equipo técnico de Aldaima — psicología, trabajo social y pedagogía decidiendo juntas qué responder, en qué orden y con qué tono.',
      'Web con recorrido optimizado para una familia que descubre el acogimiento por primera vez: entiende, despeja dudas, deja contacto.',
      'Pieza animada "Valientes" en formato corto: permite hablar de situaciones complejas sin la dureza de la recreación con personas.',
      'Versiones cortas y largas de la pieza para distintos contextos (clase, evento, redes, web).',
      'Sistema editorial ligero para que el equipo de Aldaima actualice testimonios y noticias sin tocar código.',
    ],
    deliverables: [
      'Plataforma acogimientofamiliargranada.org',
      'Pieza animada principal "Valientes"',
      'Cortes adaptados (15s, 30s, 60s) para redes y eventos',
      'Sistema visual y de tono editorial',
      'Materiales gráficos complementarios para campaña y aulas',
      'Guía de uso para mediadores y profesionales',
    ],
    result: [
      'Web institucional online como puerta de entrada principal a los programas.',
      'Aumento de solicitudes de información cualificadas desde la propia plataforma.',
      'Material reutilizable para presentaciones a administraciones públicas.',
      'Pieza "Valientes" integrada en programas de sensibilización en aulas y eventos.',
      'Recibido con buen eco por la red estatal de entidades de acogimiento.',
    ],
    metrics: [
      { value: 'acogimientofamiliargranada.org', label: 'plataforma de captación operativa' },
      { value: '3 cortes', label: 'de la pieza "Valientes" (15s / 30s / 60s) para distintos contextos' },
      { value: 'Red estatal', label: 'eco positivo entre entidades de acogimiento familiar' },
    ],
    timeline: [
      { when: 'Semana 1-2', title: 'Co-construcción con equipo técnico Aldaima', detail: 'Psicología, trabajo social y pedagogía deciden juntas qué responder, en qué orden y con qué tono.' },
      { when: 'Semana 3-4', title: 'Arquitectura web orientada a respuesta', detail: 'Recorrido de la familia: entiende → despeja dudas → deja contacto.' },
      { when: 'Semana 5-8', title: 'Pieza animada "Valientes"', detail: 'Animación que permite hablar de situaciones complejas sin la dureza de recreación con personas.' },
      { when: 'Semana 9-10', title: 'Cortes adaptados + materiales gráficos', detail: 'Versiones 15s, 30s, 60s para clase, evento, redes y web.' },
      { when: 'Semana 11', title: 'Sistema editorial ligero', detail: 'El equipo de Aldaima actualiza testimonios y noticias sin tocar código.' },
      { when: 'Semana 12', title: 'Lanzamiento + guía profesionales', detail: 'Guía de uso para mediadores y profesionales. Recepción por red estatal.' },
    ],
    team: [
      { name: 'Dirección Startidea', role: 'Dirección de proyecto + estrategia digital', side: 'startidea' },
      { name: 'Equipo Startidea', role: 'Diseño + desarrollo + producción animación', side: 'startidea' },
      { name: 'Dirección Aldaima', role: 'Aprobación estratégica + tono editorial', side: 'cliente' },
      { name: 'Equipo técnico Aldaima', role: 'Psicología, trabajo social y pedagogía', side: 'cliente' },
    ],
    prev: 'clinica-baca',
    next: 'equipo-agentes-ia',
  },
  {
    slug: 'equipo-agentes-ia',
    num: '07',
    cliente: 'Startidea',
    sector: 'Agencia de comunicación social · IA aplicada',
    intervention: 'Plataforma de agentes IA propia + integración interna',
    audience: 'Iniciativa propia',
    discipline: 'Producto digital',
    kind: 'propio',
    year: '2026',
    duration: '1 semana (y en evolución)',
    title: 'Cuatro agentes de IA que se saben la casa. Montados en una semana.',
    body: 'Startidea desplegó su propia plataforma de agentes de IA —autoalojada, en servidor propio— y puso en producción cuatro agentes con el conocimiento real de la agencia: consultor experto, comercial de propuestas, redactor editorial de Granada Social y asesor de ayudas de digitalización. Integrados en el sistema de gestión interno y editables sin código.',
    metric: { value: '4 agentes', label: 'en producción con conocimiento real de la casa' },
    metrics: [
      { value: '4 agentes', label: 'en producción: consultor, comercial, redactor y asesor de ayudas' },
      { value: '1 semana', label: 'de la decisión al equipo completo funcionando' },
      { value: '100%', label: 'del conocimiento en servidor propio · nada en SaaS de terceros' },
    ],
    context:
      'Toda organización tiene el mismo problema: el conocimiento vive disperso —dossiers, tarifas, metodologías, tonos editoriales— y las mismas preguntas interrumpen una y otra vez a las personas que más saben. La IA generativa promete resolverlo, pero los chatbots genéricos no saben nada de tu casa y los SaaS de moda exigen subir tus documentos a saber dónde. Startidea quiso comprobar, con su propio conocimiento y su propia infraestructura, si había una tercera vía.',
    challenge:
      'Montar un equipo de agentes que respondiera con los documentos reales de la agencia —sin inventar cifras, citando fuentes—, sobre plataforma propia y no alquilada, integrado en las herramientas donde el equipo ya trabaja, y editable después por personas sin perfil técnico. Y hacerlo rápido: si el resultado tarda meses, la promesa de la IA se disuelve en consultoría eterna.',
    approach: [
      'Despliegue de una plataforma de agentes autoalojada en servidor propio en la UE, con editor visual sin código.',
      'Indexación del conocimiento real: dossiers de servicios, tarifas oficiales, metodología, portfolio, tono editorial de Granada Social y programa de ayudas — con búsqueda semántica.',
      'Cuatro agentes especializados, cada uno con su rol, su tono y su base de conocimiento propia.',
      'Integración en el sistema operativo interno de la agencia: los agentes se invocan desde el chat de gestión donde el equipo ya trabaja.',
      'Desarrollo asistido por IA con supervisión del equipo — el mismo método que Startidea aplica a clientes.',
      'Vigilancia y copias de seguridad diarias desde el primer día: infraestructura de producción, no un experimento.',
    ],
    deliverables: [
      'Plataforma de agentes autoalojada (dify.hubstartidea.es)',
      'Consultor Experto: estrategia y servicios con el conocimiento de la casa',
      'Comercial de Propuestas: redacta con la estructura y tarifas oficiales',
      'Redactor Granada Social: noticias y contenidos con el tono del medio',
      'Asesor de ayudas de digitalización para clientes',
      'Integración con el panel de gestión interno + monitorización y backups',
    ],
    result: [
      'Cuatro agentes en producción usados por el equipo en el día a día.',
      'Las tarifas, la metodología y el tono responden solos: la pregunta que interrumpía a la persona que más sabe ahora se resuelve en segundos, con la fuente citada.',
      'Los agentes destaparon inconsistencias en la documentación interna (dos tarifarios contradictorios) — auditoría de conocimiento incluida.',
      'El mismo despliegue, método y plataforma que Startidea ofrece ahora a organizaciones y empresas.',
    ],
    testimonial: {
      quote: 'La pregunta no era si la IA sabía mucho. Era si podía saber lo nuestro, sin regalárselo a nadie.',
      author: 'Mario Pablo Sánchez Barrón',
      role: 'Fundador · Startidea',
    },
    timeline: [
      { when: 'Día 1', title: 'Plataforma autoalojada desplegada', detail: 'Instalación en servidor propio, dominio, certificados y seguridad.' },
      { when: 'Día 2', title: 'Primer agente: Consultor Experto', detail: 'Identidad, tono y conocimiento estratégico de la agencia indexado.' },
      { when: 'Día 3', title: 'Tres agentes más', detail: 'Comercial de propuestas, redactor de Granada Social y asesor de ayudas — cada uno con su base de conocimiento.' },
      { when: 'Día 4', title: 'Conocimiento real + búsqueda semántica', detail: 'Dossiers, tarifario oficial, portfolio y propuestas reales indexados; recuperación por significado.' },
      { when: 'Día 5', title: 'Integración y endurecimiento', detail: 'Agentes conectados al panel de gestión interno; vigilancia y backups diarios activos.' },
    ],
    team: [
      { name: 'Mario Pablo Sánchez Barrón', role: 'Dirección de producto + criterio', side: 'startidea' },
      { name: 'Equipo Startidea', role: 'Conocimiento, tono y validación', side: 'startidea' },
      { name: 'Ingeniería asistida por IA', role: 'Despliegue, integración y automatización supervisadas', side: 'startidea' },
    ],
    prev: 'acogimiento-familiar-granada',
    next: 'down-granada',
  },
];

export function getCasoBySlug(slug: string): Caso | undefined {
  return casos.find((c) => c.slug === slug);
}

/** Casos en el orden exacto de la lista de slugs dada (ignora los que no existan).
 *  Pensado para curar la prueba relevante en cada ficha de servicio. */
export function casosPorSlugs(slugs: string[]): Caso[] {
  return slugs.map((s) => getCasoBySlug(s)).filter((c): c is Caso => Boolean(c));
}

/** Casos cuya disciplina principal coincide. Útil como conveniencia; para fichas
 *  de servicio con cobertura desigual, preferir casosPorSlugs() con lista curada. */
export function casosPorDisciplina(disciplina: Caso['discipline']): Caso[] {
  return casos.filter((c) => c.discipline === disciplina);
}
