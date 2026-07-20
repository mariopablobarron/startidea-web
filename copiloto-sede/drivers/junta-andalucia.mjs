/**
 * Driver — Junta de Andalucía · Ventanilla Electrónica (VEA).
 *
 * Estructura capturada EN VIVO el 2026-07-10 (Playwright, páginas públicas):
 *   Entrada:  https://veaja.cloud.juntadeandalucia.es/inicio/procedimiento-detalle/PEG_VEA
 *   (la URL vieja ws094.../SolicitarTicket?v=PEG redirige aquí — la VEA se migró a
 *    una plataforma cloud nueva, un SPA de Angular).
 *   La página de entrada declara los 3 pasos: 1) iniciar solicitud (formulario +
 *   docs) · 2) firmar con Certificado digital o Cl@ve (+ Autofirma) · 3) presentar.
 *   Al pulsar "INICIAR SOLICITUD" aparece INMEDIATAMENTE el modal "Autenticarme
 *   con:" (Certificado electrónico / Cl@ve / NIF-NIE). => NO hay formulario público:
 *   te autenticas ANTES de ver nada. Ese modal es el punto de handoff.
 *
 * ALCANCE (decisión Mario 2026-07-10): SOLO modo 'asistido'. El Copiloto captura la
 * sede en vivo y entrega al cliente/apoderado una guía hiperconcreta (capturas de la
 * entrada + de la pantalla de acceso, prefill desde el expediente y checklist de
 * documentos). NUNCA se autentica, firma ni presenta por el cliente. El modo
 * 'autonomo' queda deshabilitado a propósito (requiere firma real XAdES/PAdES +
 * certificado + revisión legal; ver copiloto-sede/signers/index.mjs).
 */

// URL de entrada del PEG (Presentación Electrónica General) en la VEA nueva.
const PEG_ENTRY =
  'https://veaja.cloud.juntadeandalucia.es/inicio/procedimiento-detalle/PEG_VEA';

const SHOT = { type: 'png', fullPage: false };

export async function tramitarJuntaAndalucia(job) {
  const {
    expedienteId,
    formData = {},
    files = [],
    mode = 'asistido',
    procedimiento,
  } = job;

  // El modo autónomo (firmar + presentar por el cliente) está fuera de alcance.
  // Se rechaza explícito para que nadie dispare una presentación a medias.
  if (mode === 'autonomo') {
    return {
      status: 'no_disponible',
      message:
        'El modo autónomo (firmar y presentar en nombre del cliente) está deshabilitado: ' +
        'requiere firma real con certificado + revisión legal. Usa el modo asistido.',
      sedeUrl: procedimiento?.entryUrl || PEG_ENTRY,
    };
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'es-ES',
    viewport: { width: 1280, height: 900 },
    acceptDownloads: false,
  });
  const page = await context.newPage();
  const evidencias = [];

  try {
    const entry = procedimiento?.entryUrl || PEG_ENTRY;

    // ── 1. Página de entrada del procedimiento (pública) ─────────────────────
    await page.goto(entry, { waitUntil: 'networkidle', timeout: 45000 });
    await dismissCookies(page);
    // El SPA carga el detalle async; esperamos a que aparezca el CTA.
    await page
      .getByRole('button', { name: /INICIAR SOLICITUD/i })
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => {});

    const procedimientoNombre = await page
      .locator('h1')
      .first()
      .innerText()
      .then((t) => t.trim())
      .catch(() => '');

    await capture(page, evidencias, 'entrada', 'Página de entrada del procedimiento en la Ventanilla Electrónica');

    // ── 2. Pulsar INICIAR SOLICITUD → aparece el muro de autenticación ───────
    // (No introducimos NIF ni credenciales: paramos justo en el handoff.)
    // HONESTIDAD de la evidencia: solo se declara handoff completo si el modal
    // de acceso APARECIÓ de verdad. Antes se etiquetaba la captura como
    // "pantalla de acceso" aunque el clic o el modal hubieran fallado —
    // evidencia falsa para un trámite con obligaciones legales.
    let metodosAcceso = [];
    let modalVisto = false;
    const iniciar = page.getByRole('button', { name: /INICIAR SOLICITUD/i }).first();
    if (await iniciar.isVisible().catch(() => false)) {
      await iniciar.click({ timeout: 15000 }).catch(() => {});
      // Heading del modal: /Autenticar/ cubre "Autenticarme" y "Autenticarse"
      // (la VEA cambió el texto en jul-2026). Robusto a futuros retoques.
      const headingVisto = await page
        .getByRole('heading', { name: /Autenticar/i })
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true, () => false);

      metodosAcceso = await detectarMetodosAcceso(page);
      // El muro de acceso se da por visto si aparece el heading O si hay al
      // menos un botón de acceso (certificado/Cl@ve) — la señal real del handoff,
      // independiente del texto exacto del título.
      modalVisto = headingVisto || metodosAcceso.length > 0;
      await capture(
        page,
        evidencias,
        modalVisto ? 'acceso' : 'estado-tras-clic',
        modalVisto
          ? 'Pantalla de acceso: identifícate con certificado digital o Cl@ve'
          : 'Estado de la sede tras pulsar INICIAR SOLICITUD (el modal de acceso NO llegó a aparecer)',
      );
    }

    // (el cierre del browser lo hace el finally — cerrarlo aquí duplicaba el close)
    return {
      status: modalVisto ? 'handoff_firma' : 'handoff_parcial',
      modalAccesoVerificado: modalVisto,
      message: modalVisto
        ? 'Trámite localizado en la Ventanilla Electrónica de la Junta de Andalucía. ' +
          'El cliente (o Startidea como apoderado) debe entrar, identificarse con ' +
          'certificado digital o Cl@ve, rellenar la solicitud con los datos de abajo, ' +
          'adjuntar los documentos y firmar.'
        : 'Sede localizada, pero el modal de acceso no llegó a confirmarse en la captura ' +
          '(la VEA pudo cambiar o tardar). Revisa las capturas antes de entregar la guía: ' +
          'los datos de prefill y el checklist siguen siendo válidos.',
      sedeUrl: entry,
      procedimiento: procedimientoNombre || 'Presentación Electrónica General (PEG)',
      metodosAcceso: metodosAcceso.length ? metodosAcceso : ['certificado', 'clave'],
      prefill: buildPrefill(formData),
      checklist: buildChecklist(files),
      evidencias, // [{ paso, titulo, imagen(dataURL) }]
      evidencia: evidencias[0]?.imagen ?? null, // compat: primera captura
      siguientePaso:
        'Entrar en la sede, identificarse con certificado/Cl@ve, iniciar la solicitud, ' +
        'copiar los datos del prefill, adjuntar los documentos del checklist y firmar.',
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Captura la pantalla actual como data-URL y la añade a la lista de evidencias.
async function capture(page, evidencias, paso, titulo) {
  const img = await page
    .screenshot(SHOT)
    .then((b) => `data:image/png;base64,${b.toString('base64')}`)
    .catch(() => null);
  if (img) evidencias.push({ paso, titulo, imagen: img });
}

// Cierra el banner de cookies (elige la opción más conservadora si existe).
async function dismissCookies(page) {
  for (const rx of [/rechazar/i, /solo.*esenciales/i, /aceptar/i]) {
    const btn = page.getByRole('button', { name: rx }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      return;
    }
  }
}

// Detecta qué métodos de acceso ofrece el modal de autenticación.
async function detectarMetodosAcceso(page) {
  const metodos = [];
  if (await page.getByRole('button', { name: /certificado/i }).first().isVisible().catch(() => false)) {
    metodos.push('certificado');
  }
  if (await page.getByRole('button', { name: /cl@?ve/i }).first().isVisible().catch(() => false)) {
    metodos.push('clave');
  }
  return metodos;
}

// Prefill: los datos del expediente que el cliente teclea tras identificarse.
// Etiquetas alineadas con la sección "Solicitante" del formulario VEA.
function buildPrefill(d) {
  return {
    razonSocial: d.org_nombre ?? '',
    nif: d.org_cif ?? '',
    representante: d.representante ?? '',
    provincia: d.provincia ?? 'Granada',
    telefono: d.telefono ?? '',
    email: d.email ?? '',
    importeSolicitado: d.importe_solicitado ?? '',
    objeto: d.descripcion_proyecto ?? '',
  };
}

// Checklist de documentos obligatorios: marca cuáles ya vienen adjuntos al
// expediente (docs_adjuntos) y cuáles el cliente debe subir en la sede.
const DOCS_OBLIGATORIOS = [
  { doc: 'memoria', etiqueta: 'Memoria técnica del proyecto' },
  { doc: 'presupuesto', etiqueta: 'Presupuesto detallado' },
  { doc: 'estatutos', etiqueta: 'Estatutos de la entidad' },
  { doc: 'cif', etiqueta: 'Tarjeta de identificación fiscal (CIF)' },
  { doc: 'hacienda', etiqueta: 'Certificado de estar al corriente con Hacienda' },
  { doc: 'seguridad_social', etiqueta: 'Certificado de estar al corriente con la Seguridad Social' },
];

function buildChecklist(files) {
  // Coincidencia por TOKEN, no por substring: con substring, "especificaciones.pdf"
  // contiene "cif" y marcaría como adjunto un documento obligatorio ausente
  // (trámite con obligaciones legales — mejor pecar de ⬜ que de ✅ falso).
  const tokens = new Set(
    (files || [])
      .map((f) => (typeof f === 'string' ? f : f?.name ?? ''))
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñü]+/)
      .filter(Boolean),
  );
  return DOCS_OBLIGATORIOS.map(({ doc, etiqueta }) => ({
    doc,
    etiqueta,
    // seguridad_social se adjunta como "seguridad-social", "ss", etc. — cada
    // parte del doc debe aparecer como token propio.
    adjunto: doc.split('_').every((part) => tokens.has(part)),
  }));
}
