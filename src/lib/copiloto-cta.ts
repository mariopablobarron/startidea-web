/**
 * copiloto-cta.ts
 *
 * Bloque CTA premium reutilizable para los emails automáticos del Copiloto.
 * El objetivo es convertir el matching gratuito en cliente de pago
 * (servicio de presentación gestionada con comisión 12% al éxito).
 *
 * Se inserta en:
 *  - trigger.ts (cron diario HUB externo)
 *  - match-catalog.ts (activación manual del catálogo local)
 *
 * Tracking:
 *  - UTM params para medir conversión email → wizard
 *  - como_conocio="copiloto-autonomo-cta" en el expediente generado
 */

interface PremiumCTAOpts {
  convocatoriaSlug:    string;
  convocatoriaTitle:   string;
  expedienteId:        string;
  /** ¿Esta convocatoria viene del catálogo local? (impacta URL del wizard) */
  fuente?:             'hub' | 'catalogo';
}

/**
 * Construye la URL del wizard pre-rellenada con la convocatoria + tracking UTM.
 */
export function buildWizardUrl(opts: PremiumCTAOpts): string {
  const params = new URLSearchParams({
    slug: opts.convocatoriaSlug,
    title: opts.convocatoriaTitle.slice(0, 120),
    utm_source: 'copiloto-autonomo',
    utm_medium: 'email',
    utm_campaign: opts.fuente === 'catalogo' ? 'catalog-match' : 'hub-match',
    utm_content: opts.expedienteId,
  });
  return `https://startidea.es/subvenciones/presentar/nuevo?${params.toString()}`;
}

/**
 * HTML del bloque CTA premium destacado.
 *
 * Diseño: bloque oscuro destacado que rompe la lectura plana, con icono,
 * propuesta de valor en 4 bullets, precio (12% éxito) y botón claro.
 *
 * Posicionamiento: tras la guía de presentación, antes del footer del email.
 */
export function buildPremiumCTAHtml(opts: PremiumCTAOpts): string {
  const wizardUrl = buildWizardUrl(opts);
  return `
  <!-- ─── CTA PREMIUM: Presentación gestionada ────────────────────────────── -->
  <div style="background:#1f1f22;border:1px solid #1f1f22;padding:32px 28px;margin:32px 0;color:#faf8f5">
    <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#e6356b;margin:0 0 12px;font-weight:700">
      ¿Quieres ahorrarte el trabajo?
    </p>
    <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:700;line-height:1.25;margin:0 0 14px;color:#faf8f5">
      Que Startidea presente esta convocatoria por ti.
    </h2>
    <p style="font-size:14px;line-height:1.65;color:#cfc9bf;margin:0 0 18px">
      El Copiloto es la base. Para presentarla con garantías de éxito hace falta
      adaptar la memoria al proyecto real, revisar la elegibilidad con criterio
      legal y manejar la sede electrónica (Autofirma incluido).
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 22px">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#e0ddd8;line-height:1.5">
          <span style="color:#e6356b;font-weight:700">✓</span>&nbsp;&nbsp;Memoria técnica adaptada al proyecto y al baremo de la convocatoria
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#e0ddd8;line-height:1.5">
          <span style="color:#e6356b;font-weight:700">✓</span>&nbsp;&nbsp;Revisión legal de los requisitos y subsanación de documentación
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#e0ddd8;line-height:1.5">
          <span style="color:#e6356b;font-weight:700">✓</span>&nbsp;&nbsp;Presentación en sede electrónica gestionada (te ahorras Autofirma)
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#e0ddd8;line-height:1.5">
          <span style="color:#e6356b;font-weight:700">✓</span>&nbsp;&nbsp;Seguimiento hasta resolución y, si hace falta, justificación
        </td>
      </tr>
    </table>

    <div style="background:#2a2a2e;border-left:3px solid #e6356b;padding:14px 18px;margin:0 0 22px">
      <p style="font-size:12px;color:#8a8580;margin:0 0 4px;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase">Precio</p>
      <p style="font-size:18px;color:#faf8f5;margin:0;font-weight:700">
        12% del importe concedido
      </p>
      <p style="font-size:12px;color:#a8a39a;margin:6px 0 0;line-height:1.5">
        Solo cobramos si la subvención se concede. Sin cuota fija, sin coste por evaluar.
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
      <tr>
        <td>
          <a href="${wizardUrl}"
             style="display:inline-block;background:#e6356b;color:#ffffff;text-decoration:none;padding:14px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-radius:0">
            Pedir presupuesto gestionado →
          </a>
        </td>
      </tr>
    </table>

    <p style="font-size:11px;color:#6f6a62;margin:16px 0 0;line-height:1.55">
      Te respondemos en menos de 24h con un análisis de viabilidad real y, si tiene
      encaje, te firmamos el contrato a éxito antes de tocar nada.
    </p>
  </div>`;
}
