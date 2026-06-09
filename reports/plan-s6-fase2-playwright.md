# S6 · Fase 2 — Automatización de sede electrónica (Playwright)

> Plan técnico. No toca producción. Diseño + arquitectura + roadmap por fases.
> Fecha: 2026-06-09.

## 1. Principio rector (legal + seguridad): tramitación ASISTIDA, no autónoma

El copiloto **prepara y pre-rellena** la solicitud hasta el punto de firma. **La
firma y la presentación las hace SIEMPRE el cliente** con su certificado digital.

Por qué es innegociable:
- El **certificado digital** es personal e intransferible; no debe vivir en
  nuestro servidor ni manejarlo el bot. Firmar por el cliente sería suplantación.
- Las reglas de seguridad del propio asistente prohíben introducir credenciales,
  resolver CAPTCHAs y pulsar acciones irreversibles (enviar/firmar) sin acción
  explícita del titular.
- Las sedes públicas usan **Cl@ve / Autofirma** ligados a la identidad del firmante.

**Conclusión de alcance:** automatizamos *localizar trámite + pre-rellenar +
capturar estado/guía visual real*. El cliente revisa, firma y presenta.

## 2. Arquitectura

```
startidea-web (Astro)        ┌─────────────────────────────┐
  /admin/expedientes/[id]    │  container copiloto-sede     │
   "Fase 2"  ──HTTP(token)──▶│  (Playwright + chromium)     │
                             │  - drivers por sede (key)    │
   ◀── screenshots/estado ───│  - SIN certificados cliente  │
                             │  - efímero, no público       │
                             └─────────────────────────────┘
```

- **Container separado `copiloto-sede`** (ya previsto en `CLAUDE.md`): Playwright
  NO va en la imagen principal de startidea-web (la inflaría y la haría frágil).
  Imagen propia `mcr.microsoft.com/playwright` o `node:20 + npx playwright`.
- **API privada** entre la web/HUB y el container, protegida por token interno;
  el container **no se expone a internet** (solo red Docker / Traefik interno).
- **Drivers por sede**: el campo `key` de `SedeInfo` (ya existe en
  `src/lib/sedes-map.ts`) selecciona el driver. Hoy solo `junta-andalucia` tiene
  key. Sin key → no hay automatización (fallback a la guía textual actual).

## 3. Interfaz de driver (contrato por sede)

```ts
interface SedeDriver {
  key: string;                       // 'junta-andalucia', 'min-derechos-sociales'...
  // 1. Localiza el trámite y devuelve la URL exacta + pasos reales con captura.
  localizarTramite(conv: { titulo: string; codigoBDNS?: string }): Promise<{
    urlTramite: string | null;
    pasos: { titulo: string; screenshot: string /* base64/ruta */ }[];
    encontrado: boolean;
  }>;
  // 2. Pre-rellena el formulario con los datos del expediente HASTA la firma.
  //    Devuelve un "borrador" navegable + qué campos quedaron sin datos.
  prerrellenar(exp: ExpedienteDatos): Promise<{
    camposRellenados: string[];
    camposPendientes: string[];      // → [COMPLETAR] para el cliente
    capturaFinal: string;            // screenshot antes de firmar
    avisos: string[];                // p.ej. "requiere Autofirma", "plazo de firma 2h"
  }>;
}
```

El bot **se detiene antes de firmar**. Nunca pulsa "Firmar"/"Presentar".

## 4. Roadmap por fases (incremental, cada una entrega valor sola)

### Fase 2a — Guía visual real (la más segura, primer entregable)
- El driver abre la sede, localiza el trámite y **captura screenshots paso a paso**.
- Sustituye la guía genérica de texto por una **guía con capturas reales** de ESA
  convocatoria en ESA sede. Cero datos del cliente, cero firma → riesgo mínimo.
- Entregable: en `/admin/expedientes/[id]` → "Fase 2", botón "Generar guía visual".

### Fase 2b — Pre-relleno asistido
- El driver navega el formulario y **rellena los campos** con los datos del
  expediente (razón social, CIF, importe, descripción…). Marca `camposPendientes`.
- Deja el borrador listo y avisa al cliente: "revisa y firma tú".
- Requiere mapear los campos por sede (frágil → ver §5).

### Fase 2c — Verificación post-presentación (opcional)
- Tras presentar el cliente, el driver puede **comprobar el estado** del expediente
  en la carpeta ciudadana (si el cliente aporta acceso) y guardar el CSV/registro.

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Las sedes cambian su HTML → selectores rotos | Selectores por rol/label (no por clases); tests "smoke" por sede; alertas si un driver falla |
| Cl@ve / 2FA / certificado | Fuera de alcance: lo hace el cliente. El bot para antes |
| CAPTCHA | No se resuelve (regla de seguridad). Si aparece, se pasa el control al cliente |
| Detección de bots / bloqueo IP | User-agent real, ritmo humano, no headless agresivo; solo navegación legítima |
| Datos personales en el container | Container efímero; nada se persiste salvo screenshots (sin datos sensibles a la vista); borrado tras la sesión |
| Mantenimiento por sede | Empezar por 1 sede y consolidar antes de añadir más |

## 6. Orden de implementación de sedes (por volumen para el tercer sector)
1. **Junta de Andalucía** (`junta-andalucia`, ya tiene key) — mayor volumen andaluz.
2. **Ministerio de Derechos Sociales** (IRPF / Plan Estatal ONG) — gran volumen estatal.
3. **BDNS / infosubvenciones.es** — no es sede de presentación; sirve para
   *localizar* el enlace real de la sede del organismo (driver "resolver redirect").
4. Resto bajo demanda (Cultura, SEPE, CDTI, Diputación Granada…).

## 7. Integración con lo existente
- `sedes-map.ts`: añadir `key` a cada sede conforme se implemente su driver.
- `/admin/expedientes/[id]` sección "Fase 2": ya es placeholder → conectar a la API
  del container y mostrar screenshots/estado; persistir resultado en el expediente
  (nuevas columnas `ai_fase2_guia`, `ai_fase2_estado` en `expedientes-db.ts`).
- Despliegue del container: NO por el cron pull actual (es de la web). El container
  `copiloto-sede` se gestiona aparte en Coolify (su propio app + imagen Playwright).

## 8. Estimación (orden de magnitud)
- Fase 2a (guía visual, 1 sede): ~2-3 días (scaffold container + API + driver Junta + UI).
- Fase 2b (pre-relleno, 1 sede): ~3-5 días (mapeo de campos + revisión + salvaguardas).
- Cada sede adicional: ~1-2 días (driver) + mantenimiento continuo.

## 9. Decisión pendiente de Mario antes de codificar
- ¿Empezamos por **Fase 2a** (guía visual, riesgo casi nulo) como MVP? (recomendado)
- ¿Container `copiloto-sede` como nuevo app en Coolify, o en el HUB?
- ¿Primera sede = Junta de Andalucía? (recomendado por volumen + ya tiene `key`)
