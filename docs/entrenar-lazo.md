# Entrenar a Lazo con documentos

Lazo (la IA del Plano Startidea y del chat de startidea.es) responde con dos capas de conocimiento:

1. **Identidad base**: las fichas `.md` de `src/content/knowledge/`. Van en el repo, se cargan enteras en cada prompt y definen quién es Startidea, cómo habla y qué ofrece. Siguen mandando.
2. **Documentos de apoyo**: lo que se sube desde `/admin/knowledge` («Entrenar a Lazo con documentos»). Se extrae el texto, se trocea (≈900 caracteres, con solape) y se indexa en `knowledge.db` (FTS5; embeddings solo si se activan, ver abajo). En cada turno del chat se recuperan como mucho 6 fragmentos relevantes al último mensaje y se inyectan como DATOS, no como instrucciones.

## Qué subir

- Dossieres de servicio y propuestas tipo (sin datos de clientes concretos).
- Casos de éxito **autorizados** por el cliente para contarse en público.
- El método de trabajo, guiones de diagnóstico, FAQ de ventas y objeciones habituales.
- Tarifas orientativas y condiciones generales.
- Formatos: PDF (con capa de texto; un escaneo sin OCR no sirve), DOCX, TXT, MD, CSV, XLSX/XLS (máx. 3 hojas).

## Qué no subir

- **Ningún documento interno de estrategia ni de planificación**: lo que entra aquí puede acabar en una respuesta pública del chat.
- Contratos, facturas o expedientes con datos de terceros (nombres, NIF, importes de clientes).
- Contraseñas, accesos, claves API o tokens en cualquier formato.

## Límites y cómo probar

- Hasta 8 ficheros por subida, 15 MB por fichero, 40 MB por petición; 300.000 caracteres de texto por documento.
- La subida exige la cabecera `Content-Length` (el navegador y `curl` la mandan siempre). Sin ella el endpoint responde 411 antes de leer nada.
- Tras subir, usa el **buscador de prueba** de la misma página (`?q=...`): muestra los fragmentos que Lazo recibiría para esa pregunta, con su puntuación. Si no aparece lo esperado, el documento no tiene texto legible o la pregunta no comparte términos con él.
- Si algún fichero falla, el aviso de la página dice cuál y por qué (extensión no admitida, tamaño, sin texto legible). Los errores de sesión, origen o tamaño total también se muestran como frase en la página.
- Borrar un documento lo saca del índice al instante; los originales viven en `EXPEDIENTES_DIR/knowledge/<id>/`.

## Búsqueda semántica (embeddings): desactivada por defecto

Por defecto Lazo busca **solo por texto** (BM25 sobre FTS5 con diacríticos plegados: «subvencion» encuentra «subvención»). Funciona bien en español y no hace ninguna llamada externa.

La búsqueda semántica (vectores + fusión por rango recíproco) es opcional y se activa **solo de forma explícita**:

1. En el `.env` del container (Coolify → Secrets): `PLANO_EMBEDDINGS=on`. Cualquier otro valor, o la variable ausente, la deja apagada.
2. Hace falta `OPENROUTER_API_KEY` (la misma del chat). Opcional: `MODELO_EMBEDDING` (por defecto `openai/text-embedding-3-small`).
3. Reiniciar el container. La página `/admin/knowledge` muestra «Búsqueda semántica: activada» cuando está en marcha.

Qué cambia al activarla:

- **Al subir**: cada documento lanza en segundo plano una llamada a OpenRouter por cada lote de 32 trozos. La columna «Embebido: sí» aparece cuando todos sus trozos tienen vector. Si la llamada falla, el documento queda indexado por texto y los vectores se reintentan en la siguiente subida de ese mismo documento.
- **En cada turno del chat**: la pregunta de la persona se manda a OpenRouter para calcular su vector (timeout 6 s; si falla, se sigue con texto). Es decir, cada mensaje del chat genera una petición externa adicional y su latencia.
- **Coste**: `text-embedding-3-small` cuesta del orden de 0,02 USD por millón de tokens (≈ 4 millones de caracteres) — un documento de 300.000 caracteres sale por menos de un céntimo, y una pregunta de chat, por una fracción de milésima. Comprobar el precio vigente en openrouter.ai/models antes de activarla; el gasto aparece en el panel de OpenRouter bajo el título «Startidea Plano · documentos».
- **Documentos ya subidos** antes de activarla no tienen vectores: hay que borrarlos y volver a subirlos para que se embeban.

Para volver a solo texto: quitar `PLANO_EMBEDDINGS` (o ponerlo a `off`) y reiniciar. Los vectores guardados no molestan; simplemente no se consultan.
