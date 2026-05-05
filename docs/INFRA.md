# Infraestructura — startidea.es

Documento vivo. Si cambias algo del stack o las credenciales, actualízalo
aquí en el mismo commit. Si lees algo desactualizado, parchéalo y empuja.

## Resumen

```
DNS (IONOS)
   ↓
VPS Hostinger srv1456258 — 72.61.195.108 — KVM 4 — Ubuntu 24.04
   ├── Traefik (coolify-proxy) :80/:443  →  Let's Encrypt automático
   │     └── startidea-web (Astro Node SSR, image cmoh7d8hi…)
   ├── Coolify panel (v3.12.36)         :3000/tcp en red interna
   ├── hub-startidea-web (Next.js)
   └── otros: gtm-server, openclaw, acdp-odoo, luciernaga-ai, …
```

## Aplicación principal — startidea-web

- **Repo**: <https://github.com/mariopablobarron/startidea-web> (rama `main`)
- **Stack**: Astro 5 + `@astrojs/node` SSR + Tailwind 3
- **Image label en Coolify**: `cmoh7d8hi001bp2a4qwjobhzy:<git-sha>`
- **Container**: `startidea-web`
- **Ruta del compose generado**: `/docker/startidea-web-traefik/docker-compose.yml`
  (Coolify lo escribe en cada Deploy)
- **Healthcheck**: `wget http://127.0.0.1:4321/` cada 30 s
- **Backups del compose**: `/docker/startidea-web-traefik/docker-compose.yml.bak-…`

### Variables de entorno

**Fuente única**: `/docker/startidea-web-traefik/docker-compose.yml` en el
VPS. Las Secrets del panel Coolify estaban duplicadas y desincronizadas;
se borraron para evitar confusión.

| Variable                       | Para qué                            |
|--------------------------------|-------------------------------------|
| `ADMIN_TOKEN`                  | Acceso a `/admin/knowledge`         |
| `OPENROUTER_API_KEY`           | `/api/chat` → OpenRouter            |
| `OPENROUTER_MODEL`             | `anthropic/claude-haiku-4.5`        |
| `TELEGRAM_BOT_TOKEN`           | Form de contacto y "Pasar al equipo"|
| `TELEGRAM_CHAT_ID`             | Chat ID de @Agenciastartideabot     |
| `GOOGLE_CLIENT_ID`             | OAuth Google (módulo SEO)           |
| `GOOGLE_CLIENT_SECRET`         | OAuth Google (módulo SEO)           |
| `GOOGLE_REDIRECT_URI`          | callback OAuth                      |
| `APP_ENCRYPTION_KEY`           | cifra refresh tokens en SQLite      |
| `SEO_DB_PATH`                  | `/app/data/seo.db` (volume mount)   |
| `PUBLIC_GTM_ID`                | `GTM-N3SR8J` (Dockerfile ARG)       |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | vacío por defecto (Dockerfile ARG) |

El template versionado del compose vive en
`infra/docker-compose.production.template.yml` y la lista de claves
esperadas en `infra/.env.production.example`. El compose con valores
reales y el `.env.production` están en `.gitignore`.

## Coolify

- **Versión**: v3.12.36 (`ghcr.io/coollabsio/coolify:3.12.36`)
- **Container**: `coolify` en redes `coolify` (172.16.48.3) y `coolify-infra` (172.16.0.2)
- **DB**: SQLite en volume `coolify-db` → `/app/db/prod.db`
- **Volúmenes**: `coolify-db`, `coolify-logs`, `coolify-ssl-certs`, `coolify-letsencrypt`,
  `coolify-traefik-letsencrypt`, `coolify-local-backup`, `/var/run/docker.sock`
- **Puerto host**: ⚠️ actualmente NO expuesto al host por bug de iptables/docker.
  Acceso temporal vía SSH tunnel:

```bash
ssh -f -N -L 13000:172.16.48.3:3000 startidea-vps2
# panel en http://localhost:13000
```

  Solución limpia pendiente: subdominio `coolify.startidea.es` vía Traefik
  (ver "Deuda técnica").

### Recrear el container Coolify

Si Coolify se cae o necesita re-instalarse:

```bash
docker stop coolify && docker rm coolify
docker run -d \
  --name coolify --restart unless-stopped \
  -e TAG=3.12.36 \
  -e COOLIFY_APP_ID=578784a5-806e-4c76-bc77-f1fc1af9f951 \
  -e COOLIFY_SECRET_KEY=MGQwZjE4YTMxYzcxNmI1MTNmYzI3OTky \
  -e COOLIFY_SECRET_KEY_BETTER=MGQwZjE4YTMxYzcxNmI1MTNmYzI3OTky \
  -e COOLIFY_DATABASE_URL=file:../db/prod.db \
  -e COOLIFY_HOSTED_ON=docker \
  -e COOLIFY_AUTO_UPDATE=false \
  -e CHECKPOINT_DISABLE=1 \
  --network coolify \
  -v coolify-letsencrypt:/etc/letsencrypt \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v coolify-local-backup:/app/backups \
  -v coolify-db:/app/db \
  -v coolify-logs:/app/logs \
  -v coolify-ssl-certs:/app/ssl \
  -v coolify-traefik-letsencrypt:/etc/traefik/acme \
  ghcr.io/coollabsio/coolify:3.12.36
docker network connect coolify-infra coolify
```

(Si quieres exponer al host, añade `-p 3000:3000` y abre UFW 3000.)

## Traefik (coolify-proxy)

- Container `coolify-proxy`, expone `:80`, `:443`, y panel admin Traefik en `:8888`.
- Genera certs Let's Encrypt automáticos para hostnames con label
  `traefik.http.routers.<name>.tls.certresolver: letsencrypt`.

## Procesos no-Coolify

- **Bot Telegram**: @Agenciastartideabot. Token y chat (678888) están en compose.
- **Agente curador diario**: `scheduled-tasks` (taskId `startidea-daily-curator`),
  08:40 hora Madrid. Reportes en local `reports/curator-YYYY-MM-DD.md`.
  Nunca hace `git commit`.

## Sub-marcas (no migrar)

- `hubstartidea.es` — Next.js, container `hub-startidea-web`. OK.
- `tresmilmillonesdelatidos.es` — SaaS Next.js. No se gestiona desde aquí.
- `merchandising.startidea.es` — PHP whitelabel publifinder. Migración futura.

## Deuda técnica

1. **Reconciliar env vars compose vs Coolify Secrets**.
   Decidir entre mover todo al panel y dejar que Coolify regenere el
   compose (pierde GOOGLE_*, APP_ENCRYPTION_KEY, SEO_DB_PATH si no se
   añaden al panel primero), o borrar las Secrets del panel y declarar
   el compose como única fuente.

2. **Subdominio `coolify.startidea.es`**.
   Al hacer `docker rm coolify` el `-p 3000:3000` se perdió y Docker no
   regeneró iptables NAT. Crear `A coolify.startidea.es → 72.61.195.108`
   en IONOS y añadir al container `coolify` los labels Traefik:

   ```
   traefik.enable=true
   traefik.docker.network=coolify
   traefik.http.routers.coolify-panel.rule=Host(`coolify.startidea.es`)
   traefik.http.routers.coolify-panel.entrypoints=websecure
   traefik.http.routers.coolify-panel.tls=true
   traefik.http.routers.coolify-panel.tls.certresolver=letsencrypt
   traefik.http.services.coolify-panel.loadbalancer.server.port=3000
   ```

3. **Bug visual chat IA**: las burbujas user/assistant no se diferencian
   estéticamente. CSS con `@apply` dentro de `<style>` en
   `src/components/AsistenteIA.astro` no se está compilando.

## Recuperación de contraseña Coolify

Si pierdes el acceso al panel, reset directo en SQLite del container:

```bash
ssh startidea-vps2
NEW_PWD="elige-una-segura"
HASH=$(docker exec coolify node -e "console.log(require('bcryptjs').hashSync('$NEW_PWD', 10))")
docker exec coolify sqlite3 /app/db/prod.db \
  "UPDATE User SET password='$HASH', updatedAt=CURRENT_TIMESTAMP WHERE email='mario@startidea.es';"
```

(Hecho 2026-05-04 para recuperar acceso. Cambiar a una contraseña que
recuerdes desde el panel: IAM → Profile → Change password.)

## Monitorización pendiente

- Sin uptime monitor externo. Recomendado: BetterStack o UptimeRobot
  pingando `https://startidea.es/` cada 60 s.
- Sin alertas de steal time (incidente de 2026-05-04: 92 % steal sostenido,
  Hostinger lo resolvió tras notificación). Conviene script que avise si
  `cat /proc/stat` muestra steal > 20 % sostenido.
