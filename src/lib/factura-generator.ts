/**
 * factura-generator.ts
 *
 * Genera el HTML imprimible de la factura de comisión a éxito.
 * La factura se puede imprimir directamente desde /admin/expedientes/[id]/factura
 * o convertir a PDF via Ctrl+P del navegador.
 *
 * Formato legal español mínimo (Art. 6 RD 1619/2012):
 *   - Número y serie de factura
 *   - Fecha de expedición
 *   - Datos completos del emisor (NIF, razón social, domicilio)
 *   - Datos del destinatario
 *   - Descripción de la operación
 *   - Tipo impositivo aplicado (IVA 21%)
 *   - Base imponible, cuota y total
 */

import { STARTIDEA } from './contrato-generator';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function fmtEur(amount: number): string {
  return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(ts?: number): string {
  const d = ts ? new Date(ts * 1000) : new Date();
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

const IVA_PCT = 21; // IVA vigente en España para servicios profesionales

export interface FacturaData {
  facturaNum:        string;    // FAC-YYYY-NNN
  facturaAt:         number;    // timestamp de generación
  expedienteId:      string;
  convocatoriaTitle: string | null;
  orgNombre:         string;
  orgCif:            string;
  orgTipo:           string;
  representante:     string;
  email:             string;
  telefono:          string;
  provincia:         string;
  importeConcedido:  number;    // en euros, sin IVA
}

export interface FacturaCalculo {
  baseImponible: number;
  cuotaIva:      number;
  total:         number;
}

export function calcularFactura(importeConcedido: number): FacturaCalculo {
  const baseImponible = Math.round(importeConcedido * STARTIDEA.comisionPct) / 100;
  const cuotaIva = Math.round(baseImponible * IVA_PCT) / 100;
  const total = Math.round((baseImponible + cuotaIva) * 100) / 100;
  return { baseImponible, cuotaIva, total };
}

export function generarFacturaHtml(data: FacturaData): string {
  const { baseImponible, cuotaIva, total } = calcularFactura(data.importeConcedido);
  const fechaFactura = fmtDate(data.facturaAt);
  const convNombre = data.convocatoriaTitle ?? 'Convocatoria de subvención (ver expediente)';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factura ${esc(data.facturaNum)} · Startidea</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 13px; color: #1f1f22; background: #fff; }
  .page { max-width: 860px; margin: 0 auto; padding: 48px 40px; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .logo-area h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.04em; }
  .logo-area p { font-size: 12px; color: #777; margin-top: 4px; }
  .factura-num { text-align: right; }
  .factura-num .label { font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; }
  .factura-num .num { font-family: monospace; font-size: 20px; font-weight: 700; color: #e6356b; margin: 2px 0; }
  .factura-num .fecha { font-size: 12px; color: #555; }

  /* Partes */
  .partes { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 32px 0; }
  .parte { padding: 16px; background: #f9f6f1; }
  .parte h2 { font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 10px; }
  .parte p { margin: 3px 0; font-size: 13px; }
  .parte strong { color: #1f1f22; }

  /* Concepto */
  .concepto { margin: 24px 0; }
  .concepto h2 { font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 10px; }
  table.lineas { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.lineas th { background: #1f1f22; color: #fff; padding: 8px 12px; text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  table.lineas td { padding: 12px; border-bottom: 1px solid #e8e4de; vertical-align: top; }
  table.lineas td:last-child { text-align: right; font-family: monospace; white-space: nowrap; }

  /* Totales */
  .totales { margin-top: 8px; display: flex; justify-content: flex-end; }
  .totales table { border-collapse: collapse; min-width: 300px; }
  .totales td { padding: 6px 12px; font-size: 13px; }
  .totales td:first-child { color: #777; text-align: right; }
  .totales td:last-child { text-align: right; font-family: monospace; min-width: 120px; }
  .totales tr.total td { font-weight: 700; font-size: 16px; border-top: 2px solid #1f1f22; padding-top: 10px; }
  .totales tr.total td:last-child { color: #e6356b; }

  /* Pie */
  .pie { margin-top: 40px; border-top: 1px solid #e0ddd8; padding-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 12px; color: #888; line-height: 1.6; }
  .pie h3 { font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #aaa; margin-bottom: 6px; }

  /* Print */
  @media print {
    body { font-size: 11px; }
    .page { padding: 24px 20px; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      <h1>${esc(STARTIDEA.razonSocial)}</h1>
      <p>${esc(STARTIDEA.domicilio)}, ${esc(STARTIDEA.cp)} ${esc(STARTIDEA.ciudad)}</p>
      <p>CIF: ${esc(STARTIDEA.cif)} · ${esc(STARTIDEA.email)}</p>
    </div>
    <div class="factura-num">
      <div class="label">Factura nº</div>
      <div class="num">${esc(data.facturaNum)}</div>
      <div class="fecha">Fecha de expedición: ${fechaFactura}</div>
    </div>
  </div>

  <!-- Partes -->
  <div class="partes">
    <div class="parte">
      <h2>Emisor</h2>
      <p><strong>${esc(STARTIDEA.razonSocial)}</strong></p>
      <p>CIF: ${esc(STARTIDEA.cif)}</p>
      <p>${esc(STARTIDEA.domicilio)}</p>
      <p>${esc(STARTIDEA.cp)} ${esc(STARTIDEA.ciudad)}, ${esc(STARTIDEA.provincia)}</p>
      <p>${esc(STARTIDEA.pais)}</p>
    </div>
    <div class="parte">
      <h2>Destinatario</h2>
      <p><strong>${esc(data.orgNombre)}</strong></p>
      <p>CIF/NIF: ${esc(data.orgCif)}</p>
      ${data.representante ? `<p>Att.: ${esc(data.representante)}</p>` : ''}
      <p>${esc(data.provincia)}</p>
      ${data.email ? `<p>${esc(data.email)}</p>` : ''}
    </div>
  </div>

  <!-- Concepto -->
  <div class="concepto">
    <h2>Concepto / Descripción de la operación</h2>
    <table class="lineas">
      <thead>
        <tr>
          <th>Descripción</th>
          <th style="width:120px;text-align:right">Importe base</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Honorarios por tramitación y gestión de solicitud de subvención</strong><br>
            Convocatoria: ${esc(convNombre)}<br>
            <span style="color:#777;font-size:12px">
              Comisión a éxito del ${esc(String(STARTIDEA.comisionPct))}% sobre importe concedido y cobrado de
              ${fmtEur(data.importeConcedido)} (según Contrato de prestación de servicios — Exp. ${esc(data.expedienteId)})
            </span>
          </td>
          <td>${fmtEur(baseImponible)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Totales -->
  <div class="totales">
    <table>
      <tr>
        <td>Base imponible:</td>
        <td>${fmtEur(baseImponible)}</td>
      </tr>
      <tr>
        <td>IVA (${IVA_PCT}%):</td>
        <td>${fmtEur(cuotaIva)}</td>
      </tr>
      <tr class="total">
        <td>TOTAL FACTURA:</td>
        <td>${fmtEur(total)}</td>
      </tr>
    </table>
  </div>

  <!-- Pie -->
  <div class="pie">
    <div>
      <h3>Datos de pago</h3>
      <p>Forma de pago: transferencia bancaria</p>
      <p>Plazo: 30 días desde la emisión</p>
      <p><em>Cuenta bancaria: [COMPLETAR IBAN]</em></p>
      <p>Concepto: ${esc(data.facturaNum)} · ${esc(data.expedienteId)}</p>
    </div>
    <div>
      <h3>Información legal</h3>
      <p>Operación sujeta y no exenta de IVA al tipo del ${IVA_PCT}%.</p>
      <p>Conserva este documento a efectos fiscales.</p>
      <p>${esc(STARTIDEA.razonSocial)} — ${esc(STARTIDEA.registro)}</p>
    </div>
  </div>

  <!-- Botón de impresión (no aparece al imprimir) -->
  <div class="no-print" style="margin-top:32px;text-align:center">
    <button onclick="window.print()"
      style="background:#1f1f22;color:#fff;border:none;padding:10px 28px;font-family:monospace;font-size:12px;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase">
      🖨 Imprimir / Guardar como PDF
    </button>
  </div>

</div>
</body>
</html>`;
}
