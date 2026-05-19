# Checklist técnico — Vídeo institucional 90s

## Formatos de captura (rodaje)

| Parámetro | Valor | Notas |
|---|---|---|
| Resolución | 4K UHD (3840×2160) | Captar 4K para hacer crop / re-encuadre en post |
| FPS | 24fps (cinematográfico) | NO 25/30 — el look cine es 24p |
| Codec | ProRes 422 HQ o equivalente (H.265 si cámara no soporta ProRes) | Bitrate alto |
| Color | LOG (S-Log3, V-Log, C-Log3) | Color grading flexible en post |
| Audio | 48kHz / 24-bit | Estándar broadcast |
| Lavalier | Apagar gain automático | Manual gain |
| Boom | 1.5m sobre cabeza con caña, micrófono cardioide | Sonido cercano sin ruido |

## Color grading

### Look final

- **Base**: cálido natural. NO el orange-teal de Hollywood.
- **Acentos**: ligero magenta en los altos cuando aparece el dato sobreimpreso (alinea con la paleta web Startidea).
- **Skin tones**: respetar tonos reales. No saturar piel.
- **Contraste**: medio-bajo. No black crush.
- **Saturación general**: -10% del original. Cuidado con verdes (vegetación Granada se vuelve neón si no se controla).

### LUTs recomendadas (referencia, no estricto)

- **Para Sony S-Log3**: empezar con LUT técnico oficial Sony S-Log3 to Rec.709 + adjustments
- **Para Canon C-Log**: Canon LUT oficial + grading manual
- **Final**: Davinci Resolve o Premiere con Lumetri — sin caer en presets agresivos

## Sonido

### Mezcla final

| Pista | Niveles |
|---|---|
| Voz en off | -12 dB (de pico, normalizado) |
| Música | -22 dB (cuando voz en off habla), -16 dB (en pausas/transiciones) |
| Audio ambiente | -28 dB cuando aplique (ej. en planos de Granada exterior) |
| Master | -1 dB LUFS para web (estándar YouTube/Vimeo). -16 LUFS si plataforma exige |

### Música — opciones libres de derechos

Pistas instrumentales discretas, piano + cuerdas suaves, evitando:
- Música emocional manipulativa con crescendos
- Beats rítmicos electrónicos (no encaja con el tono editorial)
- Música clásica conocida (problemas de derechos en algunas plataformas)

**Plataformas recomendadas**:
- **Musicbed** (licencia comercial cara pero calidad alta) — https://www.musicbed.com
- **Artlist** (suscripción anual, librería amplia) — https://artlist.io
- **Epidemic Sound** (alternativa más barata) — https://www.epidemicsound.com
- **Soundstripe** (más simple, mensual) — https://soundstripe.com

### Música — composición original

Si presupuesto lo permite: encargar pieza original a compositor freelance. Coste 800-2.500 € para 90s con derechos cedidos totales.

## Entregables finales

### Versión Master 90s

- [ ] **Master 4K UHD** (3840×2160, 24fps, H.264 alta calidad o ProRes 422 HQ)
- [ ] **Master 1080p** (1920×1080, 24fps, H.264) para web y redes
- [ ] **Versión muda con subtítulos quemados** (1920×1080) para autoplay sin sonido
- [ ] **Versión con subtítulos SRT separado** (1080p + .srt) para YouTube/Vimeo accesibilidad

### Cortes adicionales

- [ ] **30s pre-roll** (Google Ads, redes sociales) — H.264 1080p
- [ ] **15s** (Stories/Reels vertical 1080×1920 + cuadrado 1080×1080) — H.264
- [ ] **6s bumper** (opcional, para YouTube Ads) — H.264 1080p

### Subtítulos

- [ ] **.srt español** (timing exacto del vídeo)
- [ ] **.srt inglés** (si hay clientes internacionales — opcional)
- [ ] **Subtítulos quemados** (para autoplay web sin controles)

### Documentación

- [ ] **Project file** (Premiere/Resolve) entregado al cliente con todos los assets vinculados
- [ ] **Lista de planos finales** con timecodes
- [ ] **Cesión de derechos** firmada por todos los participantes archivada
- [ ] **Licencia de música** archivada

## Configuración del hero web (después de subir el vídeo)

### Opción A — Vídeo autoplay muted en hero

```html
<video
  autoplay
  muted
  loop
  playsinline
  preload="auto"
  poster="/img/hero-poster.jpg"
  class="hero-video"
>
  <source src="/video/startidea-hero-90s-muted.mp4" type="video/mp4">
  <source src="/video/startidea-hero-90s-muted.webm" type="video/webm">
</video>
```

- `muted` + `playsinline` + `autoplay` permiten autoplay en iOS Safari
- Poster como fallback durante carga + fallback completo si JS desactivado
- Versión `.webm` (codec VP9) para Chrome — más comprimida
- Subtítulos sobreimpresos como parte del vídeo (no <track>)

### Opción B — Vídeo con play explícito + thumbnail editorial

- Hero muestra un frame editorial estático con play button magenta
- Click → modal o iframe con vídeo completo + sonido
- Mejor para Core Web Vitals (no autoplay = mejor LCP)
- Peor para conversión (menos visualizaciones)

**Recomendado**: empezar con A y medir 30 días. Si LCP empeora demasiado, pasar a B.

### Tamaño del archivo objetivo

- **Versión hero web (muted, autoplay)**: 4-8 MB máximo. Comprimir agresivamente.
- **Versión completa con sonido**: 12-20 MB.
- **Encode**: H.264 baseline para máxima compatibilidad, o H.265 si todos los navegadores objetivo lo soportan.

## Medición post-lanzamiento (GA4 + Microsoft Clarity)

### Eventos GA4 a configurar

- `video_play` — usuario hace play (o detecta autoplay)
- `video_25_percent` — completa el 25%
- `video_50_percent` — completa el 50%
- `video_75_percent` — completa el 75%
- `video_complete` — completa el 100%

### Métricas a vigilar primer mes

- **% que completa >75%**: objetivo > 35% (industria 25-30%)
- **CTR al diagnóstico tras ver el vídeo**: objetivo > 8%
- **Bounce rate del hero**: comparar 30 días antes/después
- **Heat map de Clarity**: ¿dónde abandonan? ¿en qué plano? Ajustar v2.

### Iteración a los 90 días

Análisis honesto:
- Si conversión sube < 15%: revisar guión, considerar v2 más corta (60s)
- Si conversión sube > 30%: producir variantes con otros casos (Down Granada, Tres Mil Millones)
- Caducidad esperable: 18-24 meses. Planificar v2 con tiempo.
