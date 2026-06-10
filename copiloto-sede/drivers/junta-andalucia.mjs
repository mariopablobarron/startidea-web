/**
 * Driver — Junta de Andalucía (Ventanilla Electrónica VEA + Presentación
 * Electrónica General / procedimientos específicos).
 *
 * Estructura capturada EN VIVO (Claude in Chrome, cert de Startidea Consulting):
 *   Acceso: ws094.../SolicitarTicket?v=PEG → redirige a veaja.cloud.juntadeandalucia.es
 *   → login con certificado/Cl@ve (titular) → crea /borrador/<id>.
 *   Pasos del borrador: 1) COMPLETAR (Solicitud) + APORTAR (docs) · 2) Firmar · 3) Presentar.
 *   El formulario "Solicitud" se abre en un IFRAME/modal (botones: "Limpiar
 *   formulario", "Guardar y cerrar"). Secciones: Solicitante, Domicilio,
 *   Contacto, Representante, Objeto (textarea), Lugar/Fecha/Firma.
 *
 * MODOS:
 *   'asistido' → deja todo listo hasta la firma; el cliente firma (legal por defecto).
 *   'autonomo' → el agente firma con sign() (signMode entidad|apoderado) y presenta.
 *
 * ⚠️ TODO(live): partes que solo se afinan con el plazo ABIERTO + cert real:
 *   - AUTENTICACIÓN: el acceso a VEA usa certificado/Cl@ve. Para 'autonomo' hay
 *     que resolverla (Playwright clientCertificates si es TLS client-cert, o
 *     integración Cl@ve/AutoFirma si es flujo OS). Verificar en vivo.
 *   - Selector exacto del IFRAME del formulario y labels finos (capturados por
 *     texto; pueden requerir ajuste de tildes/mayúsculas).
 *   - Flujo APORTAR (input file) y botones Firmar/Presentar + captura del CSV.
 */
import { sign } from '../signers/index.mjs';

const PEG_ENTRY = 'https://ws094.juntadeandalucia.es/V_virtual/SolicitarTicket?v=PEG';

// Mapa de campos del formulario VEA "Solicitud" → etiquetas capturadas.
// Se rellena por etiqueta (robusto a cambios de id). Ajustar en vivo si hace falta.
const SOLICITANTE = {
  razonSocial: 'NOMBRE/RAZÓN SOCIAL/DENOMINACION',
  primerApellido: 'PRIMER APELLIDO',
  segundoApellido: 'SEGUNDO APELLIDO',
  cif: 'DNI/NIE/CIF',
  tipoVia: 'TIPO DE VÍA',
  nombreVia: 'NOMBRE DE LA VÍA',
  numero: 'NÚMERO',
  provincia: 'PROVINCIA',
  municipio: 'MUNICIPIO',
  localidad: 'LOCALIDAD',
  codPostal: 'COD.POSTAL',
  telefonoMovil: 'TELÉFONO MÓVIL',
  email: 'CORREO ELECTRÓNICO',
};

export async function tramitarJuntaAndalucia(job) {
  const { expedienteId, formData = {}, files = [], mode = 'asistido', signMode = 'mock', procedimiento } = job;
  const { chromium } = await import('playwright');

  // Contexto. Para 'autonomo' la auth con certificado se inyecta aquí.
  // TODO(live): si VEA usa TLS client-cert → newContext({ clientCertificates:[{ origin, pfx, passphrase }] })
  //   con el .pfx de custodia (lib/cert-store). Si usa Cl@ve (OS dialog) → integración aparte.
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'es-ES', acceptDownloads: true });
  const page = await context.newPage();

  try {
    // ── 1. Acceso a la sede (PEG genérico o procedimiento específico) ─────────
    const entry = procedimiento?.entryUrl || PEG_ENTRY;
    await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Aceptar cookies de VEA si aparece (propias, esenciales)
    await page.getByRole('button', { name: /^ACEPTAR$/i }).click({ timeout: 5000 }).catch(() => {});

    // ── 2. Auth con certificado/Cl@ve ─────────────────────────────────────────
    // En 'asistido' la hace el cliente (handoff). En 'autonomo' debe estar ya
    // resuelta por el contexto (clientCertificates) — ver TODO(live) arriba.
    if (mode === 'asistido') {
      const evidencia = await page.screenshot({ fullPage: false }).then(
        (b) => `data:image/png;base64,${b.toString('base64')}`, () => null);
      await browser.close();
      return {
        status: 'handoff_firma',
        message: 'Trámite preparado en la Ventanilla Electrónica de la Junta. El cliente debe autenticarse con su certificado/Cl@ve y firmar.',
        sedeUrl: entry,
        prefill: buildPrefill(formData),
        checklist: buildChecklist(files),
        evidencia,
        siguientePaso: 'El cliente entra, se identifica con certificado/Cl@ve y firma.',
      };
    }

    // ── 3. AUTÓNOMO: completar Solicitud (formulario en iframe) ───────────────
    await page.getByRole('button', { name: /COMPLETAR/i }).first().click({ timeout: 30000 });
    const form = page.frameLocator('iframe'); // TODO(live): afinar selector del iframe
    await fillSolicitud(form, formData);
    await page.getByRole('button', { name: /Guardar y cerrar/i }).click({ timeout: 15000 });

    // ── 4. APORTAR documentación obligatoria ──────────────────────────────────
    // TODO(live): pulsar APORTAR y subir cada fichero (input[type=file]).
    //   for (const f of files) await form.locator('input[type=file]').setInputFiles(f.path);

    // ── 5. Firmar + Presentar ─────────────────────────────────────────────────
    const firma = await sign({ signMode, expedienteId, cif: formData.org_cif,
      certRef: { kind: signMode === 'apoderado' ? 'startidea' : 'entidad', cif: formData.org_cif } });
    // TODO(live): pulsar "Firmar" (paso 2) y "Presentar" (paso 3); capturar el CSV/justificante.
    await browser.close();
    return {
      status: firma.signed ? 'presentado' : 'error_firma',
      signMode,
      csv: firma.csv ?? null,
      registro: firma.registro ?? null,
      message: firma.detail,
      sedeUrl: entry,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

// Rellena la sección Solicitante del formulario (en el iframe), por etiqueta.
async function fillSolicitud(form, d) {
  const set = async (label, value) => {
    if (value === undefined || value === null || value === '') return;
    // getByLabel es robusto; si falla, intentar por placeholder/nombre cercano.
    await form.getByLabel(new RegExp(label, 'i')).fill(String(value)).catch(() => {});
  };
  await set(SOLICITANTE.razonSocial, d.org_nombre);
  await set(SOLICITANTE.cif, d.org_cif);
  await set(SOLICITANTE.provincia, d.provincia);
  await set(SOLICITANTE.email, d.email);
  await set(SOLICITANTE.telefonoMovil, d.telefono);
  // Objeto del escrito (textarea de la sección Expone/Solicita)
  if (d.descripcion_proyecto) {
    await form.locator('textarea').first().fill(String(d.descripcion_proyecto)).catch(() => {});
  }
  // TODO(live): tipo de vía/municipio son selects (combo) — usar selectOption.
}

function buildPrefill(d) {
  return {
    razonSocial: d.org_nombre ?? '',
    nif: d.org_cif ?? '',
    provincia: d.provincia ?? 'Granada',
    email: d.email ?? '',
    objeto: d.descripcion_proyecto ?? '',
  };
}

function buildChecklist(files) {
  const tiene = new Set((files || []).map((f) => f.name));
  return ['memoria', 'presupuesto', 'estatutos', 'hacienda', 'seguridad_social']
    .map((doc) => ({ doc, adjunto: tiene.has(doc) }));
}
