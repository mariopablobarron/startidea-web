import { describe, expect, it } from 'vitest';
import { courseSchema, FOUNDER_NAME, SITE_URL } from '../src/lib/jsonld';

const course = {
  url: `${SITE_URL}/laboratorio/cursos/ejemplo`,
  name: 'Curso de ejemplo',
  description: 'Descripción del curso',
  courseMode: 'online' as const,
};

describe('datos publicados en el esquema de cursos', () => {
  it('omite el docente por defecto y no inventa fechas ni ubicación', () => {
    const schema = courseSchema(course);

    expect(schema).not.toHaveProperty('instructor');
    expect(schema).not.toHaveProperty('courseMode');
    expect(schema.hasCourseInstance).toMatchObject({
      '@type': 'CourseInstance',
      courseMode: 'Online',
    });
    expect(schema.hasCourseInstance).not.toHaveProperty('instructor');
    expect(schema.hasCourseInstance).not.toHaveProperty('startDate');
    expect(schema.hasCourseInstance).not.toHaveProperty('location');
  });

  it('atribuye al fundador solo una docencia declarada explícitamente', () => {
    const schema = courseSchema({
      ...course,
      instructor: { name: FOUNDER_NAME, url: `${SITE_URL}/sobre#fundador` },
    });

    expect(schema).not.toHaveProperty('instructor');
    expect(schema.hasCourseInstance?.instructor).toEqual({
      '@type': 'Person',
      '@id': `${SITE_URL}/#founder`,
      name: FOUNDER_NAME,
      url: `${SITE_URL}/sobre#fundador`,
    });
  });

  it('no vincula a otro docente con la entidad del fundador', () => {
    const schema = courseSchema({ ...course, instructor: { name: 'Docente acreditado' } });

    expect(schema.hasCourseInstance?.instructor).toEqual({
      '@type': 'Person',
      name: 'Docente acreditado',
    });
  });

  it('retira la instancia y su oferta cuando la edición ha pasado, conservando el programa', () => {
    const schema = courseSchema({
      ...course,
      price: 320,
      startDate: '2026-09-19',
      instructor: { name: FOUNDER_NAME, url: `${SITE_URL}/sobre#fundador` },
      editionExpired: true,
    });

    expect(schema).not.toHaveProperty('offers');
    expect(schema).not.toHaveProperty('hasCourseInstance');
    expect(schema).toMatchObject({
      '@type': 'Course',
      name: course.name,
      description: course.description,
      url: course.url,
      provider: { '@id': `${SITE_URL}/#organization` },
    });
  });

  it('conserva la oferta de un curso sin edición fechada', () => {
    const schema = courseSchema({ ...course, price: 320 });

    expect(schema.offers).toMatchObject({ price: 320, priceCurrency: 'EUR' });
    expect(schema.hasCourseInstance).toMatchObject({ courseMode: 'Online' });
    expect(schema.hasCourseInstance).not.toHaveProperty('startDate');
  });
});
