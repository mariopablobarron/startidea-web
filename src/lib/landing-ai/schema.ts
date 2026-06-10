// Schema de la landing generada por el modelo.
// El modelo debe devolver un JSON que cumpla esta forma — si no lo hace,
// Zod lo rechaza y devolvemos 502 al cliente.
//
// Diseño: lo justo para una landing convincente (hero + 2-6 secciones
// + CTA cierre). Sin imágenes en MVP (Claude no genera; se añade después
// con un proveedor distinto).
import { z } from 'astro:content';

export const audienceEnum = z.enum([
  'tercer-sector',
  'instituciones',
  'empresas-con-proposito',
]);

export const ctaSchema = z.object({
  text: z.string().min(2).max(40),
  href: z.string().min(1).max(120),
});

export const featureGridSchema = z.object({
  kind: z.literal('feature-grid'),
  title: z.string().min(3).max(80),
  intro: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(2).max(60),
        body: z.string().min(10).max(300),
      }),
    )
    .min(2)
    .max(6),
});

export const ctaBlockSchema = z.object({
  kind: z.literal('cta-block'),
  title: z.string().min(3).max(80),
  body: z.string().min(10).max(400),
  cta: ctaSchema,
});

export const faqsSchema = z.object({
  kind: z.literal('faqs'),
  title: z.string().min(3).max(60),
  items: z
    .array(
      z.object({
        q: z.string().min(5).max(120),
        a: z.string().min(10).max(400),
      }),
    )
    .min(2)
    .max(8),
});

export const quoteSchema = z.object({
  kind: z.literal('quote'),
  text: z.string().min(20).max(300),
  author: z.string().max(80).optional(),
});

export const sectionSchema = z.discriminatedUnion('kind', [
  featureGridSchema,
  ctaBlockSchema,
  faqsSchema,
  quoteSchema,
]);

export const landingSchema = z.object({
  meta: z.object({
    title: z.string().min(5).max(80),
    description: z.string().min(20).max(200),
    audience: audienceEnum,
    goal: z.string().min(3).max(80),
  }),
  hero: z.object({
    eyebrow: z.string().min(2).max(40),
    headline: z.string().min(5).max(100),
    // Trozo de la headline que se renderiza en magenta cursiva.
    // Debe aparecer literal dentro de headline.
    headlineAccent: z.string().min(2).max(40),
    subtitle: z.string().min(20).max(300),
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema.optional(),
  }),
  sections: z.array(sectionSchema).min(2).max(6),
  closingCta: z.object({
    title: z.string().min(5).max(80),
    body: z.string().min(10).max(300),
    primaryCta: ctaSchema,
  }),
});

export type Landing = z.infer<typeof landingSchema>;
export type Audience = z.infer<typeof audienceEnum>;
