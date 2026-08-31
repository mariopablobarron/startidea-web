import { defineCollection, z } from 'astro:content';

const notas = defineCollection({
  type: 'content',
  schema: z.object({
    // OJO: `title` también se pinta VISIBLE como H1 de la nota, así que se
    // escribe pensando en el lector, no en el SERP. Para el <title> está
    // `seoTitle`: Google corta alrededor de los 60 caracteres y el layout
    // añade su propio sufijo, así que un H1 largo se trunca siempre.
    title: z.string(),
    // Título del SERP. Solo afecta al <title>; el H1 se queda como está.
    // El máximo cuenta con que el layout añade ' · Startidea' (12 car.).
    seoTitle: z.string().min(20).max(48).optional(),
    // OJO: `description` cumple DOS funciones — se renderiza VISIBLE como
    // entradilla al inicio de la nota y, por defecto, es la meta description.
    // Como entradilla puede (y suele) pasar de 300 caracteres, longitud a la
    // que Google trunca el snippet por la mitad. Para separar ambos usos está
    // `metaDescription`: si se define, manda en el <meta> y en el JSON-LD, y
    // la entradilla visible se queda intacta.
    description: z.string(),
    // Snippet del SERP. Solo afecta al <meta name="description"> y al
    // BlogPosting. El máximo es duro a propósito: Google corta ~155-160.
    metaDescription: z.string().min(80).max(158).optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    audience: z.enum(['Tercer sector', 'Instituciones', 'Empresas con propósito', 'Todas']).default('Todas'),
    category: z.enum(['Comunicación', 'Financiación', 'Estrategia', 'Agencia']).optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
    author: z.string().default('Mario Pablo Sánchez Barrón'),
    authorRole: z.string().default('Fundador · Startidea'),
    // Respuesta corta (TL;DR) opcional. Si se define, se renderiza
    // destacada al inicio de la nota: es lo que los motores de IA
    // (AI Overviews, Perplexity, ChatGPT) extraen como respuesta directa.
    tldr: z.string().min(40).max(600).optional(),
    // FAQs opcionales. Si se definen, /notas/[slug] genera JSON-LD
    // FAQPage adicional → activa Featured Snippets en Google + sube CTR.
    faqs: z
      .array(
        z.object({
          question: z.string().min(5).max(200),
          answer: z.string().min(20).max(800),
        }),
      )
      .max(8)
      .optional(),
  }),
});

const diagnosticos = defineCollection({
  type: 'content',
  schema: z.object({
    // Mismo reparto de papeles que en `notas` (ver arriba): `title` y
    // `description` son lo que lee la persona; `seoTitle` y `metaDescription`
    // son lo que ve Google. Los títulos de esta serie son largos a propósito
    // —llevan el ángulo del caso tras el "·"— y con el sufijo del layout se
    // iban a 107-118 caracteres, así que se truncaban los 12.
    title: z.string(),
    seoTitle: z.string().min(20).max(48).optional(),
    // `description` se pinta VISIBLE como entradilla del diagnóstico y ronda
    // los 200-295 caracteres: el doble de lo que Google muestra.
    description: z.string(),
    metaDescription: z.string().min(80).max(158).optional(),
    pubDate: z.coerce.date(),
    sector: z.enum([
      'Cooperación internacional',
      'Discapacidad',
      'Infancia y familia',
      'Mayores',
      'Migración y refugio',
      'Educación',
      'Salud',
      'Medio ambiente',
      'Cultura',
      'Igualdad y violencia de género',
      'Empleo e inserción',
      'Protección animal',
      'Multi-causa',
    ]),
    geografia: z.enum(['Local', 'Regional', 'Estatal', 'Internacional']),
    tipologia: z.enum(['Asociación', 'Fundación', 'Federación', 'Red estatal', 'Plataforma', 'Cooperativa']),
    tamaño: z.enum(['Pequeña (<300k€/año)', 'Mediana (300k-3M€/año)', 'Grande (3M-15M€/año)', 'Muy grande (>15M€/año)']),
    mezcla_ingresos: z.object({
      subvencion_publica: z.number().min(0).max(100),
      donantes_individuales: z.number().min(0).max(100),
      empresas: z.number().min(0).max(100),
      fundaciones_privadas: z.number().min(0).max(100).default(0),
      eventos_y_actividades: z.number().min(0).max(100).default(0),
      otros: z.number().min(0).max(100).default(0),
    }),
    edad_media_donante: z.number().int().optional(),
    base_social: z.number().int().optional(),
    duracion_diagnostico: z.string().default('6-8 semanas'),
    permitir_descarga: z.boolean().default(false),
    draft: z.boolean().default(false),
    author: z.string().default('Mario Pablo Sánchez Barrón'),
    authorRole: z.string().default('Fundador · Startidea'),
  }),
});

const knowledge = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

const cursos = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    // Formato de impartición
    formato: z.enum(['online', 'presencial', 'hibrido']),
    // Tipo de formación
    modalidad: z.enum(['taller', 'curso', 'masterclass', 'mentoria']),
    // Duración legible ("4 horas", "6 semanas", "3 sesiones de 90 min")
    duracion: z.string(),
    // Precio base en euros (sin IVA)
    precio: z.number().int().nonnegative(),
    // Precio reducido para entidades sin ánimo de lucro (opcional)
    precio_esfl: z.number().int().nonnegative().optional(),
    // Señal/depósito para reservar plaza (euros, sin IVA). Se descuenta del
    // total cuando la edición se confirma. Default 50 €.
    senal: z.number().int().positive().default(50),
    // Estado de la convocatoria
    estado: z.enum(['abierto', 'proximo', 'agotado', 'a-demanda']).default('proximo'),
    // Fecha de la próxima edición (opcional, si ya está fijada)
    proxima_edicion: z.coerce.date().optional(),
    // Público objetivo
    audience: z.string().default('Tercer sector y organizaciones con propósito'),
    // Categoría temática
    category: z.enum(['Comunicación', 'Financiación', 'Estrategia', 'Digital']).default('Comunicación'),
    tags: z.array(z.string()).default([]),
    // Imagen de portada (ruta desde /public)
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(true),
  }),
});

const herramientas = defineCollection({
  type: 'content',
  schema: z.object({
    // Nombre de la herramienta tal como se muestra (H1 de la ficha).
    title: z.string(),
    seoTitle: z.string().min(20).max(48).optional(),
    // Entradilla visible de la ficha y meta description por defecto.
    description: z.string(),
    metaDescription: z.string().min(80).max(158).optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // URL oficial de la herramienta.
    web: z.string().url(),
    // Para qué necesidad principal sirve (filtro del directorio).
    necesidad: z.enum([
      'Escribir y comunicar',
      'Diseñar y crear',
      'Analizar datos',
      'Automatizar',
      'Audio y vídeo',
      'Investigar',
      'Gestionar y organizar',
    ]),
    // Reutiliza las audiencias de la casa (mismo lenguaje que notas).
    audience: z.array(z.enum(['Tercer sector', 'Instituciones', 'Empresas con propósito', 'Todas'])).default(['Todas']),
    precio: z.enum(['Gratis', 'Freemium', 'De pago']),
    // Cuánto hay que saber para sacarle partido.
    nivel: z.enum(['Sin conocimientos', 'Intermedio', 'Técnico']),
    // Veredicto Startidea — el valor diferencial de la ficha.
    para_que_si: z.array(z.string()).min(1),
    para_que_no: z.array(z.string()).min(1),
    riesgos: z.array(z.string()).default([]),
    // Alternativa más abierta/europea/libre, si existe.
    alternativa: z.string().optional(),
    // Valoración editorial 1-5 según el criterio de docs/criterio-ia.md.
    // Se muestra como sello; la argumentación DSI completa es interna.
    valoracion: z.number().int().min(1).max(5),
    tags: z.array(z.string()).default([]),
    tldr: z.string().min(40).max(600).optional(),
    faqs: z
      .array(
        z.object({
          question: z.string().min(5).max(200),
          answer: z.string().min(20).max(800),
        }),
      )
      .max(8)
      .optional(),
    draft: z.boolean().default(false),
    author: z.string().default('Mario Pablo Sánchez Barrón'),
    authorRole: z.string().default('Fundador · Startidea'),
  }),
});

export const collections = { notas, diagnosticos, knowledge, cursos, herramientas };
