---
title: 'Hemos rehecho startidea.es en doce horas. Aquí está el método.'
description: 'WordPress fuera, Astro 5 + Node + un VPS infrautilizado dentro. Cero coste extra, código abierto y un agente trabajando 24/7. Notas de campo de una migración real.'
pubDate: 2026-04-28
audience: 'Empresas con propósito'
tags: ['producto', 'tecnología', 'startidea', 'caso']
draft: false
---

Esta web que estás leyendo es nueva. La anterior llevaba años en WordPress y, como tantas webs de tantas agencias del sector, **había envejecido sin que la mirásemos**. La nueva la hemos construido en doce horas. No por presumir de velocidad, sino para contarlo: porque lo que aplicamos en casa es exactamente lo que defendemos para nuestros clientes.

## El diagnóstico que nos hicimos en casa

Tres heridas que reconocimos sin discusión:

1. La home antigua pesaba mucho y no contaba lo que hacemos en menos de cinco segundos. La gente se iba antes de leer.
2. Los servicios estaban escondidos en menús desplegables que nadie abría. **Si tienes que explicar tu propio menú, el menú está mal.**
3. La pieza editorial — diagnósticos, notas, casos — estaba dispersa o no existía. Una agencia de innovación social con cero diagnósticos públicos es una agencia que dice "haz lo que digo, no lo que hago".

## El método

No fue magia. Fue una decisión consciente de no contratar agencia, no abrir Figma, no pedir presupuesto a tres proveedores. Lo hicimos así:

- **Stack abierto y sobrio**: Astro 5 estático con SSR mínimo donde hace falta (formulario de contacto al bot de Telegram). Tailwind para el estilo. Node adapter en un VPS Coolify que ya teníamos pagado y desaprovechado.
- **Migración por iteración**: cada hora desplegábamos. Veinte despliegues a producción en doce horas. Cada uno mejoraba algo concreto, ninguno rompió nada.
- **Asistencia con IA bien dirigida**: no como atajo, como amplificador. La IA escribe el código que tú sabes corregir; tú decides qué se publica y con qué tono. **El método no es la IA, es saber qué pedirle**.
- **Cero coste extra**: VPS ya pagado, dominio ya pagado, hosting compartido como red de seguridad. La factura de la nueva web es cero euros adicionales al mes.

## Lo que ahora hace nuestra web

- Carga rápida, mobile-first verificado en pantallas de 360 px hasta 4K.
- Un Laboratorio público de diagnósticos de fundraising — empezando por casos anonimizados que muestran cómo pensamos antes de proponer.
- Chat directo a nuestro Telegram, sin pixeles de tracking, sin cookies de terceros más allá del calendario de citas.
- Un agente automatizado que cada mañana audita la web, propone ideas para el Laboratorio y para estas notas, y deja un reporte ejecutivo. Trabaja por la casa mientras dormimos.

## Lo que aprendimos (y lo que vamos a recomendar)

Lo que vivimos en doce horas vale como diagnóstico para mucha entidad del tercer sector que se siente atrapada en una web envejecida y un presupuesto técnico que no llega.

1. **El presupuesto que no llega normalmente sí llega**, pero está atrapado en un stack equivocado. Hostings caros, plugins caros, mantenimiento caro — porque la decisión técnica original fue conservadora y se acumuló.
2. **No hace falta rehacer todo a la vez**. Hace falta empezar a desplegar pequeño y mejorar cada día. Una organización que despliega cuatro cosas al año a su web no se acerca al ritmo de su propia operación.
3. **La IA bien usada baja el coste de hacer las cosas bien, no baja la calidad**. La diferencia entre "lo hizo la IA" y "lo hizo bien" sigue dependiendo del criterio humano. Sin criterio, la IA acelera el desastre. Con criterio, multiplica el músculo.
4. **El sector necesita normalizar que las propias organizaciones publiquen su trabajo metodológico**. Un Laboratorio público de diagnósticos no es vanidad; es la forma honesta de decirle al donante potencial cómo piensas.

## Lo siguiente

En las próximas semanas vamos a publicar más diagnósticos de fundraising en el [Laboratorio](/laboratorio/fundraising/) — del tercer sector estatal, de discapacidad, infancia, mayores. Cada uno con su radiografía, sus palancas y sus aprendizajes transferibles.

Si lees todo esto y reconoces a tu organización en alguna de las heridas, [escríbenos](/contacto). La primera conversación es de treinta minutos. Sin compromiso. Te decimos honestamente si encajamos antes de que tú decidas invertir nada.

---

*Esta nota se publica con la web ya en producción. Cualquier cosa que veas que no funciona, dínosla — la arreglamos en horas, no en semanas. Esa es la promesa que hace el método.*
