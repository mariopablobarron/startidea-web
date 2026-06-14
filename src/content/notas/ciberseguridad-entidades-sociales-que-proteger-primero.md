---
title: 'Ciberseguridad para entidades sociales: qué proteger primero cuando no hay departamento de TI'
description: 'Guía honesta para ONGs, fundaciones e instituciones eclesiales sobre por dónde empezar a proteger los datos digitales. Sin alarmismo, sin jerga, con un orden de prioridades realista cuando los recursos son limitados.'
pubDate: 2026-05-26
audience: 'Tercer sector'
category: 'Estrategia'
tags: ['ciberseguridad', 'protección de datos', 'RGPD', 'ONG', 'fundaciones', 'tercer sector', 'instituciones eclesiales']
draft: false
faqs:
  - question: '¿Una ONG pequeña necesita preocuparse por ciberseguridad?'
    answer: 'Sí, aunque no del mismo modo que una empresa grande. Las entidades sociales gestionan datos especialmente sensibles —donantes, beneficiarios, en muchos casos menores o personas en situación de vulnerabilidad— y una brecha tiene impacto reputacional fuerte en un sector que vive de la confianza. La buena noticia es que el 80% del riesgo se cubre con medidas básicas que no requieren presupuesto técnico: contraseñas robustas con gestor, doble factor en todas las cuentas críticas, copias de seguridad reales y formación al equipo. Lo caro y complejo viene después, y solo si la entidad tiene activos digitales propios (plataformas, intranets, portales).'
  - question: '¿Qué obligaciones legales tiene una ONG en materia de ciberseguridad?'
    answer: 'El marco principal es el RGPD (Reglamento UE 2016/679) y la LOPDGDD española (Ley Orgánica 3/2018). Toda entidad que trate datos personales —y una ONG los trata por definición: donantes, voluntariado, beneficiarios— está obligada a aplicar "medidas técnicas y organizativas apropiadas" (Art. 32 RGPD). En la práctica eso significa: tener registro de actividades de tratamiento, contar con un encargado del tratamiento si externaliza servicios, notificar brechas a la AEPD en 72h cuando aplique, y nombrar DPO en algunos supuestos. La AEPD no perdona por ser ONG: hay sanciones impuestas a entidades sin ánimo de lucro.'
  - question: '¿Qué es una brecha de seguridad y qué hay que hacer si ocurre?'
    answer: 'Una brecha es cualquier incidente que vulnere la confidencialidad, integridad o disponibilidad de los datos personales: un email enviado a la lista equivocada, un portátil robado, un ataque de ransomware, una fuga por proveedor. El procedimiento es claro: contener el incidente, evaluar el riesgo para las personas afectadas, notificar a la AEPD en 72 horas si hay riesgo para los derechos y libertades, y comunicarlo a los afectados si el riesgo es alto. Tener este procedimiento escrito antes de que pase algo es lo que separa una crisis manejable de un desastre.'
  - question: '¿Es seguro usar Gmail, Google Drive o Microsoft 365 en una ONG?'
    answer: 'Sí, son significativamente más seguros que cualquier servidor de correo o de archivos auto-gestionado por una entidad sin equipo TI. Lo crítico no es el proveedor sino la configuración: doble factor obligatorio para todo el equipo, permisos mínimos, revisión periódica de qué se comparte con quién, y un contrato de encargado del tratamiento firmado con el proveedor (Google y Microsoft lo ofrecen estándar, hay que firmarlo). El riesgo real no está en el proveedor: está en la cuenta de la persona que reutiliza la contraseña en cinco sitios distintos.'
  - question: '¿Cuánto cuesta proteger digitalmente a una ONG mediana?'
    answer: 'Las medidas básicas tienen coste cercano a cero: un gestor de contraseñas familiar/equipo (€3-€5 por persona y mes), formación del equipo (una tarde al año), procedimientos escritos (tiempo interno). Una auditoría externa de exposición digital cuesta entre €800 y €1.500 según tamaño. Un pentest completo sobre una plataforma web propia oscila entre €3.000 y €8.000. Las entidades sin plataformas propias no necesitan la segunda parte. Gastar mucho en herramientas sin haber resuelto contraseñas y formación es el error más caro y frecuente.'
  - question: '¿Qué hago si descubro que un proveedor mío ha sufrido una brecha?'
    answer: 'Primero: confirmar si los datos de tu organización están afectados, pidiendo al proveedor un informe escrito. Segundo: revisar el contrato de encargado del tratamiento para verificar obligaciones y responsabilidades. Tercero: evaluar si la entidad debe notificar a la AEPD —en muchos casos sí, aunque la brecha fuera en el proveedor, porque el responsable del tratamiento sigue siendo la organización. Cuarto: comunicar a las personas afectadas si procede. Y aprender: una brecha en un proveedor revela qué tan dependiente es la entidad de él y qué alternativas tiene.'
  - question: '¿Startidea ofrece servicios de ciberseguridad?'
    answer: 'Sí, con un enfoque adaptado al tercer sector: tres niveles según la madurez digital de la entidad. Diagnóstico de exposición digital (revisión externa sin tocar nada, informe ejecutivo en 1-2 días), auditoría de seguridad web (pentest sobre portales, intranets o plataformas propias) y acompañamiento continuo en seguridad (suscripción mensual con monitorización de brechas, alertas de parches críticos y formación al equipo). La primera conversación de 30 minutos es sin coste. No se vende miedo: se evalúa qué hace falta de verdad para una entidad concreta y se prioriza.'
---

Cualquier organización que use tecnología depende de su seguridad digital. Lo que cambia, según el tamaño y los recursos, es **qué proteger primero**. Y para una ONG, una fundación o una institución eclesial sin departamento de TI, ese orden importa más que comprar herramientas.

Esta guía describe ese orden. Sin alarmismo, sin vender soluciones milagrosas, sin convertir cada riesgo teórico en una urgencia. Lo que sí hay es un mapa realista para entidades sociales que gestionan datos sensibles con presupuestos modestos.

## Lo primero: entender qué se está protegiendo

Antes de elegir herramientas o redactar políticas, conviene tener claro qué tiene la organización que merezca protección. En una entidad social los activos digitales suelen ser de cuatro tipos:

1. **Datos de personas vinculadas a la entidad**: equipo, voluntariado, donantes, socios, beneficiarios. En muchos casos incluyen categorías especiales del RGPD (salud, situación social, religión, datos de menores).
2. **Cuentas y herramientas operativas**: el correo institucional, el drive compartido, la plataforma de gestión de socios, las redes sociales, la pasarela de pago para donaciones.
3. **Comunicaciones internas y externas**: actas de juntas, correspondencia con organismos públicos, propuestas de proyecto, expedientes de subvenciones.
4. **Reputación**: cualquier incidente que se haga público afecta a una entidad que vive de la confianza —donantes, financiadores institucionales, beneficiarios.

El orden de proteger no es alfabético: es proporcional al impacto. Una filtración de la lista de donantes daña la reputación. Una filtración de datos de menores acompañados por la entidad puede tener consecuencias mucho más graves, incluidas sanciones de la AEPD que han llegado a centenares de miles de euros también para organizaciones sin ánimo de lucro.

## Capa 1: lo que toda entidad debe tener resuelto

Esto cubre, en proporción, el 80% del riesgo real. Son medidas que no requieren presupuesto técnico ni equipo TI dedicado.

### Contraseñas: gestor obligatorio para todo el equipo

La causa más frecuente de brechas en organizaciones pequeñas no es un hackeo sofisticado: es una contraseña reutilizada que apareció en una filtración de un servicio de terceros.

La solución es un **gestor de contraseñas para todo el equipo** —Bitwarden, 1Password, Proton Pass— con planes para equipos a 3-5€ por persona y mes. Una vez instalado:

- Contraseña única por servicio, generada por el gestor.
- Acceso compartido a cuentas institucionales (redes sociales, herramientas de gestión) sin que nadie tenga que ver la contraseña real.
- Cuando alguien deja la organización, se rota lo necesario sin pedirle nada.

La inversión es ridícula comparada con el coste de una brecha. La fricción inicial dura dos semanas. Después, el equipo no quiere volver atrás.

### Doble factor de autenticación: en todas las cuentas críticas

El doble factor (2FA o MFA) hace que aunque alguien obtenga la contraseña, no pueda entrar. Hay que activarlo, como mínimo:

- En el correo institucional (Gmail/Google Workspace, Microsoft 365).
- En el panel del dominio (registrador y DNS).
- En el banco y la pasarela de donaciones.
- En las redes sociales corporativas.
- En la plataforma de gestión de socios o CRM si la entidad la usa.

Preferiblemente con **aplicación de autenticación** (Authy, Google Authenticator, el gestor de contraseñas) o **llave de hardware** (YubiKey) en cuentas muy sensibles. Evitar SMS como segundo factor cuando se pueda, porque el SIM-swapping es real y barato.

### Copias de seguridad reales

"Real" significa: copia que no se borra si se borra el original, que se prueba periódicamente, y que está en un sitio físicamente distinto al original.

- **Google Workspace / Microsoft 365**: tienen papelera y versiones, pero no son backup. Si alguien borra una carpeta y pasan 30 días, no hay vuelta atrás. Existen servicios de backup específicos (Spanning, AvePoint, Synology Active Backup) que copian todo a un destino independiente.
- **Servidores propios o NAS**: la regla 3-2-1 —tres copias, en dos medios distintos, una fuera de la oficina— sigue vigente.
- **Probar la restauración** al menos una vez al año. Un backup que nunca se ha restaurado no es un backup, es una esperanza.

### Formación: una tarde al año, con ejemplos reales

Casi todas las brechas en entidades pequeñas empiezan en una persona del equipo: un correo de phishing que parece auténtico, una llamada suplantando al banco, un enlace en WhatsApp.

Una sesión anual de dos horas con casos reales —no presentaciones genéricas— rinde más que cualquier inversión en herramientas. Temas mínimos a tratar:

- Cómo identificar un correo de phishing (mirar el remitente real, sospechar de la urgencia, no hacer clic en enlaces sino escribir la URL).
- Qué hacer si se sospecha que se ha hecho clic en algo malo (avisar inmediatamente, no esconderlo).
- Qué información nunca se da por teléfono ni por mensaje, aunque parezca el banco o la administración.
- Cómo bloquear el ordenador al levantarse.
- Por qué el dispositivo personal donde se usa el correo institucional también es responsabilidad.

## Capa 2: orden interno y cumplimiento RGPD

Esta capa tiene menos que ver con tecnología y más con procedimientos escritos. Es donde la AEPD mira primero si hay una inspección.

### Registro de actividades de tratamiento

Documento obligatorio (Art. 30 RGPD) que lista qué datos personales trata la organización, para qué, con qué base legal, durante cuánto tiempo y a quién se comunican. No tiene que ser una obra maestra: hay plantillas gratuitas en la web de la AEPD.

Para una ONG suele incluir, mínimo:

- Datos de socios y donantes (base legal: ejecución de contrato y consentimiento para comunicaciones).
- Datos de voluntariado (base legal: ejecución de contrato).
- Datos de personal laboral (base legal: contrato y obligación legal).
- Datos de beneficiarios (base legal: depende del programa; consentimiento o interés público).
- Imágenes en redes sociales (base legal: consentimiento expreso).

### Contratos de encargado del tratamiento

Cuando la entidad usa proveedores que tratan datos personales en su nombre —Google Workspace, Mailchimp, la plataforma de socios, el gestor laboral, el banco— hay que firmar con cada uno un **contrato de encargado del tratamiento** (Art. 28 RGPD). Los proveedores grandes ya lo tienen redactado y solo hay que aceptarlo. Los pequeños a veces hay que pedírselo.

Sin este contrato, la organización es responsable solidaria de cualquier cosa que haga el proveedor con esos datos. Con él, las responsabilidades quedan delimitadas.

### Procedimiento de gestión de brechas

Escrito, breve, conocido por dos o tres personas del equipo. Tiene que responder a:

- ¿Quién detecta? ¿Quién avisa? ¿A quién?
- ¿Cómo se contiene el incidente?
- ¿Quién evalúa si hay que notificar a la AEPD?
- ¿Cómo se comunica a las personas afectadas si procede?
- ¿Qué se documenta y dónde se guarda?

Una página A4 es suficiente. Lo importante no es la extensión: es que exista antes de que pase algo.

### Política de privacidad y cláusulas informativas

En la web, en los formularios, en las cartas de captación. No basta con un texto genérico copiado: hay que ajustarlo a los tratamientos reales de la entidad. La AEPD sanciona por cláusulas incompletas con frecuencia.

## Capa 3: para entidades con plataformas digitales propias

Esto solo aplica si la organización tiene **activos digitales propios**: una web con login de socios, una intranet, un portal de gestión de proyectos, una app, una base de datos accesible desde internet, un sistema de gestión de donaciones desarrollado a medida.

Si la entidad solo usa Google Workspace, redes sociales y herramientas SaaS estándar, esta capa no aplica. El proveedor se ocupa.

### Diagnóstico de exposición digital

Es una revisión externa que mira qué se ve desde fuera sin tocar nada:

- Dominios y subdominios expuestos.
- Certificados SSL y caducidades.
- Configuración de email (SPF, DKIM, DMARC) — si está mal, cualquiera puede enviar correos suplantando a la organización.
- Apariciones del dominio en bases de datos de brechas (Have I Been Pwned y similares).
- Información sensible expuesta inadvertidamente (documentos indexados, repositorios públicos, paneles de administración accesibles).
- Versiones de software con vulnerabilidades conocidas.

El resultado es un informe ejecutivo con semáforo —qué arreglar ya, qué arreglar pronto, qué vigilar— y suele caber en 8-12 páginas. Es un buen punto de entrada porque no requiere coordinación técnica con el equipo: se hace desde fuera.

### Pentest sobre plataformas propias

Cuando hay portales, intranets o aplicaciones propias, una auditoría manual de seguridad (lo que técnicamente se llama "pentest") busca vulnerabilidades reales: que alguien pueda ver datos de otro usuario, saltarse el login, robar la sesión de un administrador, ejecutar acciones que no debería.

El informe entregable describe cada hallazgo con pasos reproducibles, severidad y recomendación de corrección. El cliente lo pasa al desarrollador o proveedor que mantiene la plataforma y se aplican los parches. Después, **retest**: se verifica que las correcciones realmente funcionan.

Una entidad sin plataformas propias no lo necesita.

## El orden honesto de prioridades

Si una organización del tercer sector pregunta "¿por dónde empiezo?", la respuesta es esta secuencia:

1. **Gestor de contraseñas para todo el equipo.** Mes 1.
2. **Doble factor en cuentas críticas.** Mes 1.
3. **Backups de Google Workspace o Microsoft 365.** Mes 2.
4. **Formación al equipo: una tarde con casos reales.** Mes 2.
5. **Registro de actividades de tratamiento RGPD.** Mes 3.
6. **Contratos de encargado del tratamiento con proveedores.** Mes 3.
7. **Procedimiento escrito de gestión de brechas.** Mes 3.
8. **Diagnóstico de exposición digital externo.** Mes 4 (si hay presupuesto).
9. **Pentest sobre plataformas propias.** Solo si las hay y son críticas.

Saltarse del punto 1 al punto 9 —invertir en pentest cuando el equipo todavía reutiliza contraseñas— es el patrón que más dinero malgasta y menos riesgo reduce.

## Lo que no recomienda Startidea

Para cerrar, tres cosas que se venden mucho y aportan poco a una ONG mediana:

- **Antivirus de pago empresariales** cuando la entidad usa Macs o cuando Windows Defender está bien configurado. El antivirus "premium" rara vez añade valor proporcional al gasto.
- **Cursos genéricos de "concienciación"** sin casos del propio sector. La formación útil habla de phishings dirigidos a ONGs reales, no de teoría abstracta.
- **Plataformas all-in-one de cumplimiento RGPD** caras. Para la mayoría de entidades, las plantillas oficiales de la AEPD y un par de horas de asesoría puntual valen más que una suscripción anual de cuatro cifras.

## Próximo paso

Si la organización quiere una valoración honesta de en qué punto está y qué priorizaría un experto externo, Startidea ofrece una **primera conversación de 30 minutos sin coste**. Si el encaje tiene sentido, se propone un diagnóstico de exposición digital con presupuesto cerrado y plazos claros. Si no lo tiene, se dice también.

Escribir a hola@startidea.es o reservar slot desde la web.
