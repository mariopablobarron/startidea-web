# copiloto-sede — guía visual de sedes electrónicas (Fase 2a)

Microservicio Playwright que abre la sede electrónica de una convocatoria,
localiza el trámite y devuelve **capturas reales paso a paso** para la guía de
presentación del Copiloto de Subvenciones.

## Alcance y seguridad (importante)
- **Tramitación ASISTIDA, no autónoma.** Solo navega páginas **públicas** y hace
  screenshots. **NO** inicia sesión, **NO** rellena formularios, **NO** firma,
  **NO** presenta, **NO** resuelve CAPTCHAs.
- La firma (certificado / Autofirma / Cl@ve) y la presentación las hace **siempre
  la persona usuaria**.
- **No exponer a internet**: detrás de la red interna de Docker/Traefik y
  protegido por `COPILOTO_SEDE_TOKEN`.

## API
- `GET /health` → `{ ok: true }`
- `POST /guia-visual` (header `Authorization: Bearer $COPILOTO_SEDE_TOKEN`)
  ```json
  { "sedeKey": "junta-andalucia", "sedeUrl": "https://...", "convTitulo": "..." }
  ```
  Respuesta:
  ```json
  { "ok": true, "sede": "junta-andalucia",
    "pasos": [ { "titulo": "1 · Acceso a la sede", "imagen": "data:image/jpeg;base64,..." } ] }
  ```
  - `sedeKey` selecciona el driver específico; si no hay driver, usa el genérico.
  - Debe llegar `sedeUrl` (o un `sedeKey` con driver que la conozca).

## Variables de entorno
- `PORT` (def. 8080)
- `COPILOTO_SEDE_TOKEN` — token compartido con la web/HUB que llama al servicio.

## Local
```bash
cd infra/copiloto-sede
npm install
COPILOTO_SEDE_TOKEN=dev npm start
# en otra terminal:
curl -s -X POST localhost:8080/guia-visual -H 'Authorization: Bearer dev' \
  -H 'content-type: application/json' \
  -d '{"sedeKey":"junta-andalucia","sedeUrl":"https://www.juntadeandalucia.es/haciendayadministracionpublica/sede/","convTitulo":"subvenciones inclusion social"}' \
  | head -c 300
```

## Despliegue (Coolify, app SEPARADA — no en startidea-web)
1. Coolify → Create New Resource → Application.
2. Source: este repo, **Base Directory** `infra/copiloto-sede`, Dockerfile `Dockerfile`.
3. Env: `COPILOTO_SEDE_TOKEN` (genera uno).
4. **No** asignar dominio público (solo red interna). La web lo llama por el
   nombre de servicio Docker, p. ej. `http://copiloto-sede:8080`.

## Integración con startidea-web (siguiente paso)
- `src/lib/copiloto-sede.ts`: helper `fetchGuiaVisual(opts)` que hace POST al
  servicio (URL + token desde env `COPILOTO_SEDE_URL` / `COPILOTO_SEDE_TOKEN`).
- `/admin/expedientes/[id]` sección "Fase 2": botón "Generar guía visual" →
  llama al helper → renderiza `pasos[].imagen`. Persistir en `ai_fase2_guia`.

## Roadmap del driver
- Afinar selectores reales del buscador de trámites de la Junta (iteración en
  vivo). Luego: Ministerio de Derechos Sociales, resolver redirect de BDNS.
