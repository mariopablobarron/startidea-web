# Guía de despliegue — Copiloto Fase 2 (copiloto-sede + MCP)

Pasos para activar la tramitación automática en producción. Hazlos en orden.
Los `<placeholders>` los rellenas tú. **Ningún secreto va al repo.**

> Resumen del flujo: cifras tu certificado en local → subes solo el cifrado al
> VPS → arrancas el container `copiloto-sede` (red interna) → das 2 env vars a
> `startidea-web` → conectas el MCP. Verificas en cada paso.

---

## 0. Genera los secretos (una vez)

En tu Mac o el VPS:
```bash
openssl rand -hex 24    # → COPILOTO_SEDE_SECRET  (auth entre web y container)
openssl rand -hex 32    # → CERT_MASTER_KEY       (descifra los certificados)
```
Guárdalos en tu gestor de contraseñas. **No los pegues en chat ni en el repo.**

---

## 1. Cifra el certificado (EN TU MAC — el .pfx en claro nunca sale de aquí)

```bash
cd copiloto-sede
# Certificado de Startidea (modo apoderado o trámites propios):
CERT_MASTER_KEY="<la-de-arriba>" node scripts/encrypt-cert.mjs /ruta/startidea.pfx STARTIDEA.pfx.enc
# (Para una entidad cliente, en modo 'entidad', usa su CIF sin guiones:)
# CERT_MASTER_KEY="..." node scripts/encrypt-cert.mjs /ruta/cliente.pfx G12345678.pfx.enc
```
Apunta también la **passphrase** del .pfx (la que pusiste al exportarlo) → será `CERT_PASS_STARTIDEA` (o `CERT_PASS_G12345678`).

---

## 2. Sube SOLO el cifrado al volumen de certs del VPS

```bash
ssh root@72.61.195.108 'mkdir -p /docker/copiloto-sede-certs && chmod 700 /docker/copiloto-sede-certs'
scp STARTIDEA.pfx.enc root@72.61.195.108:/docker/copiloto-sede-certs/
```
(El `.pfx.enc` es inútil sin `CERT_MASTER_KEY`, que NO está en el VPS en disco.)

---

## 3. Lleva el código del container al VPS

```bash
# Opción A — clonar el repo en el VPS:
ssh root@72.61.195.108 'git clone https://github.com/mariopablobarron/startidea-web.git /docker/copiloto-src || (cd /docker/copiloto-src && git pull)'
# El código del container queda en /docker/copiloto-src/copiloto-sede
```

---

## 4. Construye y arranca el container (red interna, NO expuesto)

```bash
ssh root@72.61.195.108
cd /docker/copiloto-src/copiloto-sede
docker build -t copiloto-sede .
docker rm -f copiloto-sede 2>/dev/null
docker run -d --name copiloto-sede --restart unless-stopped \
  --network coolify \
  -e COPILOTO_SEDE_SECRET='<secret-del-paso-0>' \
  -e CERT_STORE_DIR=/certs \
  -e CERT_MASTER_KEY='<master-key-del-paso-0>' \
  -e CERT_PASS_STARTIDEA='<passphrase-del-pfx>' \
  -v /docker/copiloto-sede-certs:/certs:ro \
  copiloto-sede
```
**Verifica salud** (desde el propio VPS, red interna):
```bash
docker run --rm --network coolify curlimages/curl -sS http://copiloto-sede:8090/health
# → {"ok":true,"service":"copiloto-sede","sedes":["junta-andalucia","mock"]}
```
> ⚠️ NO le pongas labels Traefik ni publiques el puerto: debe ser SOLO interno.

---

## 5. Conecta startidea-web con el container (2 env vars)

En **Coolify** (panel de startidea-web → Environment), o en `/docker/startidea-web-traefik/.env`:
```
COPILOTO_SEDE_URL=http://copiloto-sede:8090
COPILOTO_SEDE_SECRET=<el-mismo-secret-del-paso-0>
```
Luego **Deploy** de startidea-web en Coolify. (Si el swap se atasca, el cron
`startidea-web-deploy-completer.sh` lo completa en ~3 min.)

**Verifica:** en `/admin/expedientes/<id>` (de un expediente con sede Junta),
el botón **"Tramitación asistida (Fase 2)"** ya no devuelve `no_configurado`,
sino el handoff (o, en autónomo, el resultado del firmante).

---

## 6. Conecta el MCP (opcional — para mandarlo desde un agente IA)

```bash
cd copiloto-mcp && npm install
```
En `claude_desktop_config.json` (o config del cliente MCP):
```json
{
  "mcpServers": {
    "copiloto-subvenciones": {
      "command": "node",
      "args": ["/ruta/copiloto-mcp/server.mjs"],
      "env": { "ADMIN_TOKEN": "<ADMIN_TOKEN de startidea-web>", "STARTIDEA_API_URL": "https://startidea.es" }
    }
  }
}
```
Prueba: *"tramita el expediente A7B5F162 en modo asistido"* → invoca `tramitar_expediente`.

---

## 7. Para AUTONOMÍA real (modo autónomo) — checklist final

El modo `asistido` ya sirve tras los pasos 1-5. Para que el robot **firme y
presente solo** (modo `autonomo`) faltan estas validaciones en vivo:

- [ ] **Auth con certificado en el robot**: probar si la VEA acepta el cert vía
      Playwright `clientCertificates` (TLS) o requiere flujo Cl@ve/AutoFirma.
      Resolver en `drivers/junta-andalucia.mjs` (ver TODO(live)).
- [ ] **Firma real**: implementar XAdES/PAdES en `signers/{entidad,apoderado}.mjs`
      con el `.pfx` que devuelve `lib/cert-store.loadCert()`.
- [ ] **Apoderamiento** (solo modo `apoderado`): alta del cliente en el REA
      (`sede.administracion.gob.es/apodera/`) a favor del NIF de Startidea.
- [ ] **Formulario específico** de la convocatoria real: capturar sus 2-3 campos
      propios (5 min con la extensión, con el plazo abierto) y ajustar el driver.
- [ ] Probar end-to-end sobre un expediente real antes de confiar en autónomo.

---

## Seguridad — no negociable

- El `.pfx` en claro **nunca** sale de tu Mac. Al VPS solo sube el `.pfx.enc`.
- `CERT_MASTER_KEY` y `CERT_PASS_*` solo en el entorno de runtime del container.
- El container `copiloto-sede` **solo en red interna** (sin Traefik, sin puerto público).
- Modo `apoderado` requiere apoderamiento legal real; modo `entidad` requiere
  autorización escrita de la entidad. Firmar sin base legal = fraude.
