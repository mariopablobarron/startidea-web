/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    // Breakpoints extendidos para monitores grandes y TVs (4K/5K).
    // Mantenemos los defaults Tailwind y añadimos 3xl/4xl/5xl.
    screens: {
      'sm':  '640px',
      'md':  '768px',
      'lg':  '1024px',
      'xl':  '1280px',
      '2xl': '1536px',
      '3xl': '1920px', // FHD landscape, monitor estándar grande
      '4xl': '2560px', // QHD / monitor 27"+
      '5xl': '3200px', // 4K downscaled / TV grande
    },
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
        // Escala display con clamp() — escala fluido desde móviles pequeños (360px)
        // hasta TVs 4K. Mínimos pensados para que el texto largo quepa en 360px.
        'display-xl': ['clamp(2.5rem, 9vw, 12rem)',   { lineHeight: '0.96', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.125rem, 6.5vw, 8.5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.75rem, 4.5vw, 5.25rem)',  { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'lede':       ['clamp(1.125rem, 1.75vw, 1.875rem)', { lineHeight: '1.5', letterSpacing: '-0.005em' }],
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
