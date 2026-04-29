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
  metric: { value: string; label: string };
  externalUrl?: string; // si tiene web pública propia
  // Detalle
  context: string;
  challenge: string;
  approach: string[];
  deliverables: string[];
  result: string[];
  testimonial?: { quote: string; author: string; role: string };
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
    prev: 'clinica-baca',
    next: 'down-granada',
  },
];

export function getCasoBySlug(slug: string): Caso | undefined {
  return casos.find((c) => c.slug === slug);
}
