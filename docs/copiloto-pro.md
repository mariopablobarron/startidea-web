# Copiloto de subvenciones Pro — plan de pago del Copiloto Autónomo

Plan de negocio público: `/laboratorio/productos/copiloto-subvenciones-pro`.
Hito 1 entregado el 2026-09-08: planes, cobro y **encaje real**.

## Qué cambia respecto al Copiloto gratuito

| | Gratuito (`free`) | Pro (`pro`, 19 €/mes) | Pro Memoria (`pro_memoria`, 39 €/mes) |
|---|---|---|---|
| Filtros duros (territorio, importe, finalidades) | sí | sí | sí |
| Palabras clave | filtro duro | pista (suaves) | pista (suaves) |
| Encaje real con modelo (puntuación + motivo + requisitos clave) | no | sí | sí |
| Convocatorias por ciclo diario | 2 | 5 | 5 |
| Documentación preliminar por email | sí | sí | sí |
| Borrador de memoria adaptado al baremo | (la actual) | (la actual) | hito 2 |

El plan gratuito **no cambia** con este hito: mismos filtros, mismo cupo, mismos emails.
Qué se retira del gratuito cuando el Pro esté en beta es decisión de Mario.

## Piezas

- `src/lib/copiloto-pro.ts`: `COPILOTO_PLANS`, `planEfectivo(profile)` (caduca por `plan_until`),
  `encajeReal(profile, conv, scoreFiltros)` → OpenRouter (`pickModel('clasificacion')`), respuesta
  JSON categórica; el score lo calcula `scoreDesdeVeredicto` (deterministic-picker). Si el modelo
  falla, `encajeHeuristico` explica el encaje por filtros con `llm: false`. Umbral por defecto 60
  (`COPILOTO_PRO_UMBRAL` para ajustarlo).
- `src/lib/auto-copiloto-db.ts`: columnas nuevas `plan`, `plan_until`, `stripe_customer_id`,
  `stripe_subscription_id` en perfiles y `encaje_score`, `encaje_motivo`, `encaje_llm` en el log
  (migraciones `ALTER TABLE` idempotentes al abrir la BD). `setProfilePlan`, `getProfileById`,
  `getProfileByStripeCustomer`.
- `src/pages/api/auto-copiloto/trigger.ts`: por perfil resuelve el plan; en Pro evalúa el encaje
  real sobre como máximo el doble del cupo, se queda con las que superan el umbral, ordena por
  encaje y limita al cupo. El email de documentos incluye el bloque «Encaje». El log guarda score
  y motivo.
- `GET /api/copiloto-pro/checkout?t=<manage_token>&plan=pro|pro_memoria`: Stripe Checkout en modo
  suscripción con códigos de promoción; sin Stripe o sin precio redirige a `/contacto`.
- `POST /api/stripe-webhook`: `checkout.session.completed` con `metadata.kind=copiloto_pro` y
  `customer.subscription.*` sincronizan el plan del perfil (`syncCopilotoPlan`); impago o baja
  devuelven a `free`. Hay que añadir los eventos `customer.subscription.created/updated/deleted`
  al endpoint del webhook en el Dashboard de Stripe.
- `/subvenciones/mi-copiloto`: tarjeta de plan con botones de contratación y encaje en el historial.

## Variables de entorno (container Coolify)

```text
STRIPE_PRICE_COPILOTO_PRO=price_...
STRIPE_PRICE_COPILOTO_PRO_MEMORIA=price_...
COPILOTO_PRO_UMBRAL=60          # opcional
```

## Pruebas

`npx vitest run src/lib/copiloto-pro.test.ts` (8 casos: planes, caducidad, parseo, score,
heurístico, fallback, prompt).

## Edición del perfil (2026-09-08, mismo hito 1)

`/subvenciones/mi-copiloto/perfil?t=<manage_token>` + `POST /api/auto-copiloto/update`
(`parseProfileUpdate` en `src/lib/copiloto-perfil.ts`, `updateProfile` en la BD). La organización
edita todo menos el email, el estado, el plan y Stripe. El historial de Mi Copiloto enlaza cada
expediente a su página de estado (`/subvenciones/presentar/gracias?id=`).

## Hito 2 (pendiente)

Checklist de elegibilidad como pantalla propia y borrador de memoria adaptado al baremo por
convocatoria para `pro_memoria`; recordatorios de plazo ya existen (`deadline-reminders`).
