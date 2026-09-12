# Radar de tendencias de Startidea

Primera version interna en `/admin/radar`, accesible con la sesion habitual de administracion. Entrada desde el panel principal.

## Uso editorial

1. Pulsa **Actualizar radar**. Google Trends aporta busquedas en Espana; Reddit, conversacion internacional. Un aviso distingue lectura completa, parcial y fallo total.
2. Revisa fecha, fuente, referencias y encaje con Startidea. Filtra por texto, fuente o estado. La lista muestra hasta 120 tendencias, priorizando pendientes y validadas.
3. Guarda **Validada** cuando haya una oportunidad editorial. Descarta los temas que no encajen.
4. Elige **Meme**, **Articulo** o **Contenido social** y pulsa **Generar borrador**. La propuesta incluye enfoque, idea de ejecucion, texto completo, llamada a la accion, tono, formatos y riesgos.
5. Contrasta y edita el texto fuera del radar. **Copiar texto** facilita trasladarlo al editor. Para regenerar, vuelve a guardar el estado Validada.
6. Tras una publicacion realizada fuera del radar, guarda **Publicacion registrada**. Es un registro manual: no envia contenido ni acredita alcance.

Los memes se entregan como concepto, composicion y texto. Esta version no renderiza imagenes ni videos. Los articulos conservan parrafos y subtitulos. Una tendencia con poco encaje puede dar como recomendacion no sumarse.

## Como interpretar las senales

- **Potencial 0-100:** heuristica logaritmica del volumen observado, ajustada por antiguedad. No es una probabilidad de viralidad ni una comparacion directa entre audiencias de ambas fuentes.
- **Encaje 0-100:** coincidencias tematicas en titulo y resumen. La IA propone el enfoque despues de validar la oportunidad.
- **Senal:** busquedas aproximadas en Google; votos mas comentarios ponderados en Reddit. Un dato ausente se queda en cero, nunca se inventa.
- **Cambio entre lecturas:** diferencia absoluta con la lectura anterior de la misma entrada. No es una tasa horaria ni una prediccion. La primera lectura no permite calcular un cambio. Google publica estimaciones por umbrales.
- Las fechas de origen y de lectura son distintas. Se avisa cuando el tema supera 48 horas. La prioridad cae si no se vuelve a observar.
- Google comparte un enlace RSS entre todas las entradas: la identidad usa tema y fecha, y las noticias relacionadas se conservan como referencias independientes.

## Configuracion y operacion

Se reutilizan `ADMIN_TOKEN`, el selector existente `pickModel('redaccion')`, `OPENROUTER_API_KEY` y el volumen `EXPEDIENTES_DIR`. Las tablas propias se crean dentro de `expedientes.db`; no se cambian tablas del Copiloto. El directorio predeterminado de este modulo es `/data/expedientes`: en local debe establecerse uno escribible.

`.env.example` documenta las variables opcionales `TREND_KEYWORDS` (separadas por comas) y `OPENROUTER_RADAR_MAX_TOKENS` (3000 por defecto, acotado a 1000-5000). Las capturas no llaman a la IA. Cada generacion solicitada si usa el proveedor y su facturacion existente; el radar no implementa un presupuesto mensual.

Sin conexion IA, la pantalla explica que se puede recoger y validar. La generacion requiere validacion editorial, impide dos solicitudes simultaneas para la misma tendencia y tiene un tiempo limite de 90 segundos. Ante error vuelve a Validada. Si el proceso se interrumpe, pasados tres minutos se puede recuperar manualmente guardando Validada.

El ejecutor `scripts/radar/run.mjs` lee el token del entorno, lo transforma al formato requerido por el panel y envia una captura. Por defecto apunta a `http://127.0.0.1:4321`; requiere `--base` explicito para otro destino. Se pueden usar `--max 20 --floor 10`. La cabecera de autenticacion no se imprime.

No hay cron activado en esta entrega. Programar capturas, ampliar fuentes a TikTok/Instagram/YouTube, generar imagenes, publicar y medir notoriedad son fases posteriores. La disponibilidad de Reddit depende del acceso que permita desde el servidor; su fallo se muestra y no invalida una lectura de Google.

## Validacion de esta entrega

Pruebas locales del parser, persistencia, controles de estado, endpoints y generador con respuestas simuladas. La captura funcional usa fuentes publicas reales y una base de datos temporal. El contenido de IA simulado solo sirve para comprobar el contrato, no para certificar calidad creativa ni una llamada real al proveedor.

La compilacion y el resultado final de pruebas se recogen en el relevo de la rama. No hay integracion ni despliegue de esta entrega acreditados.
