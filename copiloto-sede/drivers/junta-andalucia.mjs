/**
 * Driver — Junta de Andalucía (sede electrónica / SAL).
 * Portal: https://ws030.juntadeandalucia.es/sal/servicios/tramites
 *
 * MODELO ASISTIDO (el único legal sin apoderamiento):
 *   - El bot navega a la sede y deja TODO listo hasta el muro de autenticación
 *     y firma.
 *   - La autenticación (Cl@ve / certificado) y la FIRMA las hace el CLIENTE,
 *     porque jurídicamente la firma la pone el titular del certificado.
 *   - Salida: una "sesión de firma" (handoff) + los datos pre-rellenados y un
 *     checklist, para que el cliente complete la presentación con guía.
 *
 * ⚠️ Lo que sigue es el ESQUELETO. Los selectores reales del formulario y el
 * flujo post-autenticación requieren EXPLORACIÓN EN VIVO con una cuenta/certificado
 * de prueba (la mayoría del trámite vive detrás de Cl@ve). Marcado con TODO.
 */
// Import lazy de Playwright: así el server arranca y el modo mock funciona sin
// la dependencia pesada instalada (útil para smoke-tests y healthcheck).
const SEDE_URL = 'https://ws030.juntadeandalucia.es/sal/servicios/tramites';

export async function tramitarJuntaAndalucia(job) {
  const { expedienteId, formData, files, mode } = job;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'es-ES',
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    // ── 1. Llegar a la sede (parte pública, sin auth) ─────────────────────
    await page.goto(SEDE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Captura de evidencia (útil para depurar cambios de portal)
    const screenshot = await page.screenshot({ fullPage: false }).then(
      (b) => `data:image/png;base64,${b.toString('base64')}`,
      () => null,
    );

    // ── 2. Localizar el trámite concreto ──────────────────────────────────
    // TODO(live): buscar el trámite por su código BOJA / nombre. El SAL tiene
    // un buscador de procedimientos; hay que mapear convocatoria → procedimiento.
    //   await page.fill('#buscadorTramites', formData.procedimiento);
    //   await page.click('text=Iniciar presentación telemática');

    // ── 3. Muro de autenticación (Cl@ve / certificado) ────────────────────
    // NO automatizable de forma autónoma: lo hace el cliente con SU identidad.
    // En modo asistido paramos aquí y entregamos el handoff.
    if (mode === 'asistido') {
      await browser.close();
      return {
        status: 'handoff_firma',
        message:
          'Trámite localizado en la sede de la Junta de Andalucía. La presentación ' +
          'requiere que el cliente se autentique con Cl@ve o certificado digital y firme. ' +
          'Startidea ha dejado preparados los datos y la documentación.',
        sedeUrl: SEDE_URL,
        // Datos pre-rellenados que el cliente solo tiene que revisar y enviar:
        prefill: buildPrefill(formData),
        checklist: buildChecklist(files),
        evidencia: screenshot,
        // TODO(V3): si hay apoderamiento, continuar el flujo en modo 'apoderado'.
        siguientePaso: 'El cliente entra en sedeUrl, se identifica y firma con su certificado.',
      };
    }

    // ── 4. Modo apoderado (V3) — Startidea firma como representante ────────
    // TODO(V3): requiere alta del cliente en el Registro Electrónico de
    // Apoderamientos (REA/Cl@ve) y certificado de Startidea cargado de forma
    // segura. NO implementado en el MVP.
    throw new Error("modo 'apoderado' no implementado en el MVP (requiere REA + certificado Startidea)");
  } finally {
    await browser.close().catch(() => {});
  }
}

// Mapea los datos del expediente a los campos del formulario de la Junta.
// TODO(live): ajustar las claves a los nombres reales de los campos del SAL.
function buildPrefill(formData) {
  return {
    razonSocial: formData.org_nombre ?? '',
    nif: formData.org_cif ?? '',
    representante: formData.representante ?? '',
    email: formData.email ?? '',
    telefono: formData.telefono ?? '',
    provincia: formData.provincia ?? 'Granada',
    objeto: formData.descripcion_proyecto ?? '',
    importeSolicitado: formData.importe_solicitado ?? '',
  };
}

// Checklist de documentos requeridos vs adjuntos disponibles.
function buildChecklist(files) {
  const tiene = new Set((files || []).map((f) => f.name));
  const requeridos = ['memoria', 'presupuesto', 'estatutos', 'hacienda', 'seguridad_social'];
  return requeridos.map((doc) => ({ doc, adjunto: tiene.has(doc) }));
}
