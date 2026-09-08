# Estado del trabajo — startidea-web

Foto de relevo · 9 de septiembre de 2026. Encargo de IVA del Piloto cerrado; siguiente tanda SEO en espera.

## Encargo actual

Mario confirma IVA aparte en los planes del Piloto: 49, 99 y 149 €/mes + IVA. Cambio editorial separado del loop SEO, coordinado con la tarea de coherencia comercial `01a0810d-6981-72e3-93c1-2dd767b3fd79`. Ownership web: solo `src/content/productos/piloto-redes-sociales.md` y este relevo. [Evidencia y alcance](docs/piloto-precios-iva-2026-09.md).

## Código, validación y publicación

- Base remota tras fetch: `74a8f5850d15ca0a85b7cf49ac0f2f27e2308200`, cierre de conciliación PR114. Worktree nuevo `/Users/STARTIDEA/startidea-web-wt/codex-piloto-precios-iva-20260908`, rama de implementación `codex/piloto-precios-iva-20260908`; cierre documental en `codex/piloto-iva-cierre-20260909`.
- Cinco indicaciones «+ IVA»: metaDescription, precio_desde y tabla de tres planes. Las superficies derivadas consumen la misma fuente. Importes base y resto del contenido intactos.
- PR115 integrada: `e473d8561c64c7175b4fb0f091c8adfa5f5e1390`, fuentes iguales al head validado `45b9cea`. Baseline 13/13, build PASS en 333,80 s, render local y público 17/17 en cuatro recursos; servidor local cerrado y revisión independiente sin hallazgos.
- Producción verificada el 9 de septiembre después de las 00:06 CEST: imagen `e473d85`, fuente completa coincidente, `running/healthy` y log OK. Ficha, listado y los dos textos llms muestran «+ IVA» conservando importes, estado y enlace de alta.

## Coordinación y límites

La tarea HUB `01a080d4-0372-7852-88dc-783a3113bfe5` actualiza sus propias superficies. El coordinador comercial centraliza el dato fiscal de Stripe. Esta sesión no modifica HUB, Stripe, checkout, tasas fiscales, disponibilidad, otros productos ni automatizaciones.

La [conciliación SEO](docs/seo-conciliacion-2026-09.md) y el [informe corregido](docs/auditoria-seo-geo-corregida-2026-09.md) siguen como referencia. Recepción real consentida en GA4, rendimiento y pendientes comerciales permanecen sin acreditar.

El coordinador SEO `01a080d4-039d-7610-ad85-e9365d96ef82` ha transmitido después «revisa y sigue»: nueva tanda de Comunicación, Qué hacemos, Notas y compromiso BOJA. IVA ya está cerrado; esos archivos aún no se han editado. La siguiente tanda debe partir de un worktree nuevo y de la rama remota actualizada. No mezclar ambas tandas.

## Acción de Mario y siguiente acción

Acción de Mario: ninguna para IVA.

Única siguiente acción: devolver el cierre de IVA al coordinador comercial y comenzar el encargo editorial SEO autorizado en otro worktree. No alterar productos/precios durante esa tanda. El seguimiento automático lo coordina la tarea SEO; no se ha cambiado desde aquí.
