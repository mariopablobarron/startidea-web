# Security headers vía Traefik (en lugar del middleware Astro)

## Por qué

El `src/middleware.ts` añade 6 cabeceras de seguridad (HSTS, CSP, x-frame, etc.)
pero **NO se ejecuta en páginas pre-renderizadas** porque `astro.config.mjs` está
en `output: 'static'`. Astro sirve los `.html` ya generados sin pasar por el
middleware. Solo aplican en rutas SSR (`prerender = false`).

Resultado verificado en producción (2026-05-28):
- `/precios`, `/admin`, `/sobre`, mayoría de páginas → **sin headers** ❌
- `/subvenciones/presentar/nuevo` (SSR) → algunas headers ✓

## Solución más limpia: añadir las headers en Traefik

Traefik se ejecuta delante del container startidea-web y puede inyectar headers
en TODAS las respuestas (estáticas y SSR), sin tocar el código Astro.

### Opción A — Coolify UI (recomendada, 3 minutos)

1. Entrar a `https://coolify.startidea.es`
2. Ir a la aplicación **`startidea-web`**
3. Pestaña **Network** o **Labels** (depende de la versión de Coolify)
4. Añadir estos labels Traefik a la app:

```yaml
- traefik.http.middlewares.startidea-security.headers.stsSeconds=31536000
- traefik.http.middlewares.startidea-security.headers.stsIncludeSubdomains=true
- traefik.http.middlewares.startidea-security.headers.contentTypeNosniff=true
- traefik.http.middlewares.startidea-security.headers.referrerPolicy=strict-origin-when-cross-origin
- traefik.http.middlewares.startidea-security.headers.customResponseHeaders.X-Frame-Options=SAMEORIGIN
- traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Permissions-Policy=geolocation=(),camera=(),microphone=(),payment=()
- traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Cross-Origin-Opener-Policy=same-origin
- traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Cross-Origin-Resource-Policy=same-origin
- traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Content-Security-Policy=default-src 'self'; script-src 'self' 'unsafe-inline' https://analytics.hubstartidea.es; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://analytics.hubstartidea.es; form-action 'self' https://buttondown.email; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests
- traefik.http.routers.startidea-web.middlewares=startidea-security@docker
```

5. Aplicar / Save / Redeploy (Coolify aplica los labels al recrear el container)

### Opción B — Edición directa del docker-compose en VPS

Si Coolify no expone labels custom en UI, editar a mano:

```bash
ssh root@72.61.195.108
cd /docker/startidea-web-traefik/
# editar docker-compose.yml y añadir bajo el container startidea-web → labels:
nano docker-compose.yml
# Aplicar:
docker compose up -d --force-recreate --no-deps startidea-web
```

Bloque exacto a añadir a `labels:` del servicio `startidea-web`:

```yaml
  - "traefik.http.middlewares.startidea-security.headers.stsSeconds=31536000"
  - "traefik.http.middlewares.startidea-security.headers.stsIncludeSubdomains=true"
  - "traefik.http.middlewares.startidea-security.headers.contentTypeNosniff=true"
  - "traefik.http.middlewares.startidea-security.headers.referrerPolicy=strict-origin-when-cross-origin"
  - "traefik.http.middlewares.startidea-security.headers.customResponseHeaders.X-Frame-Options=SAMEORIGIN"
  - "traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Permissions-Policy=geolocation=(), camera=(), microphone=(), payment=()"
  - "traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Cross-Origin-Opener-Policy=same-origin"
  - "traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Cross-Origin-Resource-Policy=same-origin"
  - "traefik.http.middlewares.startidea-security.headers.customResponseHeaders.Content-Security-Policy=default-src 'self'; script-src 'self' 'unsafe-inline' https://analytics.hubstartidea.es; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://analytics.hubstartidea.es; form-action 'self' https://buttondown.email; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests"
  - "traefik.http.routers.startidea-web.middlewares=startidea-security@docker"
```

⚠️ Cuidado:
- El router puede llamarse distinto (revisar el bloque actual: si pone `traefik.http.routers.<nombre>` ese es el nombre exacto)
- Si ya hay `routers.X.middlewares=Y@docker`, añadir el nuestro al final con coma: `Y,startidea-security@docker`

## Verificación post-deploy

```bash
curl -sSI https://startidea.es/precios | grep -iE "strict|frame|content-security|referrer|permissions|cross-origin|nosniff"
```

Esperado:
```
strict-transport-security: max-age=31536000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; …
permissions-policy: geolocation=(), camera=(), microphone=(), payment=()
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: same-origin
```

No activar `Cross-Origin-Embedder-Policy` sin una auditoría previa de analítica,
embeds y recursos externos. Puede romper recursos de terceros si no devuelven
sus propias cabeceras compatibles.

## Después de aplicar — limpiar middleware Astro

Una vez confirmado que Traefik añade los headers, el middleware Astro queda
redundante en páginas SSR. Puedes:

1. **Dejarlo** — no daña (Traefik no sobrescribe si la app ya pone el header)
2. **Eliminarlo** — `rm src/middleware.ts` y commit. Beneficio: -68 líneas, no
   confunde en el futuro

Recomendado: dejarlo unos días tras el cambio Traefik para tener "doble red",
luego eliminar.

## Por qué NO migré a `output: 'server'`

Convertir todo a SSR habría aumentado el coste por petición (cada request
ejecuta Node en lugar de servir estático) y el riesgo (un bug del server
tumba TODO en lugar de solo páginas SSR). La gran mayoría de páginas de
Startidea son contenido (notas, casos, manifiesto) que NO necesitan SSR.

Por eso la opción "headers en Traefik" es la correcta — mantener Astro
estático y delegar las headers al proxy.
