import { defineCollection, z } from 'astro:content';

const notas = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
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
    title: z.string(),
    description: z.string(),
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

export const collections = { notas, diagnosticos, knowledge, cursos };
