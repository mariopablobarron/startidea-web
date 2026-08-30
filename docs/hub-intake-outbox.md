# Réplica de formularios al HUB

Las altas humanas válidas se guardan primero en la outbox SQLite
`$EXPEDIENTES_DIR/hub-intake-outbox.db` y se intentan enviar inmediatamente a:

`$HUB_INTAKE_URL/api/public/intake/startidea-web`

El HUB recibe `Authorization: Bearer $HUB_INTAKE_SECRET`; el secreto debe tener
al menos 32 caracteres. Una caída del HUB no cambia la respuesta del formulario:
el evento ya persistido queda pendiente con el número de intentos, la próxima
fecha de reintento y el último error (sin secretos). En cambio, un fallo al
persistir la fila se propaga: no se declara aceptada una copia que no es durable.

Antes del `INSERT`, cada campo se normaliza con los límites exactos del contrato
v1 y el JSON final se limita a 32 KiB UTF-8. El contacto y el asunto siempre se
conservan; si el agregado es mayor, se ajustan primero mensaje y detalles. Los
identificadores, `kind`, formulario, email y fecha se rechazan si no cumplen el
contrato, evitando persistir eventos que el HUB nunca podría aceptar.

## Reintento operativo

Programar un `POST` periódico (por ejemplo, cada cinco minutos) a:

`https://startidea.es/api/internal/hub-intake-retry?limit=50`

con la misma cabecera `Authorization: Bearer $HUB_INTAKE_SECRET`. El endpoint
procesa hasta 200 eventos vencidos por llamada, usa backoff exponencial y también
recupera entregas cuyo lease quedó abandonado por un reinicio.

La outbox no incluye IP, user-agent, adjuntos/CV, tokens de confirmación o gestión
ni secretos. En candidaturas replica únicamente contacto, tipo, área y ubicación.
