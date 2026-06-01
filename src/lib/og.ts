import satori from 'satori';
import { html as toReactNode } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Carga de fuentes ───────────────────────────────────────
// Path absoluto desde cwd — funciona igual en dev y build
const fontsDir = join(process.cwd(), 'public/fonts');

const montserratRegular = readFileSync(join(fontsDir, 'Montserrat-400.ttf'));
const montserratSemiBold = readFileSync(join(fontsDir, 'Montserrat-600.ttf'));
const montserratBlack = readFileSync(join(fontsDir, 'Montserrat-900.ttf'));
const montserratBlackItalic = readFileSync(join(fontsDir, 'Montserrat-900i.ttf'));

// ─── Logo oficial (manual de marca) ─────────────────────────
// Lockup oficial (isotipo + wordmark) en color sobre blanco. Se embebe
// como data URI porque Satori no resuelve rutas/URLs de imagen.
const logoBuf = readFileSync(join(process.cwd(), 'public/brand/logo-isotipo-only.png'));
const LOGO_DATA_URI = `data:image/png;base64,${logoBuf.toString('base64')}`;

// ─── Paleta marca (manual: blanco puro · magenta corporativo · tinta) ──
const PALETTE = {
  paper: '#ffffff',
  paperWarm: '#f3f4f6',
  ink: '#3d3d40',
  inkSoft: '#4a4a4d',
  inkMute: '#6e6f70',
  magenta: '#e6356b',
};

// ─── Tipos ──────────────────────────────────────────────────
export type OgKind = 'home' | 'page' | 'nota' | 'caso';

export interface OgInput {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  accent?: string;
  kind?: OgKind;
}

// ─── Helper: escape HTML ────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Renderer ───────────────────────────────────────────────
export async function renderOg(input: OgInput): Promise<Uint8Array> {
  const { title, subtitle, eyebrow, accent } = input;

  // Tamaño tipográfico según longitud del título
  const titleLength = title.length;
  const titleSize = titleLength > 80 ? 64 : titleLength > 50 ? 80 : 96;

  // Construyo el title con accent en italic magenta si procede
  let titleHTML: string;
  if (accent && title.includes(accent)) {
    const idx = title.indexOf(accent);
    const before = esc(title.slice(0, idx));
    const accentEsc = esc(accent);
    const after = esc(title.slice(idx + accent.length));
    titleHTML = `
      <span>${before}</span><span style="color:${PALETTE.magenta};font-style:italic;">${accentEsc}</span><span>${after}</span>
    `;
  } else {
    titleHTML = `<span>${esc(title)}</span>`;
  }

  const subtitleBlock = subtitle
    ? `<div style="display:flex;margin-top:24px;font-size:26px;font-weight:400;line-height:1.4;letter-spacing:-0.005em;color:${PALETTE.ink};opacity:0.85;max-width:880px;">${esc(subtitle)}</div>`
    : '';

  const eyebrowBlock = eyebrow
    ? `<span style="font-size:14px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${PALETTE.inkMute};">${esc(eyebrow)}</span>`
    : '<span></span>';

  const markup = `
    <div style="
      width:1200px;
      height:630px;
      display:flex;
      flex-direction:column;
      background-color:${PALETTE.paper};
      font-family:Montserrat;
      padding:64px 72px;
      position:relative;
    ">
      <!-- Bloque magenta esquina inferior derecha (firma marca) -->
      <div style="
        position:absolute;
        bottom:0;
        right:0;
        width:180px;
        height:8px;
        background-color:${PALETTE.magenta};
        display:flex;
      "></div>

      <!-- Cabecera: wordmark + eyebrow -->
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        width:100%;
      ">
        <div style="display:flex;align-items:center;">
          <img src="${LOGO_DATA_URI}" width="116" height="116" style="width:116px;height:116px;object-fit:contain;" />
        </div>
        ${eyebrowBlock}
      </div>

      <!-- Línea separadora -->
      <div style="
        width:100%;
        height:1px;
        background-color:${PALETTE.ink};
        opacity:0.15;
        margin-top:36px;
        display:flex;
      "></div>

      <!-- Bloque principal -->
      <div style="
        flex:1;
        display:flex;
        flex-direction:column;
        justify-content:center;
        margin-top:16px;
        margin-bottom:16px;
      ">
        <div style="
          display:flex;
          flex-wrap:wrap;
          color:${PALETTE.ink};
          font-size:${titleSize}px;
          font-weight:900;
          line-height:1.02;
          letter-spacing:-0.035em;
          max-width:100%;
        ">${titleHTML}</div>
        ${subtitleBlock}
      </div>

      <!-- Línea pie -->
      <div style="
        width:100%;
        height:1px;
        background-color:${PALETTE.ink};
        opacity:0.15;
        margin-bottom:18px;
        display:flex;
      "></div>
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        font-size:15px;
        font-weight:600;
        letter-spacing:0.18em;
        text-transform:uppercase;
        color:${PALETTE.inkMute};
      ">
        <span style="color:${PALETTE.ink};">startidea.es</span>
        <span>Innovación social · Granada · Est. 2011</span>
      </div>
    </div>
  `;

  const node = toReactNode(markup);

  const svg = await satori(node as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Montserrat', data: montserratRegular, weight: 400, style: 'normal' },
      { name: 'Montserrat', data: montserratSemiBold, weight: 600, style: 'normal' },
      { name: 'Montserrat', data: montserratBlack, weight: 900, style: 'normal' },
      { name: 'Montserrat', data: montserratBlackItalic, weight: 900, style: 'italic' },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    background: PALETTE.paper,
  });

  return resvg.render().asPng();
}
