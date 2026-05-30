# Copiloto de Subvenciones — Fase 2 (tramitación asistida en sede electrónica)

**Estado: ESQUELETO / MVP.** Container Playwright **separado** del `startidea-web`
principal (regla del proyecto: Playwright NUNCA en la imagen principal).

## Qué resuelve y qué NO

La presentación de una subvención en sede electrónica termina en una **firma con
certificado digital**, que jurídicamente la pone **el titular** (la entidad). Por
eso este servicio NO firma por el cliente. Modelos:

| Modelo | Quién firma | Estado |
|---|---|---|
| **Asistido** (MVP) | El cliente, con su Cl@ve/certificado, al final | ✅ implementado (esqueleto) |
| **Apoderado** (V3) | Startidea, con poder en REA/Cl@ve + su certificado | ⛔ no implementado |
| Certificado del cliente en servidor | — | ❌ descartado (RGPD/legal) |

El MVP **asistido** hace: detectar sede → navegar → localizar el trámite →
pre-rellenar datos → preparar checklist de documentos → **handoff** al cliente
para que se autentique y firme. Captura el justificante CSV cuando el cliente
termina (V2).

## Arquitectura

```
startidea-web (main)                  copiloto-sede (este container)
  expediente "docs_listos"  ──POST──►  /tramitar { expedienteId, sede, formData, files }
  (sede ya resuelta por                  └─ drivers/index.mjs  → driver por sede
   src/lib/sedes-map.ts)                     └─ junta-andalucia.mjs (Playwright)
                            ◄──JSON───  { status: 'handoff_firma', sedeUrl, prefill, checklist }
```

- `server.mjs` — HTTP server. `GET /health`, `POST /tramitar` (auth por header
  `x-copiloto-secret`).
- `drivers/index.mjs` — registro sede→driver.
- `drivers/junta-andalucia.mjs` — driver de la Junta (modo asistido).

## Cómo se cablea con el main

1. En `startidea-web`, cuando un expediente pasa a `docs_listos`, el admin (o un
   endpoint) hace `POST http://copiloto-sede:8090/tramitar` con el expediente +
   la sede detectada por `sedes-map.ts` + las rutas de los adjuntos.
2. La respuesta `handoff_firma` se muestra en el panel admin y/o se envía al
   cliente: enlace a la sede + datos pre-rellenados + checklist.
3. El cliente se autentica y firma. (V2: el cliente sube el CSV o el bot lo
   captura en una sesión co-browsing.)

## Variables de entorno

- `PORT` (default 8090)
- `COPILOTO_SEDE_SECRET` — secreto compartido con el main para autenticar `/tramitar`.

## Deploy (separado, NO en Coolify del main)

```bash
docker build -t copiloto-sede ./copiloto-sede
docker run -d --name copiloto-sede --network coolify \
  -e COPILOTO_SEDE_SECRET=... copiloto-sede
```
Solo en red interna Docker — **no exponer a internet**.

## TODO antes de producción (requiere exploración EN VIVO)

- [ ] **Junta de Andalucía**: mapear convocatoria→procedimiento del SAL, selectores
      reales del formulario tras Cl@ve, captura del CSV. (Necesita cuenta/certificado de prueba.)
- [ ] Flujo de **handoff** real: cómo entrega el main el enlace al cliente (email/panel).
- [ ] **V2**: drivers BDNS e infosubvenciones, Diputación de Granada.
- [ ] **V3**: modo apoderado (alta REA + certificado Startidea seguro).
- [ ] Anti-bot: la sede puede tener captcha/Cl@ve que rompa la automatización — validar.
- [ ] Watchdog: cada sede cambia su portal → monitor que avise si un driver rompe.

## Realidad esperada

Esto **reduce mucho** el trabajo manual (todo listo hasta la firma), pero NO es
"un clic y se presenta solo": el certificado lo pone el cliente. La autonomía total
solo es posible con apoderamiento (V3) y aun así con mantenimiento por sede.
