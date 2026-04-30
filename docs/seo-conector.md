# Conector SEO — GA4 + Search Console

Conector interno que lee datos reales de **Google Analytics 4** y **Google Search Console** vía OAuth 2.0 (sin contraseñas, sin scraping), los persiste en SQLite, y genera oportunidades SEO accionables.

## Stack

- TypeScript dentro del repo Astro existente
- `googleapis` (cliente oficial Google)
- `better-sqlite3` (DB en `data/seo.db`)
- AES-256-GCM (`node:crypto`) para cifrar `refresh_token`
- Auth admin reutilizando `ADMIN_TOKEN`

## Arquitectura

```
src/lib/seo/
├── auth.ts                       requireAdmin() — middleware token
├── crypto.ts                     encrypt/decrypt AES-256-GCM
├── db.ts                         SQLite + 7 tablas
├── GoogleOAuthService.ts         OAuth: authUrl/exchange/getOAuthClient/revoke
├── GA4Service.ts                 listProperties + syncDailyMetrics
├── SearchConsoleService.ts       listSites + syncDailyQueries/Pages
└── SeoOpportunityService.ts      analyze() — 10 reglas

src/pages/admin/google/
├── connect.ts                    GET → redirect a Google con state CSRF
├── callback.ts                   GET → intercambia code, persiste cifrado
├── status.astro                  UI cuentas conectadas
└── disconnect.ts                 POST → revoca + marca

src/pages/admin/seo/
├── index.astro                   panel oportunidades + acciones
├── sync.ts                       POST/GET → descarga + analiza
└── report.ts                     GET → CSV con filtros
```

## Paso 1 · Google Cloud Console

### 1.1 Crear proyecto
1. https://console.cloud.google.com/ → "Select a project" → "New Project"
2. Name: `Startidea SEO Connector`
3. Crear

### 1.2 Activar APIs
**APIs & Services → Library**:
- **Google Analytics Data API** → Enable
- **Google Search Console API** → Enable
- **Google Analytics Admin API** → Enable (para listar propiedades)

### 1.3 OAuth consent screen
**APIs & Services → OAuth consent screen**:
- User Type: **External**
- App name: `Startidea SEO`
- Support email: hola@startidea.es
- Scopes: marca `analytics.readonly` y `webmasters.readonly`
- Test users: añade tu email Google (el dueño de las propiedades)

### 1.4 Credenciales OAuth Web
**APIs & Services → Credentials → Create credentials → OAuth client ID**:
- Application type: **Web application**
- Name: `Startidea SEO Web`
- **Authorized JavaScript origins**: `https://startidea.es`
- **Authorized redirect URIs**: `https://startidea.es/admin/google/callback`
- Create → copia **Client ID** y **Client Secret**

## Paso 2 · Variables en Coolify Secrets

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://startidea.es/admin/google/callback
APP_ENCRYPTION_KEY=<openssl rand -base64 32>
ADMIN_TOKEN=<ya configurado>
```

> **APP_ENCRYPTION_KEY**: si la cambias, todos los `refresh_token` cifrados quedan ilegibles → habrá que reconectar las cuentas Google.

## Paso 3 · Persistent Volume en Coolify

Sin volumen, cada redeploy borra `data/seo.db`. En Coolify → app `startidea-web`:

- **Persistent Volumes** → Add
- Name: `seo-data`
- Mount Path: `/app/data`

Después: variable adicional `SEO_DB_PATH=/app/data/seo.db` (opcional, default ya apunta a `./data/seo.db`).

## Paso 4 · Conectar y sincronizar

1. https://startidea.es/admin/google/status?token=ADMIN_TOKEN
2. Click **"Conectar cuenta Google"** → autoriza scopes → vuelves con ✅
3. https://startidea.es/admin/seo?token=ADMIN_TOKEN
4. Click **"Sincronizar ahora"** (primera vez tarda 30-60s — descarga 28 días de GA4 + GSC)
5. Tras la sync, la tabla muestra oportunidades. Botón **"Exportar CSV"** descarga.

## Endpoints disponibles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/google/connect` | ADMIN_TOKEN | inicia OAuth |
| GET | `/admin/google/callback` | ADMIN_TOKEN | recibe code Google |
| GET | `/admin/google/status` | ADMIN_TOKEN | UI cuentas |
| POST | `/admin/google/disconnect` | ADMIN_TOKEN | revoca conexión |
| GET | `/admin/seo` | ADMIN_TOKEN | panel oportunidades |
| GET/POST | `/admin/seo/sync` | ADMIN_TOKEN | descarga + analiza |
| GET | `/admin/seo/report?kind=...&priority=...` | ADMIN_TOKEN | CSV |

## Sync programada (cron diaria)

Para que se ejecute cada noche, añade en cron de Coolify (o cron del VPS):

```
30 6 * * * curl -s "https://startidea.es/admin/seo/sync?token=ADMIN_TOKEN"
```

## Reglas de oportunidad (SeoOpportunityService)

| Kind | Detección | Prioridad por defecto |
|---|---|---|
| `p4_20` | Keywords pos 4-20 con ≥50 imp | 1 si pos<11, sino 2 |
| `low_ctr` | Pages con CTR < 60% del esperado | 1 si imp>1000, sino 2 |
| `traffic_drop` | Pages con clicks < 60% de ventana anterior | 1 si caída ≥50% |
| `growing_imp` | Pages con impresiones +40% pero <15 clicks | 2 |
| `cannibalization` | Query con ≥3 URLs compitiendo | 1 si ≥5 URLs |
| `low_conv` | Page GA4 con >200 users y conv < 0.5% | 1 si users>1000 |
| `high_conv_low_traffic` | Page GA4 con conv ≥3% y 30-300 users | 1 |
| `content_gap` | Query con ≥100 imp y pos>20 | 2-3 |
| `title_meta` | Query top10 con CTR < 50% del esperado | 2 |
| `internal_linking` | Page con ≥200 imp y pos>20 | 3 |

## Seguridad

- **No se piden contraseñas Google** — solo OAuth
- **No hay scraping** — solo APIs oficiales
- **`refresh_token` cifrado** AES-256-GCM en DB
- **Endpoints `/admin/*` y `/api/*`** bloqueados en `robots.txt`
- **Sitemap excluye `/admin/`**
- **`.env` no se sube al repo** (`.gitignore`)
- **Headers de seguridad** vía middleware (HSTS, X-Frame, X-Content, Referrer, Permissions)
- **Desconexión disponible** desde `/admin/google/status` → revoca tokens en Google
- **Revocación manual**: https://myaccount.google.com/permissions → buscar app → Quitar acceso

## Checklist final de pruebas

Después de Force Redeploy con secrets configurados:

- [ ] `/admin/seo` con token correcto → muestra panel
- [ ] `/admin/seo` sin token → pide token
- [ ] `/admin/seo` con token incorrecto → no muestra contenido
- [ ] `/admin/google/connect` redirige a Google
- [ ] Tras autorizar, vuelvo a `/admin/google/status?ok=1`
- [ ] La cuenta aparece en la lista de conexiones
- [ ] `/admin/seo/sync` (POST) responde JSON con `ok: true` y `runId`
- [ ] Tras sync, la tabla `/admin/seo` muestra oportunidades
- [ ] `/admin/seo/report` descarga CSV con encoding UTF-8
- [ ] `/admin/google/disconnect` (POST) → la cuenta desaparece de la lista
- [ ] Tras disconnect, `/admin/seo/sync` falla con error claro
- [ ] El `data/seo.db` persiste tras `Force Redeploy` (Persistent Volume montado OK)
- [ ] Logs Coolify NO contienen tokens en plain (cifrado funciona)

## Limitaciones conocidas

- La detección de **canibalización** es aproximada (GSC no expone query+page simultáneamente al granular requerido) — sirve como pista, no diagnóstico definitivo.
- **CTR benchmark** por posición es orientativo (estudios públicos del sector). Puedes ajustar `CTR_BENCHMARK` en `SeoOpportunityService.ts`.
- **Ventana de análisis**: 28 días recientes vs 28 anteriores para detectar caídas. Cambiar en `SeoOpportunityService.ts`.
- **Limit GA4**: 50.000 filas por request (paginado). Suficiente para webs medianas.
- **Limit GSC**: 25.000 filas por request, paginado hasta 250.000 por safety.
