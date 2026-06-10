# Migración del deploy de startidea-web a Watchtower (sin SSH entrante)

**Objetivo:** eliminar el deploy por SSH (`deploy.yml`) y pasar al mismo patrón
que el HUB: la imagen se construye en GitHub Actions, se publica en `ghcr.io`, y
**Watchtower** (ya corriendo en el VPS) la detecta y hace `pull` + `recreate`.

**Por qué:** el deploy SSH falla de dos formas recurrentes:
1. la sesión SSH se cae a mitad del build ("broken pipe"), y
2. el firewall/fail2ban del VPS banea las IPs efímeras de los runners de GitHub
   → `Connection timed out` en el puerto 22 (incidente 2026-06-04, dejó la web
   sin poder desplegar durante horas).

Con Watchtower **no hay ninguna conexión SSH entrante desde GitHub**.

---

## Lo que ya está hecho en el repo (commit de esta migración)

- `​.github/workflows/build-deploy.yml` — construye y publica
  `ghcr.io/mariopablobarron/startidea-web:latest` + `:<sha>`. **Arranca solo en
  modo manual** (`workflow_dispatch`) para no chocar con el deploy SSH actual.
- `infra/docker-compose.production.template.yml` — imagen actualizada a la de
  ghcr + etiqueta `com.centurylinklabs.watchtower.enable: "true"`.
- `deploy.yml` — ahora ignora cambios de `.github/workflows/**` (los edits de CI
  ya no disparan el deploy SSH).

**Nada de esto cambia el deploy en producción todavía.** El sitio sigue
desplegándose por SSH hasta que hagas el cutover de abajo.

---

## Pre-requisitos (verificar una vez)

1. **Watchtower corre en el VPS** (es el que ya actualiza el HUB). Comprueba:
   ```bash
   docker ps --filter name=watchtower
   ```
2. **Watchtower puede pullear de ghcr.io.** Como el HUB ya se actualiza desde
   `ghcr.io/mariopablobarron/hub`, las credenciales de ghcr del VPS
   (`~/.docker/config.json` o el montado en el contenedor de watchtower) ya
   cubren el mismo owner → la imagen `…/startidea-web` se pullea con lo mismo.
   Si la imagen ghcr fuera privada y watchtower no la pullara, hazla pública en
   GitHub → Packages → startidea-web → Package settings → Change visibility.
3. **Si watchtower está en modo `--label-enable`** (solo vigila contenedores con
   la etiqueta), la etiqueta `com.centurylinklabs.watchtower.enable=true` del
   paso 2 del cutover es obligatoria. Si vigila todos, igualmente no estorba.

---

## Cutover (cuando quieras, ~10 min, en el VPS)

### 1. Poblar la imagen en ghcr (desde tu máquina o la web de GitHub)
```bash
gh workflow run build-deploy.yml --repo mariopablobarron/startidea-web
gh run watch $(gh run list --repo mariopablobarron/startidea-web \
  --workflow=build-deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
```
El job `build` debe quedar en verde (el `verify` aún fallará: el VPS todavía
apunta a la imagen vieja — es esperado hasta el paso 3).

### 2. Apuntar el compose del VPS a la imagen ghcr + etiqueta watchtower
```bash
cd /docker/startidea-web-traefik
cp docker-compose.yml docker-compose.yml.bak     # backup
# Editar docker-compose.yml:
#   image: ghcr.io/mariopablobarron/startidea-web:latest
#   labels:
#     com.centurylinklabs.watchtower.enable: "true"
#   (quitar cualquier `build:` local si lo hubiera)
# Referencia: infra/docker-compose.production.template.yml del repo.
```

### 3. Login a ghcr en el VPS (si no lo tiene ya para el hub) y recrear
```bash
# Solo si el VPS no puede pullear aún (la imagen está privada):
#   echo $GHCR_PAT | docker login ghcr.io -u mariopablobarron --password-stdin
docker compose pull startidea-web
docker compose up -d --force-recreate startidea-web
curl -sk -o /dev/null -w "%{http_code}\n" https://startidea.es/    # debe dar 200
```

### 4. Activar el deploy automático por push y desactivar el SSH
En el repo (`.github/workflows/`):
- **`build-deploy.yml`**: descomenta el bloque `push:` (está marcado como
  `─── CUTOVER ───`).
- **`deploy.yml`**: quita su trigger `push:` (deja solo `workflow_dispatch:`) o
  borra el archivo. Así un push a `main` construye+publica la imagen y watchtower
  la despliega — sin tocar el VPS.

### 5. Probar el ciclo completo
Haz un cambio trivial, push a `main`, y mira:
- `build-deploy.yml` → build verde + push a ghcr.
- Watchtower (≤60s después) → `docker pull` + recreate.
- `verify` → `startidea.es` responde 200.

---

## Rollback (si algo falla en el cutover)
```bash
cd /docker/startidea-web-traefik
cp docker-compose.yml.bak docker-compose.yml
docker compose up -d --force-recreate startidea-web
```
Y en el repo: revertir el commit del cutover (volver a `push:` en `deploy.yml`).
El deploy SSH vuelve a ser el mecanismo — eso sí, requiere el puerto 22 abierto
para los runners (revisar fail2ban: `fail2ban-client status sshd`).

---

## Notas
- El `build-deploy.yml` pasa `PUBLIC_GTM_ID` y `PUBLIC_GOOGLE_SITE_VERIFICATION`
  como build-args. Si quieres valores distintos a los por defecto del
  `Dockerfile`, créalos como **repo variables** (Settings → Secrets and
  variables → Actions → Variables): `PUBLIC_GTM_ID`,
  `PUBLIC_GOOGLE_SITE_VERIFICATION`.
- El `start_period` del healthcheck del contenedor + el poll de 60s de watchtower
  hacen que un deploy tarde ~2-4 min en verse. El job `verify` espera hasta ~10.
