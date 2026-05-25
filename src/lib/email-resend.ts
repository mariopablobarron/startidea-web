// Helper reutilizable para enviar email via Resend.
// Lo usan /api/contacto, /api/presupuesto y /api/recursos/solicitar para
// notificar a Mario (hola@startidea.es) además del Telegram operativo.
//
// Si RESEND_API_KEY no está configurada, los envíos fallan silenciosamente
// (con warning en console) — el form sigue siendo exitoso porque la
// notificación Telegram ya cumple su función.

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  /** Opcional. Si no se pasa, usa RESEND_REPLY_TO. */
  replyTo?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const RESEND_KEY = process.env.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM ?? import.meta.env.RESEND_FROM ?? "Startidea <hola@startidea.es>";
  const REPLY_TO = payload.replyTo ?? process.env.RESEND_REPLY_TO ?? import.meta.env.RESEND_REPLY_TO ?? "hola@startidea.es";

  if (!RESEND_KEY) {
    console.warn("[email-resend] RESEND_API_KEY no configurada — saltando");
    return false;
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        reply_to: REPLY_TO,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error(`[email-resend] Resend ${r.status}: ${txt.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-resend] network error:", err);
    return false;
  }
}

/**
 * Email a Mario con los datos de un lead. Diseño editorial básico, sin imágenes.
 * Usado por contacto, presupuesto y recursos/solicitar.
 */
export async function sendOwnerLeadEmail(opts: {
  subject: string;
  /** Email del operador que recibe el aviso. Default hola@startidea.es */
  to?: string;
  leadName: string;
  leadEmail: string;
  /** Render HTML del cuerpo (sin <html>, <body>, etc — el helper envuelve). */
  bodyHtml: string;
  /** Reply-To por defecto = email del lead (para responder directo). */
}): Promise<boolean> {
  const wrappedHtml = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;background:#fafaf7">
  <p style="margin:0 0 16px 0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.12em">Startidea — Lead capturado</p>
  ${opts.bodyHtml}
  <hr style="border:0;border-top:1px solid #eee;margin:32px 0 12px 0" />
  <p style="font-size:11px;color:#999;margin:0">
    Responde directamente a este email para contactar con <strong>${escapeHtml(opts.leadName)}</strong> (${escapeHtml(opts.leadEmail)}).
  </p>
</body></html>`;

  return sendEmail({
    to: opts.to ?? "hola@startidea.es",
    subject: opts.subject,
    html: wrappedHtml,
    // Importante: reply-to apunta al lead para responder directo desde la bandeja
    replyTo: opts.leadEmail,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
