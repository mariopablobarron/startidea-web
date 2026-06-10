// Driver genérico de guía visual.
//
// Abre la sede, captura el acceso y, si encuentra un buscador, intenta
// localizar el trámite por el título de la convocatoria, capturando cada paso.
// NO rellena formularios, NO inicia sesión, NO firma, NO resuelve CAPTCHAs.
// Solo navegación y screenshots de páginas públicas.

export async function capturarGuia(page, opts) {
  const { sedeUrl, convTitulo } = opts;
  const pasos = [];

  const shot = async (titulo) => {
    const buffer = await page.screenshot({ type: 'jpeg', quality: 60, fullPage: false });
    pasos.push({ titulo, buffer });
  };

  await page.goto(sedeUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  await shot('1 · Acceso a la sede electrónica');

  // Intento genérico de localizar el trámite con el buscador de la sede.
  if (convTitulo) {
    const term = String(convTitulo).split(/\s+/).slice(0, 6).join(' ');
    const selectores = [
      'input[type="search"]',
      'input[name*="buscar" i]',
      'input[placeholder*="buscar" i]',
      'input[aria-label*="buscar" i]',
      'input[name*="search" i]',
      'input[type="text"]',
    ];
    for (const sel of selectores) {
      const el = page.locator(sel).first();
      const visible = (await el.count()) > 0 && (await el.isVisible().catch(() => false));
      if (!visible) continue;
      await el.fill(term).catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1800);
      await shot(`2 · Búsqueda del trámite: "${term}"`);
      break;
    }
  }

  return { pasos };
}
