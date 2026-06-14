# GEO — Wikidata + corroboración off-site (acciones de Mario)

**Contexto:** la auditoría GEO (2026-06-14) confirmó que las IA **reconocen la entidad Startidea** (query de marca ✅) pero **NO la citan en queries comerciales** (mejores agencias ONG, subvenciones a éxito, etc.) — ahí ganan SocialCo, Kompoko, NextGrant, CIPÓ, etc. El motivo no es técnica on-site (esa ya está fuerte), es **corroboración externa**: las IA citan a quien aparece en varias fuentes independientes. Esto solo lo puede hacer Mario (cuentas, fichas, contactos).

---

## ⚠️ Aviso honesto sobre Wikidata

Wikidata es más permisivo que Wikipedia, pero **un item de una agencia pequeña puede ser cuestionado o borrado por falta de notabilidad/referencias**. Para que "agarre", el item debe apoyarse en fuentes verificables (web oficial, registro mercantil, perfiles). Recomendación: **primero asegura la corroboración fácil** (Google Business, LinkedIn company, Crunchbase, directorios del sector) y crea Wikidata cuando haya más referencias que citar. Aun así, abajo tienes el borrador listo.

---

## 1. Borrador de item de Wikidata

Crear en https://www.wikidata.org → "Create a new Item" (necesita cuenta).

**Label (es):** Startidea
**Label (en):** Startidea
**Description (es):** agencia de innovación social y comunicación con sede en Granada, España
**Description (en):** social innovation and communications agency based in Granada, Spain
**Also known as (es):** Start Idea · Startidea Granada

**Statements (propiedad → valor):**

| Propiedad | Valor | Nota |
|---|---|---|
| instance of (P31) | business (Q4830453) | y, opcional, *enterprise* |
| inception (P571) | 2011 | fecha de fundación |
| headquarters location (P159) | Granada (Q8421) | |
| located in admin. entity (P131) | Granada (Q8421) | |
| country (P17) | Spain (Q29) | |
| official website (P856) | https://startidea.es | **referencia clave** |
| industry (P452) | public relations (Q133080) / advertising (Q37038) | añade los que apliquen |
| VAT identification number (P3608) | ESB19583632 | referencia oficial fuerte |
| founded by (P112) | Mario Pablo Sánchez Barrón | requiere crear su item antes, o dejarlo |

**Referencias (añadir como "reference" en P856 y P571):** URL `https://startidea.es/sobre`, y si tienes, el BORME/registro mercantil donde aparece la constitución (eso blinda el item contra borrado).

Cuando exista el item (tendrá un Q-id, p.ej. Q123456789), **dímelo y lo añado al `sameAs` del schema** en `src/lib/jsonld.ts` — eso cierra el círculo: tu web declara su propia entidad de Wikidata.

---

## 2. Corroboración off-site (orden por impacto/facilidad)

Estas son las que de verdad te meten en las respuestas comerciales de IA:

1. **Google Business Profile** (si no está publicado): créalo/verifícalo en https://business.google.com con la cuenta corporativa. Categoría "Agencia de publicidad"/"Consultor de marketing". Cuando esté, **pásame la URL de Google Maps** y la añado a `sameAs`. (Tienes el kit en `reports/google-business-profile-kit.md`.)

2. **Página de empresa en LinkedIn** (Company Page, no solo tu perfil personal): las IA la usan como fuente de entidad. Si ya existe, pásame la URL para `sameAs`.

3. **Crunchbase** (perfil gratuito de organización): suma autoridad para LLMs entrenados con datos de empresas.

4. **Directorios del tercer sector / proveedores sociales** — donde la IA "pesca" listas:
   - Hacesfalta.org / plataformas de voluntariado y proveedores ESFL.
   - Guías de proveedores de Plataforma de ONG, Plataforma del Voluntariado, observatorios del tercer sector.
   - Directorios de agencias (Sortlist, Clutch, La Buena Agencia) en la categoría "ONG/tercer sector".

5. **Conseguir aparecer en 1-2 artículos "mejores agencias de comunicación para ONG"** — son las fuentes que la IA cita literalmente. Vías: pitch a medios del sector, guest post, o un artículo propio en un medio tercero (no en startidea.es) que liste agencias e incluya a Startidea con criterio.

---

## 3. Qué queda hecho del lado on-site (Claude, 2026-06-14)

- ✅ Monitor GEO diario (Telegram 06:30 UTC) midiendo si apareces.
- ✅ robots.txt con bienvenida explícita a bots de IA.
- ✅ /llms-full.txt (contexto completo para LLMs).
- ✅ lastmod en el sitemap (frescura).
- ⏳ Pendiente de TU dato: GBP + LinkedIn company + Wikidata Q-id → para meterlos en `sameAs`.

*Cuando tengas cualquiera de las URLs/IDs de arriba, me lo pasas y lo integro en el schema en 1 commit.*
