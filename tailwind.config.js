/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // ─── Paleta Startidea (extraída del logo oficial) ───
        // Rosa magenta — acento único, vivo, accesible
        magenta: {
          DEFAULT: '#e6356b',
          dark: '#c41f54',
          light: '#f06289',
        },
        // Gris cálido del wordmark — tinta principal
        ink: {
          DEFAULT: '#3d3d40',  // un punto más oscuro que el del logo para texto largo
          soft: '#4a4a4d',     // exacto del wordmark "id"
          mute: '#6e6f70',     // exacto del trazo del bucle
          faint: '#9c9c9d',
        },
        // Fondo blanco roto, cálido, bajo en contraste con tinta
        paper: {
          DEFAULT: '#faf8f5',  // off-white casi imperceptible — más limpio que crema
          warm: '#f3efe8',
          deep: '#e8e2d6',
          line: '#d8d2c4',
        },
        // Verde se mantiene como acento institucional muy puntual (datos críticos, success)
        forest: '#1f3d2e',
        // Solo errores/atención
        signal: '#a83612',
      },
      fontFamily: {
        // Una sola familia para display y sans — Montserrat con pesos contrastados
        display: ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Escala display recalibrada para sans pesada (Montserrat 800/900)
        'display-xl': ['clamp(3.5rem, 9vw, 8.5rem)', { lineHeight: '0.94', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.75rem, 6.5vw, 6rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(2rem, 4.5vw, 3.75rem)', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'lede': ['clamp(1.25rem, 1.75vw, 1.5rem)', { lineHeight: '1.45', letterSpacing: '-0.005em' }],
      },
      letterSpacing: {
        wider: '0.18em',
        widest: '0.22em',
      },
      maxWidth: {
        'measure': '62ch',
      },
    },
  },
  plugins: [],
};
