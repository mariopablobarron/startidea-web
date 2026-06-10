# Cómo añadir Agenda 2030 2026 al catálogo + notificar perfiles

Dos opciones para hacer que esta convocatoria aparezca en
`/subvenciones/catalogo` y dispare matching contra los perfiles activos del
Copiloto Autónomo.

---

## Opción A — UI admin (recomendada, 2 minutos)

1. Acceder a `https://startidea.es/admin/convocatorias/nueva`
2. Rellenar:
   - **Slug**: `agenda-2030-2026`
   - **Código**: `AGENDA-2030`
   - **Título**: `Políticas Palanca Agenda 2030 — Convocatoria 2026`
   - **Título completo**: `Subvenciones 2026 para entidades sociales · Políticas Palanca para el cumplimiento de la Agenda 2030 (Dirección General — Ministerio)`
   - **Órgano**: `Dirección General de Políticas Palanca para el Cumplimiento de la Agenda 2030`
   - **Tipo beneficiario**: `privada` (tercer sector)
   - **Etiqueta beneficiario**: `Asociaciones, fundaciones, ONGs, cooperativas de iniciativa social, mutualidades sin ánimo de lucro · Universidades`
   - **Plazo (texto)**: `20 de junio de 2026 (improrrogable)`
   - **Plazo corto**: `20 jun`
   - **Nota plazo**: `1 mes desde el extracto BOE de 20 de mayo`
   - **Deadline ISO**: `2026-06-20`
   - **Importe min**: `25000`
   - **Importe max**: `300000`
   - **Importe range**: `25.000 € – 300.000 €`
   - **Importe detalle**: `Hasta el 100% del proyecto. Pago anticipado sin garantías. Presupuesto total del sector social: 8.299.970,22 €.`
   - **Tipo entidades**: `Entidades sin ánimo de lucro y de economía social con personalidad jurídica propia. También admite universidades. Quedan fuera empresas mercantiles, autónomos y administraciones públicas.`
   - **Financia (una línea por viñeta)**:
     ```
     Acciones de incidencia social o política
     Proyectos piloto replicables
     Metodologías innovadoras aplicadas al ámbito social
     Trabajo en redes y alianzas multiactor (ODS 17)
     Comunicación transformadora alineada con la Agenda 2030
     ```
   - **Gastos OK (una línea por viñeta)**:
     ```
     Personal laboral propio (proporcional al tiempo dedicado)
     Colaboradores externos contratados específicamente
     Viajes y dietas vinculadas a actividades del proyecto
     Materiales fungibles e inventariables de bajo importe
     Alquileres de espacios o equipos imprescindibles
     Obras menores directamente vinculadas al proyecto
     ```
   - **Gastos NO (una línea por viñeta)**:
     ```
     Gastos generales de funcionamiento ordinario de la entidad
     Inversiones no justificadas como necesarias para el proyecto
     Gastos anteriores al plazo de ejecución autorizado
     IVA recuperable
     ```
   - **Requisitos (una línea por viñeta)**:
     ```
     Entidad sin ánimo de lucro con personalidad jurídica propia
     Al corriente con Hacienda y Seguridad Social
     Proyecto alineado explícitamente con uno o varios ODS
     Capacidad administrativa para ejecutar 12 meses
     Memoria con métrica de impacto verificable
     Solo un proyecto por entidad
     ```
   - **Nota**: `Tasa de éxito histórica ≈ 9,2%. La diferencia entre presentar y ser concedido no está en el dinero (presupuesto generoso) sino en la calidad de la memoria técnica y el alineamiento explícito con los ODS.`
   - **URL bases**: `https://www.boe.es/diario_boe/txt.php?id=BOE-B-2026-XXXXX` (sustituir cuando confirmes el ID exacto del extracto)
   - **Fuente**: `manual`
   - **Activa**: ✓ marcar
   - **Destacada**: ✓ marcar (para que aparezca arriba en el catálogo)

3. Pulsar **Guardar**.

Tras guardarla con `activa = 1`, **automáticamente se dispara el matching**
contra los perfiles activos del Copiloto Autónomo (hook implementado en Fase
11). Cada perfil que encaje recibe email con docs IA + CTA premium 12%.

---

## Opción B — curl (para uso desde terminal / script)

Si prefieres añadirla desde tu Mac vía API:

```bash
ADMIN_TOKEN="<copia el valor de ADMIN_TOKEN del .env del container Coolify>"
curl -fsSL -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d @- \
  https://startidea.es/api/admin/convocatorias <<'JSON'
{
  "slug": "agenda-2030-2026",
  "codigo": "AGENDA-2030",
  "titulo": "Políticas Palanca Agenda 2030 — Convocatoria 2026",
  "titulo_full": "Subvenciones 2026 para entidades sociales · Políticas Palanca para el cumplimiento de la Agenda 2030 (Dirección General — Ministerio)",
  "organo": "Dirección General de Políticas Palanca para el Cumplimiento de la Agenda 2030",
  "tipo_beneficiario": "privada",
  "beneficiario_label": "Asociaciones, fundaciones, ONGs, cooperativas de iniciativa social, mutualidades sin ánimo de lucro · Universidades",
  "deadline": "20 de junio de 2026 (improrrogable)",
  "deadline_short": "20 jun",
  "deadline_note": "1 mes desde el extracto BOE de 20 de mayo",
  "deadline_iso": "2026-06-20",
  "importe_min": "25000",
  "importe_max": "300000",
  "importe_range": "25.000 € – 300.000 €",
  "importe_detalle": "Hasta el 100% del proyecto. Pago anticipado sin garantías. Presupuesto total del sector social: 8.299.970,22 €.",
  "tipo_entidades": "Entidades sin ánimo de lucro y de economía social con personalidad jurídica propia. También admite universidades.",
  "financia_resumen": "Acciones de incidencia social o política\nProyectos piloto replicables\nMetodologías innovadoras aplicadas al ámbito social\nTrabajo en redes y alianzas multiactor (ODS 17)\nComunicación transformadora alineada con la Agenda 2030",
  "gastos_ok": "Personal laboral propio (proporcional al tiempo dedicado)\nColaboradores externos contratados específicamente\nViajes y dietas vinculadas a actividades del proyecto\nMateriales fungibles e inventariables de bajo importe\nAlquileres de espacios o equipos imprescindibles\nObras menores directamente vinculadas al proyecto",
  "gastos_no": "Gastos generales de funcionamiento ordinario de la entidad\nInversiones no justificadas como necesarias para el proyecto\nGastos anteriores al plazo de ejecución autorizado\nIVA recuperable",
  "requisitos": "Entidad sin ánimo de lucro con personalidad jurídica propia\nAl corriente con Hacienda y Seguridad Social\nProyecto alineado explícitamente con uno o varios ODS\nCapacidad administrativa para ejecutar 12 meses\nMemoria con métrica de impacto verificable\nSolo un proyecto por entidad",
  "nota": "Tasa de éxito histórica ≈ 9,2%. La diferencia entre presentar y ser concedido no está en el dinero (presupuesto generoso) sino en la calidad de la memoria técnica y el alineamiento explícito con los ODS.",
  "fuente": "manual",
  "fuente_id": "BOE-2026-05-20-agenda2030",
  "activa": "1",
  "destacada": "1"
}
JSON
```

Tras activarla con `activa=1`, **el hook automático dispara matching** contra
los perfiles del Copiloto (sin necesidad de pulsar nada más).

---

## Re-disparar matching manualmente

Si más adelante quieres volver a notificar perfiles (por ejemplo si añades
perfiles nuevos al Copiloto después de activar esta convocatoria), entra en:

`https://startidea.es/admin/convocatorias/agenda-2030-2026`

Y pulsa **⚡ Notificar perfiles ahora** (el panel que añadimos en Fase 11).
Los perfiles ya procesados no se duplican.

---

## Datos que faltarían por completar

- **URL bases**: necesito el código BOE-B-2026-XXXXX del extracto exacto del
  20 de mayo. Cuando lo tengas, edita la convocatoria desde admin y rellena
  `url_bases` con la URL del BOE.
- **URL sede**: la sede electrónica del organismo convocante. Lo mismo,
  editable después.
