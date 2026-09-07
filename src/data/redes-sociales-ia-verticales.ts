/**
 * Datos de las landings sectoriales de /redes-sociales-ia/<vertical>.
 * Viven fuera del .astro porque getStaticPaths() se evalúa aislado del
 * frontmatter y no puede leer constantes declaradas allí.
 */
export interface Vertical {
  nombre: string;          // etiqueta corta (breadcrumb, eyebrow)
  audiencia: string[];     // para schema
  title: string;           // <title>
  description: string;     // meta description
  h1: string;
  h1Acento: string;
  lede: string;
  problema: string;
  problemaDetalle: string;
  publica: { title: string; body: string }[];   // qué contenido se hace
  nunca: string[];                              // líneas rojas
  mes: string[];                                // ejemplo de calendario mensual
  plan: { nombre: string; precio: string; porQue: string };
  faqs: { q: string; a: string }[];
  enlaces: { label: string; href: string }[];   // páginas hermanas
}

export const VERTICALES: Record<string, Vertical> = {
  'tercer-sector': {
    nombre: 'Asociaciones y fundaciones',
    audiencia: ['Asociación', 'Fundación', 'ONG', 'Entidad social'],
    title: 'Redes sociales con IA para asociaciones y fundaciones — Startidea',
    description:
      'Gestión de redes sociales para asociaciones, fundaciones y ONG: IA calibrada con la voz de la entidad y supervisada por personas. Sin pornografía emocional, sin perfil parado. Desde 190 € al mes, sin permanencia.',
    h1: 'Las redes de tu entidad,',
    h1Acento: 'sin robarle horas a la misión.',
    lede:
      'Startidea pone la IA a redactar y programar las publicaciones de tu asociación o fundación con la voz de la entidad. Una persona que conoce el tercer sector revisa cada pieza. Tú apruebas. Nada de textos de plantilla ni de dramatizar a las personas que atendéis.',
    problema: 'Las redes las lleva quien puede, cuando puede. Y quien puede está atendiendo a personas.',
    problemaDetalle:
      'En la mayoría de entidades pequeñas no hay nadie de comunicación. El perfil se actualiza cuando hay un evento y se para el resto del año. Las herramientas de IA generalistas no ayudan: no saben qué es una memoria de actividades, ni por qué no se publica la cara de un menor, ni cómo pedir sin humillar.',
    publica: [
      { title: 'La obra, contada con dignidad', body: 'Qué hacéis, con quién y para qué, sin cifras infladas ni historias que exponen a nadie.' },
      { title: 'Base social y voluntariado', body: 'Convocatorias, agradecimientos, formación. Lo que mantiene viva a la entidad entre campañas.' },
      { title: 'Transparencia y rendición de cuentas', body: 'Memorias, subvenciones recibidas, qué se hizo con el dinero. Lo que las administraciones y los donantes miran.' },
      { title: 'Campañas de captación', body: 'Cuando toca pedir, pedir bien: un motivo, un destino y una forma clara de ayudar.' },
    ],
    nunca: [
      'Imágenes de personas atendidas sin consentimiento informado, ni menores reconocibles.',
      'Relatos que presentan a las personas como víctimas para conseguir donativos.',
      'Cifras de impacto que no salgan de vuestra memoria.',
      'Posicionamientos políticos que no haya aprobado la junta.',
    ],
    mes: [
      'Semana 1: qué se hizo el mes pasado (con datos de la memoria).',
      'Semana 2: una persona del equipo o del voluntariado y por qué está.',
      'Semana 3: recurso útil para vuestra base social (guía, fecha, trámite).',
      'Semana 4: convocatoria, agradecimiento o llamada a colaborar.',
    ],
    plan: { nombre: 'Presencia', precio: '190', porQue: 'Tres publicaciones a la semana bastan para que la entidad no parezca cerrada, y el coste entra en la partida de comunicación de casi cualquier subvención.' },
    faqs: [
      { q: '¿Se puede justificar en una subvención?', a: 'Sí. Startidea factura como servicio de comunicación y entrega informe mensual de lo publicado, que sirve como justificación de la actividad de difusión que exigen la mayoría de convocatorias.' },
      { q: '¿Cómo aseguráis que no se publica nada sensible?', a: 'Con las líneas rojas de la entidad cargadas en el cerebro de marca y una persona revisando cada pieza antes de que llegue a tu aprobación. Si algo toca a personas atendidas, se pregunta antes.' },
      { q: '¿Y si la entidad no tiene fotos?', a: 'Se trabaja con lo que hay: banco de imágenes ético, diseño tipográfico con la identidad de la entidad y, en el plan Institucional, cobertura de eventos.' },
      { q: '¿Publicáis también en la web o en la newsletter?', a: 'Las redes son el servicio base. La newsletter y las notas de la web se pueden añadir; se habla en la demo.' },
    ],
    enlaces: [
      { label: 'Fundraising para entidades', href: '/fundraising' },
      { label: 'Subvenciones abiertas', href: '/subvenciones' },
      { label: 'Plan de comunicación para una ONG', href: '/notas/plan-comunicacion-ong' },
    ],
  },
  iglesia: {
    nombre: 'Parroquias y entidades de la Iglesia',
    audiencia: ['Parroquia', 'Diócesis', 'Congregación religiosa', 'Movimiento laical', 'Obra social de la Iglesia'],
    title: 'Redes sociales con IA para parroquias, diócesis y congregaciones — Startidea',
    description:
      'Gestión de redes sociales para parroquias, diócesis, congregaciones y obras sociales de la Iglesia: IA calibrada con el lenguaje de la institución y revisada por personas que conocen la comunicación eclesial. Sin permanencia.',
    h1: 'Las redes de la parroquia,',
    h1Acento: 'con el lenguaje de la Iglesia.',
    lede:
      'Startidea pone la IA a redactar y programar las publicaciones de tu parroquia, diócesis o congregación con el registro propio de la institución: tiempos litúrgicos, obra social, vida de la comunidad. Una persona con experiencia en comunicación eclesial revisa cada pieza. El párroco o el responsable aprueba.',
    problema: 'Un voluntario lleva el Instagram. Cuando se va, se queda parado hasta el siguiente.',
    problemaDetalle:
      'La comunicación en la Iglesia depende de personas concretas y cambia con cada relevo. Las herramientas de IA generalistas no saben qué es el Adviento, confunden una hermandad con una asociación cultural y proponen textos que no puede firmar ninguna institución eclesial.',
    publica: [
      { title: 'Tiempo litúrgico y vida de la comunidad', body: 'Horarios, celebraciones, catequesis, grupos. Lo que la gente busca cuando entra en el perfil.' },
      { title: 'La obra social, que casi nunca se cuenta', body: 'Cáritas parroquial, comedores, acogida, acompañamiento. Contada con dignidad y sin triunfalismo.' },
      { title: 'Palabra y formación', body: 'Fragmentos, lecturas, reflexiones del párroco o del carisma, adaptados a cada red sin banalizar.' },
      { title: 'Campañas y colectas', body: 'Con el calendario de la Iglesia y con un destino claro de cada aportación.' },
    ],
    nunca: [
      'Contenido doctrinal o litúrgico que no haya revisado el responsable de la institución.',
      'Imágenes de menores o de personas atendidas por la obra social sin consentimiento.',
      'Tono publicitario o "de marca" para hablar de sacramentos o de la fe.',
      'Polémicas o posicionamientos ajenos al magisterio y a la línea de la diócesis.',
    ],
    mes: [
      'Semana 1: el tiempo litúrgico y lo que se vive en la comunidad.',
      'Semana 2: la obra social, con un dato y una cara con permiso.',
      'Semana 3: un texto para pensar, de la Palabra o del carisma.',
      'Semana 4: convocatoria, agenda o agradecimiento a los colaboradores.',
    ],
    plan: { nombre: 'Crecimiento', precio: '390', porQue: 'La vida de una parroquia o una congregación es diaria, y una publicación al día en tres redes es lo que la comunidad espera encontrar. La doble aprobación deja el control en manos del responsable.' },
    faqs: [
      { q: '¿Quién aprueba lo que se publica?', a: 'Quien decida la institución: el párroco, el delegado de comunicación o el superior. Nada sale sin esa aprobación, publicación a publicación o en bloque mensual.' },
      { q: '¿Conocéis la comunicación de la Iglesia?', a: 'Startidea trabaja con diócesis, congregaciones, movimientos y fundaciones eclesiales desde 2011. No se trata como una variante de la comunicación corporativa: tiene su lógica, sus tiempos y sus audiencias.' },
      { q: '¿Se puede llevar la obra social por separado?', a: 'Sí. Es habitual que la obra social tenga perfiles propios y un tono distinto al de la institución. Se pueden gestionar como cuentas separadas dentro del mismo plan.' },
      { q: '¿Y las hermandades y cofradías?', a: 'También. El calendario y el registro son distintos, y el cerebro de marca se calibra con los textos de la propia hermandad.' },
    ],
    enlaces: [
      { label: 'Comunicación eclesial', href: '/comunicacion-eclesial' },
      { label: 'Instituciones', href: '/para-quien/instituciones' },
      { label: 'Fundraising', href: '/fundraising' },
    ],
  },
  'empresas-con-proposito': {
    nombre: 'Empresas con propósito',
    audiencia: ['Empresa con propósito', 'Pyme', 'Empresa social', 'Dirección de RSC'],
    title: 'Redes sociales con IA para empresas con propósito y RSC — Startidea',
    description:
      'Gestión de redes sociales para pymes y empresas con propósito: IA calibrada con la voz de la marca y supervisada por personas. Acción social empresarial y ESG contados con pruebas, sin greenwashing. Sin permanencia.',
    h1: 'Tu propósito en redes,',
    h1Acento: 'con pruebas y sin postureo.',
    lede:
      'Startidea pone la IA a redactar y programar las publicaciones de tu empresa con la voz de la marca. Una persona que sabe distinguir acción social de greenwashing revisa cada pieza. Tú apruebas. El resultado es una presencia constante que se puede enseñar a un cliente, a un banco o a una administración.',
    problema: 'La empresa hace cosas buenas y no las cuenta. O las cuenta tan mal que parecen mentira.',
    problemaDetalle:
      'Muchas pymes sostienen proyectos sociales, contratan con criterio o reducen su huella, y en redes solo publican ofertas. Las herramientas de IA generalistas fabrican "propósito" de plantilla: frases inspiradoras sin un solo dato. Eso hoy resta: clientes, licitaciones y financiación piden pruebas.',
    publica: [
      { title: 'Acción social empresarial con datos', body: 'Qué proyecto, con qué entidad, cuánto y qué cambió. Lo que se puede llevar a una memoria ESG.' },
      { title: 'Producto y servicio, sin dejar de vender', body: 'El propósito no sustituye al negocio. Se publica lo que vendéis, con la voz de la marca.' },
      { title: 'Equipo y forma de trabajar', body: 'Contratación, conciliación, proveedores locales. Lo que diferencia a la empresa cuando el precio es igual.' },
      { title: 'Alianzas con el tercer sector', body: 'Contadas desde la entidad social, no desde la foto del cheque.' },
    ],
    nunca: [
      'Afirmaciones de sostenibilidad o impacto sin dato ni fuente.',
      'Usar a la entidad social o a sus beneficiarios como decorado.',
      'Causas de moda ajenas a lo que la empresa hace de verdad.',
      'Contenido que comprometa a la marca en polémicas que no ha elegido.',
    ],
    mes: [
      'Semana 1: producto o servicio, contado desde para quién y por qué.',
      'Semana 2: un proyecto social o ambiental, con el dato del mes.',
      'Semana 3: equipo, proveedor o cliente que explica cómo trabajáis.',
      'Semana 4: alianza o resultado, con la entidad social como protagonista.',
    ],
    plan: { nombre: 'Crecimiento', precio: '390', porQue: 'Una empresa necesita presencia diaria en LinkedIn y en la red donde estén sus clientes, y un informe mensual que la dirección pueda usar en su memoria de RSC.' },
    faqs: [
      { q: '¿Esto sirve para vender o solo para la imagen?', a: 'Para las dos cosas. El calendario mezcla producto, equipo y propósito porque es lo que hace creíble a la marca. El informe mensual mide alcance y contactos que llegan por redes.' },
      { q: '¿Qué es la acción social empresarial?', a: 'La ASE es lo que una empresa hace por su entorno más allá de su actividad: proyectos con entidades sociales, contratación inclusiva, compra local. Startidea la diseña y la comunica desde 2011.' },
      { q: '¿Sirve para la memoria ESG o de sostenibilidad?', a: 'Sí. Todo lo publicado queda en un informe mensual con datos y fuentes, y las piezas se redactan para que se puedan reutilizar en la memoria anual.' },
      { q: '¿Y si ya tenemos agencia de marketing?', a: 'Se convive. Startidea lleva la parte de propósito, RSC y alianzas, o la totalidad de las redes si la agencia solo hace campañas. Se acuerda en la demo.' },
    ],
    enlaces: [
      { label: 'Empresas con propósito', href: '/para-quien/empresas' },
      { label: 'Programa de RSC', href: '/impulsa' },
      { label: 'Financiación para empresas', href: '/financiacion-empresas' },
    ],
  },
};
