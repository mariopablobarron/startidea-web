import { defineCollection, z } from 'astro:content';

const notas = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    audience: z.enum(['Tercer sector', 'Instituciones', 'Empresas con propósito', 'Todas']).default('Todas'),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(), // ruta a imagen en /public
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
    author: z.string().default('Mario P. Barrón'),
    authorRole: z.string().default('Fundador · Startidea'),
  }),
});

export const collections = { notas };
