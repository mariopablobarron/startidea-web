---
title: "Whisper"
seoTitle: "Whisper: transcripción gratuita y local"
description: "El modelo de transcripción de código abierto de OpenAI. Convierte cualquier audio en texto con calidad profesional, gratis, y puede ejecutarse en el propio ordenador: el audio nunca sale de casa. Actas, entrevistas y testimonios, transcritos sin coste ni riesgo."
metaDescription: "Análisis de Whisper para transcribir reuniones y entrevistas gratis y en local: opciones sin código, privacidad y veredicto del Laboratorio de Startidea."
pubDate: 2026-08-19
web: "https://github.com/openai/whisper"
necesidad: "Audio y vídeo"
audience: ["Todas"]
precio: "Gratis"
nivel: "Intermedio"
para_que_si:
  - "Transcribir reuniones, entrevistas y testimonios con calidad profesional a coste cero"
  - "Audios sensibles: ejecutado en local, el archivo nunca sale del ordenador"
  - "Subtitular vídeos (genera los tiempos automáticamente)"
para_que_no:
  - "Quien necesite un botón sin instalación alguna (usar entonces una app que lo lleve dentro, como MacWhisper)"
  - "Transcripción en tiempo real durante la reunión"
riesgos:
  - "Confunde nombres propios y términos muy locales: revisar antes de dar un acta por buena"
alternativa: "La transcripción integrada de Teams/Meet, si la reunión ya ocurre ahí y la privacidad lo permite"
valoracion: 5
tags: ["transcripción", "código abierto", "privacidad", "subtítulos", "local"]
tldr: "Whisper transcribe audio a texto con calidad profesional, gratis y sin límite, y puede ejecutarse en el propio ordenador sin que el audio salga de él. Para entidades que manejan testimonios o actas sensibles, es la opción más respetuosa con las personas que existen."
faqs:
  - question: "¿Cómo usa Whisper alguien sin conocimientos técnicos?"
    answer: "Con aplicaciones que lo llevan integrado: MacWhisper (Mac) o Vibe (Windows/Mac/Linux, gratuita) permiten arrastrar el audio y obtener el texto sin tocar una línea de código, ejecutando todo en local."
  - question: "¿Qué precisión tiene en español?"
    answer: "Muy alta en audio razonablemente limpio: es de los mejores modelos en español, incluidos acentos. Baja con mucho ruido de fondo o varias personas solapadas, y tropieza con nombres propios: la revisión final sigue siendo humana."
---

## Qué es

Whisper es el modelo de reconocimiento de voz que OpenAI liberó como código abierto: cualquiera puede usarlo gratis y, esto es lo importante, ejecutarlo en su propio ordenador. Transcribe decenas de idiomas —el español, especialmente bien— y genera subtítulos con marcas de tiempo.

## Para el día a día de una organización

La transcripción es de los trabajos invisibles que más horas roban: actas de juntas, entrevistas de proyectos, testimonios para memorias. Whisper lo convierte en un proceso de minutos y coste cero.

La razón por la que el Laboratorio lo destaca sobre los servicios comerciales es la privacidad: ejecutado en local, el testimonio de una víctima, la entrevista a un menor o la deliberación de un patronato **nunca salen del ordenador de la organización**. Ningún servicio en la nube puede prometer eso.

## Cómo empezar

Sin conocimientos técnicos: instalar una app que lleve Whisper dentro (MacWhisper en Mac, Vibe en cualquier sistema), arrastrar el audio, esperar, revisar nombres propios. Con perfil técnico: `pip install openai-whisper` y una línea de terminal.
