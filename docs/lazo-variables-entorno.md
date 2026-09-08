# Lazo — variables de entorno

Todas son **opcionales**: sin ellas, Lazo funciona con los valores por defecto. Viven en el
`.env` del container (Coolify), nunca en el repo. Pendiente reflejarlas como placeholders en
`.env.example` (los agentes no pueden editar ficheros `.env*`; lo hace Mario a mano).

| Variable | Qué hace | Por defecto |
|---|---|---|
| `OPENROUTER_API_KEY` | Clave única para todos los modelos (ya existente). Sin ella, Lazo responde con el guion de respaldo, no hay regalos ni resumen por correo. | — |
| `MODELO_CHARLA` | Modelo de la conversación del hero (`/api/plano/charla`). | `pickModel('default')` = Haiku 4.5 |
| `MODELO_REGALOS` | Modelo de los regalos (post, LinkedIn, canción, informe SEO). | `pickModel('redaccion')` = Sonnet 4.5 |
| `MODELO_RESUMEN` | Modelo del resumen por correo. | `pickModel('default')` = Haiku 4.5 |
| `MODELO_PLANO` | Modelo del clasificador de intención de `/api/plano` (ruta rápida). | `pickModel('clasificacion')` = Haiku 4.5 |
| `PLANO_EMBEDDINGS` | `on` activa la búsqueda semántica en los documentos subidos (llamada extra por turno). | desactivado (solo FTS) |
| `MODELO_EMBEDDING` | Modelo de embeddings cuando `PLANO_EMBEDDINGS=on`. | `openai/text-embedding-3-small` |
| `PLANO_REGALOS` | `on` muestra y activa los regalos (creatividad, LinkedIn, canción, informe SEO). Apagados desde el 2026-09-08 a petición de Mario. | apagado |
| `PLANO_REGALOS_POR_IP` | Regalos por IP y día (solo con `PLANO_REGALOS=on`). | `2` |
| `PLANO_REGALOS_DIA` | Tope global de regalos al día (coste). | `150` |
| `PLANO_RESUMENES_DIA` | Tope global de resúmenes por correo al día. | `100` |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` | Correo del resumen (ya existentes). Sin `RESEND_API_KEY` el resumen se muestra en pantalla y no se envía. | — |
| `HUB_INTAKE_URL`, `HUB_INTAKE_SECRET` | Alta del contacto en el CRM del HUB (ya existentes). | — |
| `EXPEDIENTES_DIR` | Carpeta de las bases SQLite (`plano.db`, `knowledge.db`) y de los documentos subidos. | `/data/expedientes` |

Bloque sugerido para `.env.example`:

```
# Lazo (IA conversacional del plano) — todo opcional
MODELO_CHARLA=
MODELO_REGALOS=
MODELO_RESUMEN=
MODELO_PLANO=
PLANO_EMBEDDINGS=
MODELO_EMBEDDING=
PLANO_REGALOS=
PLANO_REGALOS_POR_IP=
PLANO_REGALOS_DIA=
PLANO_RESUMENES_DIA=
# Búsqueda de convocatorias en vivo (src/lib/tavily.ts)
TAVILY_API_KEY=
```
