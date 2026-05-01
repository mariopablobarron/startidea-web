# Lead magnet — Diagnóstico modelo de fundraising

Cómo generar el PDF descargable y subirlo a producción.

## Generar el PDF (proceso manual, una sola vez)

El HTML de origen es **`public/recursos/diagnostico-modelo-fundraising.html`**. Es un documento de 12 páginas con tipografía y maquetación lista para imprimir a PDF directamente desde el navegador. No usa Puppeteer ni librerías pesadas — el render lo hace el motor de impresión de Chrome.

### Pasos

1. Abrir en Chrome o Edge la URL local:
   ```
   file:///Users/STARTIDEA/web%20de%20startidea/public/recursos/diagnostico-modelo-fundraising.html
   ```
   (o, una vez deployado, `https://startidea.es/recursos/diagnostico-modelo-fundraising.html`)

2. `Cmd/Ctrl + P` para abrir el diálogo de impresión.

3. Configurar:
   - **Destino**: Guardar como PDF
   - **Páginas**: Todas
   - **Diseño**: Vertical
   - **Tamaño de papel**: A4
   - **Márgenes**: Predeterminados (el HTML ya define los suyos)
   - **Escala**: Predeterminada (100%)
   - **Encabezados y pies**: ❌ desactivado
   - **Gráficos de fondo**: ✅ activado (importante — sin esto se pierde el color magenta y los fondos warm)

4. Guardar como **`diagnostico-modelo-fundraising.pdf`** en `public/recursos/`.

5. El archivo final debe pesar entre 600 KB y 1.2 MB. Si pesa más de 2 MB, reabrir el HTML, comprobar que no se haya colado una imagen sin optimizar y reimprimir.

### Verificación

```bash
ls -lh public/recursos/diagnostico-modelo-fundraising.pdf
```

Abrir el PDF y revisar:
- 12 páginas (portada + 11 contenido)
- Tipografía Montserrat correcta
- Magenta `#c12d7a` visible
- Mezcla de ingresos en barras horizontales
- Tabla de palancas con columnas Esfuerzo / Impacto
- Tabla de métricas con baseline → target
- Página final dark (CTA)

## Subir a producción

```bash
git add public/recursos/diagnostico-modelo-fundraising.pdf
git commit -m "feat(s2): añadido PDF binario del diagnóstico"
git push origin main
```

El push dispara el redeploy automático en Coolify (si auto-deploy está activo). Si no, hacer Force Redeploy manualmente.

## Verificar el flujo end-to-end

1. Ir a `https://startidea.es/recursos/diagnostico-modelo-fundraising`.
2. Rellenar el form con un email de prueba (no el habitual, para ver la notificación Telegram limpia).
3. Submit → debería redirigir a `/recursos/gracias?slug=diagnostico-modelo-fundraising`.
4. Click "Descargar PDF" → debería descargar el archivo.
5. Comprobar Telegram: llega notificación con `📥 Lead magnet solicitado` con los datos.
6. Si el checkbox de newsletter estaba marcado y `BUTTONDOWN_API_KEY` está configurada en Coolify, el email queda suscrito con tag `lead-magnet:diagnostico-modelo-fundraising`.

## Variables de entorno relevantes (Coolify)

- `TELEGRAM_BOT_TOKEN` — ya configurada (compartida con `/api/contacto`).
- `TELEGRAM_CHAT_ID` — ya configurada.
- `BUTTONDOWN_API_KEY` — **opcional**. Si no está, el lead no se suscribe pero el flujo no rompe (warning en logs).

## Iterar el PDF

Para futuras versiones del diagnóstico (otro caso anonimizado), duplicar:

- `public/recursos/diagnostico-modelo-fundraising.html` → `public/recursos/[nuevo-slug].html`
- `src/pages/recursos/diagnostico-modelo-fundraising.astro` → `src/pages/recursos/[nuevo-slug].astro`
- En `src/pages/api/recursos/solicitar.ts`, añadir entrada en `RECURSOS`:
  ```typescript
  '[nuevo-slug]': {
    titulo: '[Título]',
    pdfUrl: '/recursos/[nuevo-slug].pdf',
  },
  ```
- En `src/pages/recursos/gracias.astro`, añadir entrada en el `RECURSOS` local.
- En `src/components/RecursosHome.astro`, añadir nuevo objeto al array `recursos`. Cuando haya 3+ se muestra como grid de 3 columnas en home.
