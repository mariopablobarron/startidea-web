# Cómo crear un cliente piloto en el portal

El portal cliente vive en `https://hub.startidea.tech/cliente/[slug]`. El MVP reutiliza modelos existentes del hub (Workspace, Membership, Task, GeneratedFile, Conversation/Message), así que no necesitas migración de BD para crear el primero.

## Flujo desde Telegram (rápido)

Aún no hay comando `/cliente nuevo` — viene en otra iteración. De momento se crea por consola.

## Flujo manual (SQL en VPS)

### 1. Crear el Workspace del cliente

```bash
ssh root@72.61.195.108
docker exec -it hub-postgres psql -U hub -d hub
```

```sql
-- Cambia el slug y el nombre por los del cliente real
INSERT INTO "Workspace" (id, slug, name, plan, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'fundacion-ejemplo',
  'Fundación Ejemplo',
  'FREE',
  NOW(),
  NOW()
)
RETURNING id, slug;
```

Guarda el `id` devuelto — lo necesitas para los siguientes pasos.

### 2. Crear el User del contacto del cliente

```sql
-- Email del contacto principal del cliente
INSERT INTO "User" (id, email, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'maria@fundacion-ejemplo.org', NOW(), NOW())
RETURNING id;
```

Si el cliente ya tiene cuenta (ej. comentó en granadasocial.org), busca su userId:

```sql
SELECT id, email FROM "User" WHERE email = 'maria@fundacion-ejemplo.org';
```

### 3. Vincular User al Workspace como GUEST

```sql
INSERT INTO "Membership" (id, "userId", "workspaceId", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '<USER_ID_DEL_PASO_2>',
  '<WORKSPACE_ID_DEL_PASO_1>',
  'GUEST',
  NOW(),
  NOW()
);
```

### 4. (Opcional) Crear tareas de proyecto de ejemplo

```sql
INSERT INTO "Task" (id, "workspaceId", title, status, priority, "dueAt", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, '<WORKSPACE_ID>', 'Diagnóstico de comunicación 2026', 'IN_PROGRESS', 'HIGH', '2026-06-30', NOW(), NOW()),
  (gen_random_uuid()::text, '<WORKSPACE_ID>', 'Reunión kickoff fundraising', 'TODO', 'HIGH', '2026-05-21', NOW(), NOW());
```

El portal detectará la última tarea con título tipo "reunión/llamada/kickoff/diagnóstico" como "próxima reunión" del bloque hero.

### 5. Conectar Mario como account manager

```sql
-- Busca tu userId
SELECT id FROM "User" WHERE email = 'mariopablobarron@gmail.com';

-- Crea membership como OPERATOR en el workspace cliente
INSERT INTO "Membership" (id, "userId", "workspaceId", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '<TU_USER_ID>',
  '<WORKSPACE_ID>',
  'OPERATOR',
  NOW(),
  NOW()
);
```

Te aparecerá en el bloque "Account manager" del portal.

## Acceso del cliente

El cliente entra a `https://hub.startidea.tech/login`, introduce su email y recibe un magic link (en producción por SMTP, en dev en los logs del container). Tras autenticarse:

- Si tiene **una sola** Membership role=GUEST → redirige automáticamente a su workspace
- Si tiene **varias** → ve un listado para elegir
- Si tiene **ninguna** → mensaje "acceso pendiente"

## Limitaciones del MVP

- No hay editor para que TÚ subas entregables desde el portal cliente. Para eso usa `/[workspace]/redaccion` o el endpoint `/api/files` con la API.
- El chat es read-only por ahora: muestra mensajes de la última `Conversation` del workspace pero no hay form de respuesta (próxima iteración).
- Facturas en Stripe vendrán cuando vinculemos `stripeCustomerId` del Workspace al portal.
- "Reagendar" reunión va a `/contacto` de startidea.es (estático). Próxima iter: Cal.com.

## Siguiente iteración planeada

1. Form de chat bidireccional en el portal (crea Message en la Conversation del workspace, notifica al account manager por Telegram)
2. Botón "Subir archivo" para el cliente (genera GeneratedFile)
3. Listado de facturas Stripe con link de pago
4. Integración Cal.com para reagendar/programar nueva reunión
5. Comando `/cliente nuevo <email> <empresa>` en el bot Telegram (crea Workspace + User + Membership en un solo paso)
