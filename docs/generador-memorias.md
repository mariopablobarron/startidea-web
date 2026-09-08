# Generador de memorias y justificaciones

Plan de negocio público: `/laboratorio/productos/generador-memorias-justificaciones`.
Hito 1 entregado el 2026-09-08: plantillas de los tres documentos y carga guiada.

## Flujo

1. `/memorias` — landing con los tres tipos y la carga guiada (tipo, organización, periodo,
   financiador, qué hace, actividades, cifras, objetivos, dificultades, testimonios, tono).
2. `POST /api/memorias/crear` — valida (`parseCarga`), genera el **guion** con el modelo
   (`generarGuion`: índice, mensajes clave, datos destacados, preguntas), crea el pedido
   (`memoria_pedidos`, estado `guion`), envía email con el enlace y avisa por Telegram.
3. `/memorias/pedido?t=<manage_token>` — la organización revisa el guion.
4. `GET /api/memorias/checkout?t=` — Stripe Checkout de pago único (precio del tipo, códigos de
   promoción). El webhook (`kind=memoria`) marca `pagado` (idempotente).
5. `POST /api/memorias/generar` `{ token }` — solo pagado: `claimRedactando` (evita dobles clics),
   `generarDocumento` (Markdown con secciones fijas, cada cifra de lo cargado, `[COMPLETAR]` si falta),
   `cifrasNoRespaldadas` como verificación, estado `revision`, aviso a Startidea por Telegram y email.
6. `POST /api/memorias/aprobar` `{ id, notas? }` — admin (cookie del panel o `x-admin-token`):
   `entregado` + email a la organización. El documento se muestra en su pedido (leer, copiar, imprimir en PDF).

## Tipos y precios (sin IVA)

| Tipo | Precio | Secciones | Palabras |
|---|---|---|---|
| Justificación técnica de subvención | 150 € | 8 | 1.200-2.200 |
| Informe de impacto para financiador | 250 € | 8 | 1.500-2.800 |
| Memoria anual completa | 400 € | 10 | 2.500-4.500 |

Los precios y las secciones viven en `src/lib/memorias-engine.ts` (`MEMORIA_TIPOS`).

## Reglas de calidad

- El modelo no inventa cifras: el prompt lo prohíbe y `cifrasNoRespaldadas` compara cada número del
  documento con la carga; las no respaldadas se listan en el aviso de revisión.
- Revisión humana obligatoria antes de `entregado`; el cliente nunca ve el documento sin revisar.
- Modelos: guion con `pickModel('clasificacion')`, documento con `pickModel('redaccion')`.

## Pruebas

`npx vitest run src/lib/memorias-engine.test.ts` (10 casos: carga, guion, documento, verificación, HTML).

## Hito 2 (pendiente)

Subida de documentos (actas, hojas de cálculo, memorias anteriores) reutilizando `doc-extractor.ts`,
maquetación con la identidad de la organización (PDF) y panel admin de pedidos en `/admin`.
