/**
 * contrato-generator.ts
 *
 * Genera el HTML del contrato de prestación de servicios con comisión a éxito
 * entre Startidea Consulting, S.L. y el cliente.
 *
 * DATOS PRESTADOR — verificar antes del primer uso en producción:
 *   - Razón social: Startidea Consulting, S.L. (CIF B19583632)
 *   - Registro Mercantil: actualizar con los datos reales de inscripción
 *   - Domicilio: C/ Conde Cifuentes, 33, 18005 Granada (verificar actualidad)
 *
 * El contrato se envía por email al cliente con un enlace de aceptación único.
 * La aceptación via click queda registrada con timestamp + IP, lo que es
 * jurídicamente válido para contratos B2B en España bajo Art. 23 LSSI y
 * Art. 1262 CC (acuerdo de voluntades por vía electrónica).
 */

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function fmtDate(ts?: number): string {
  const d = ts ? new Date(ts * 1000) : new Date();
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Datos Startidea (PRESTADOR) ──────────────────────────────────────────────

export const STARTIDEA = {
  razonSocial:   'Startidea Consulting, S.L.',
  cif:           'B19583632',
  domicilio:     'C/ Conde Cifuentes, 33',
  cp:            '18005',
  ciudad:        'Granada',
  provincia:     'Granada',
  pais:          'España',
  registro:      'Registro Mercantil de Granada',   // completar con tomo/folio/hoja
  email:         'hola@startidea.es',
  web:           'https://startidea.es',
  comisionPct:   12,  // porcentaje de comisión a éxito
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ContratoData {
  expedienteId:      string;
  convocatoriaTitle: string | null;
  orgNombre:         string;
  orgCif:            string;
  orgTipo:           string;
  representante:     string;
  email:             string;
  telefono:          string;
  provincia:         string;
  importeSolicitado: string;
  contratoToken:     string;
  createdAt:         number;
}

// ─── Texto del contrato (HTML imprimible) ─────────────────────────────────────

export function generarContratoHtml(data: ContratoData): string {
  const fechaContrato = fmtDate(data.createdAt);
  const acceptUrl = `https://startidea.es/contrato/${esc(data.contratoToken)}`;
  const convNombre = data.convocatoriaTitle ?? 'la convocatoria de subvención indicada en el expediente';
  const comision = STARTIDEA.comisionPct;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contrato de Prestación de Servicios · Expediente ${esc(data.expedienteId)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 14px; line-height: 1.7; color: #1f1f22; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 48px 40px; }
  h1 { font-size: 16px; font-weight: 700; text-align: center; letter-spacing: 0.08em; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: 700; text-align: center; color: #555; margin-bottom: 32px; letter-spacing: 0.04em; }
  .ref { text-align: center; font-family: monospace; font-size: 12px; color: #888; margin-bottom: 40px; }
  .partes { border: 1px solid #d0ccc5; padding: 20px 24px; margin: 24px 0; }
  .partes table { width: 100%; border-collapse: collapse; }
  .partes td { padding: 4px 8px; vertical-align: top; font-size: 13px; }
  .partes td:first-child { width: 160px; color: #777; font-weight: 600; }
  .parte-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
  .clausula { margin: 20px 0; }
  .clausula-num { font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .clausula p { margin: 6px 0; }
  .highlight { background: #f9f6f1; border-left: 3px solid #e6356b; padding: 10px 16px; margin: 12px 0; font-weight: 600; }
  .firma { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .firma-box { border-top: 1px solid #999; padding-top: 12px; font-size: 13px; }
  .firma-box p { margin: 3px 0; }
  .aceptar-btn { display: block; text-align: center; background: #e6356b; color: #fff; text-decoration: none;
    padding: 14px 32px; font-family: monospace; font-size: 13px; letter-spacing: 0.05em; font-weight: 700;
    margin: 32px auto; max-width: 320px; }
  .legal-note { font-size: 12px; color: #888; font-style: italic; text-align: center; margin: 8px 0 32px; }
  hr { border: none; border-top: 1px solid #d0ccc5; margin: 32px 0; }
  @media print { .aceptar-btn, .legal-note { display: none; } }
</style>
</head>
<body>
<div class="page">

  <h1>CONTRATO DE PRESTACIÓN DE SERVICIOS DE TRAMITACIÓN DE SUBVENCIONES</h1>
  <h2>MODALIDAD COMISIÓN A ÉXITO</h2>
  <div class="ref">
    Expediente nº ${esc(data.expedienteId)} · Fecha: ${fechaContrato}
  </div>

  <p>En Granada, a ${fechaContrato}, las partes que se identifican a continuación, reconociéndose mutuamente capacidad legal suficiente para contratar y obligarse, acuerdan suscribir el presente contrato de prestación de servicios, que se regirá por las siguientes:</p>

  <h2 style="margin-top:28px">PARTES CONTRATANTES</h2>

  <div class="partes">
    <div class="parte-title">PRESTADOR DE SERVICIOS</div>
    <table>
      <tr><td>Razón social:</td><td><strong>${esc(STARTIDEA.razonSocial)}</strong></td></tr>
      <tr><td>CIF:</td><td>${esc(STARTIDEA.cif)}</td></tr>
      <tr><td>Domicilio:</td><td>${esc(STARTIDEA.domicilio)}, ${esc(STARTIDEA.cp)} ${esc(STARTIDEA.ciudad)}, ${esc(STARTIDEA.pais)}</td></tr>
      <tr><td>Inscripción:</td><td>${esc(STARTIDEA.registro)}</td></tr>
      <tr><td>Contacto:</td><td>${esc(STARTIDEA.email)} · ${esc(STARTIDEA.web)}</td></tr>
    </table>
    <div style="margin-top:16px" class="parte-title">CLIENTE (SOLICITANTE)</div>
    <table>
      <tr><td>Denominación:</td><td><strong>${esc(data.orgNombre)}</strong></td></tr>
      <tr><td>CIF/NIF:</td><td>${esc(data.orgCif)}</td></tr>
      <tr><td>Tipo de entidad:</td><td>${esc(data.orgTipo)}</td></tr>
      <tr><td>Representante:</td><td>${esc(data.representante)}</td></tr>
      <tr><td>Email:</td><td>${esc(data.email)}</td></tr>
      ${data.telefono ? `<tr><td>Teléfono:</td><td>${esc(data.telefono)}</td></tr>` : ''}
      <tr><td>Domicilio:</td><td>${esc(data.provincia)}</td></tr>
    </table>
  </div>

  <h2 style="margin-top:28px">ESTIPULACIONES</h2>

  <div class="clausula">
    <div class="clausula-num">Primera. — Objeto del contrato</div>
    <p>El PRESTADOR se compromete a prestar al CLIENTE los servicios de tramitación, redacción de documentación, asesoramiento y gestión de la solicitud de la siguiente ayuda pública:</p>
    <div class="highlight">
      Convocatoria: ${esc(convNombre)}
    </div>
    <p>Los servicios comprenden, sin carácter limitativo: análisis de elegibilidad, redacción de la memoria técnica y presupuesto, elaboración del checklist documental, orientación en la presentación telemática y seguimiento del expediente hasta resolución definitiva.</p>
  </div>

  <div class="clausula">
    <div class="clausula-num">Segunda. — Honorarios y forma de pago</div>
    <p>Los honorarios del PRESTADOR se articulan exclusivamente como comisión a éxito, sin que el CLIENTE deba abonar cantidad alguna en caso de resolución desestimatoria:</p>
    <div class="highlight">
      Comisión: <strong>${comision}% (${comision} por ciento)</strong> sobre el importe neto concedido y <strong>efectivamente cobrado</strong> por el CLIENTE, sin incluir IVA.
    </div>
    <p>El devengo de los honorarios se producirá en el momento en que el CLIENTE reciba el importe concedido en su cuenta bancaria. El CLIENTE deberá abonar la factura correspondiente en un plazo máximo de <strong>treinta (30) días naturales</strong> desde dicha fecha.</p>
    <p>El CLIENTE se compromete a comunicar al PRESTADOR la resolución de concesión, el importe definitivo y la fecha de cobro, dentro de los cinco (5) días hábiles siguientes a cada uno de dichos hitos.</p>
  </div>

  <div class="clausula">
    <div class="clausula-num">Tercera. — Exclusividad y no competencia</div>
    <p>Durante la vigencia del presente contrato, el CLIENTE no podrá encargar a ningún otro prestador de servicios la tramitación de esta misma convocatoria. En caso de incumplimiento, el CLIENTE deberá abonar al PRESTADOR una indemnización equivalente al ${comision}% del importe máximo de la convocatoria.</p>
  </div>

  <div class="clausula">
    <div class="clausula-num">Cuarta. — Obligaciones del cliente</div>
    <p>El CLIENTE se compromete a:</p>
    <ul style="padding-left:20px;margin:8px 0">
      <li>Facilitar al PRESTADOR, en tiempo y forma, toda la documentación e información necesarias para la tramitación.</li>
      <li>Revisar y validar los documentos generados, completando los campos marcados con [COMPLETAR] con datos reales y verificables.</li>
      <li>No presentar la solicitud con datos erróneos o documentación falsa.</li>
      <li>Comunicar al PRESTADOR cualquier requerimiento de subsanación o solicitud de información adicional por parte del organismo convocante.</li>
      <li>Notificar la resolución y el cobro en los plazos indicados en la cláusula Segunda.</li>
    </ul>
  </div>

  <div class="clausula">
    <div class="clausula-num">Quinta. — Vigencia</div>
    <p>El presente contrato entra en vigor en la fecha de aceptación por parte del CLIENTE y mantendrá su vigencia hasta la resolución definitiva del procedimiento de concesión y, en caso de concesión, hasta el pago íntegro de los honorarios.</p>
  </div>

  <div class="clausula">
    <div class="clausula-num">Sexta. — Confidencialidad y protección de datos</div>
    <p>Ambas partes se comprometen a mantener la más estricta confidencialidad sobre la información intercambiada en el marco de este contrato. El tratamiento de datos de carácter personal se realizará de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). El PRESTADOR actuará como encargado del tratamiento de los datos del CLIENTE estrictamente necesarios para la prestación del servicio.</p>
  </div>

  <div class="clausula">
    <div class="clausula-num">Séptima. — Limitación de responsabilidad</div>
    <p>El PRESTADOR no garantiza la concesión de la subvención, que depende exclusivamente de la decisión del organismo convocante. La responsabilidad del PRESTADOR se limita a la correcta prestación de los servicios de tramitación. En ningún caso el PRESTADOR responderá por resoluciones desfavorables debidas a causas ajenas a su actuación (cambios normativos sobrevenidos, modificación de las bases, insuficiencia presupuestaria, etc.).</p>
  </div>

  <div class="clausula">
    <div class="clausula-num">Octava. — Jurisdicción y ley aplicable</div>
    <p>El presente contrato se rige por la legislación española. Para cualquier controversia derivada de su interpretación o ejecución, ambas partes se someten expresamente a los Juzgados y Tribunales de la ciudad de <strong>Granada</strong>, con renuncia a cualquier otro fuero que pudiera corresponderles.</p>
  </div>

  <hr>

  <div class="firma">
    <div class="firma-box">
      <p><strong>Por ${esc(STARTIDEA.razonSocial)}</strong></p>
      <p>${esc(STARTIDEA.domicilio)}, ${esc(STARTIDEA.cp)} ${esc(STARTIDEA.ciudad)}</p>
      <p>Fecha: ${fechaContrato}</p>
      <br><br>
      <p>Firma y sello del PRESTADOR</p>
    </div>
    <div class="firma-box">
      <p><strong>Por ${esc(data.orgNombre)}</strong></p>
      <p>${esc(data.representante)}</p>
      <p>En representación de la entidad</p>
      <br><br>
      <p>Firma del CLIENTE (representante legal)</p>
    </div>
  </div>

  <hr>

  <p style="font-size:13px;text-align:center;margin-bottom:16px">
    <strong>Aceptación electrónica</strong> — Para firmar este contrato electrónicamente, haz clic en el botón:
  </p>
  <a href="${acceptUrl}" class="aceptar-btn">
    ✅ Acepto las condiciones del contrato →
  </a>
  <p class="legal-note">
    Al hacer clic, quedará registrada tu aceptación con fecha, hora y dirección IP.<br>
    La aceptación electrónica tiene plena validez jurídica conforme al Art. 23 LSSI y Art. 1262 CC.
  </p>

  <p style="font-size:11px;color:#aaa;text-align:center;margin-top:32px">
    ${esc(STARTIDEA.razonSocial)} · CIF ${esc(STARTIDEA.cif)} · ${esc(STARTIDEA.domicilio)}, ${esc(STARTIDEA.cp)} ${esc(STARTIDEA.ciudad)} ·
    <a href="${esc(STARTIDEA.web)}" style="color:#aaa">${esc(STARTIDEA.web)}</a>
  </p>

</div>
</body>
</html>`;
}

// ─── Email de envío del contrato ──────────────────────────────────────────────

export function generarEmailContratoHtml(data: ContratoData): string {
  const primerNombre = data.representante.split(' ')[0];
  const acceptUrl = `https://startidea.es/contrato/${data.contratoToken}`;
  const convNombre = data.convocatoriaTitle ?? 'la convocatoria seleccionada';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;color:#1f1f22;background:#f9fafb;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">

  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:0 0 24px">
    — Startidea · Contrato de servicios
  </p>

  <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#1f1f22">
    Hola, ${esc(primerNombre)}. Aquí está el contrato para firmar.
  </h1>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px">
    Para continuar con la tramitación de <strong>${esc(convNombre)}</strong> por parte de Startidea,
    necesitamos que revises y aceptes el contrato de prestación de servicios.
  </p>

  <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:16px 20px;margin:16px 0;font-size:14px;color:#0369a1">
    <strong>Lo más importante del contrato:</strong>
    <ul style="margin:8px 0;padding-left:20px;line-height:1.8">
      <li><strong>Sin coste si no te conceden la subvención.</strong> Solo pagas si cobras.</li>
      <li>Comisión de <strong>${STARTIDEA.comisionPct}%</strong> sobre el importe concedido y cobrado.</li>
      <li>Plazo de pago: 30 días desde que recibas el importe en tu cuenta.</li>
      <li>Startidea gestiona esta convocatoria en exclusiva.</li>
    </ul>
  </div>

  <p style="font-size:14px;line-height:1.6;color:#444;margin:20px 0">
    El contrato completo con todas las cláusulas está disponible en el enlace. Léelo antes de aceptar:
  </p>

  <a href="${acceptUrl}"
     style="display:inline-block;background:#e6356b;color:#fff;text-decoration:none;padding:14px 32px;font-family:monospace;font-size:13px;letter-spacing:0.05em;font-weight:700;margin:8px 0 24px">
    Ver y firmar contrato →
  </a>

  <p style="font-size:12px;color:#888;margin:0 0 24px">
    O copia esta URL: <span style="font-family:monospace;word-break:break-all">${acceptUrl}</span>
  </p>

  <hr style="border:none;border-top:1px solid #e0ddd8;margin:28px 0">

  <p style="font-size:13px;color:#888">
    ¿Tienes dudas sobre alguna cláusula? Responde a este email o escríbenos a
    <a href="mailto:${esc(STARTIDEA.email)}" style="color:#e6356b">${esc(STARTIDEA.email)}</a>
    indicando el expediente <strong>${esc(data.expedienteId)}</strong>.
  </p>

  <p style="font-size:12px;color:#bbb;margin-top:20px">
    ${esc(STARTIDEA.razonSocial)} · CIF ${esc(STARTIDEA.cif)} · ${esc(STARTIDEA.domicilio)}, ${esc(STARTIDEA.cp)} ${esc(STARTIDEA.ciudad)}
  </p>
</div>
</body>
</html>`;
}
