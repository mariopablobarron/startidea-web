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

export const collections = { notas, diagnosticos, knowledge };
