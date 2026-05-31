# copiloto-mcp — Servidor MCP del Copiloto de Subvenciones

Expone la tramitación de subvenciones como **herramientas MCP** para que un
agente IA (Claude Code / Claude Desktop / cualquier cliente MCP) las invoque
conversacionalmente. Es un wrapper sobre los endpoints admin de `startidea-web`.

## Herramientas

- **`tramitar_expediente(id, modo?)`** — lanza la tramitación de un expediente.
  - `modo: 'asistido'` (default) → deja todo listo hasta la firma del cliente.
  - `modo: 'autonomo'` → el agente firma con la opción configurada (entidad/apoderado).
  - Internamente llama a `POST /api/admin/tramitar-sede` (detecta sede, deriva
    la opción de firma del expediente y orquesta el container copiloto-sede).
- **`salud_copiloto()`** — comprueba que `startidea-web` responde.

## Instalar y ejecutar

```bash
cd copiloto-mcp
npm install
ADMIN_TOKEN="<el de startidea-web>" STARTIDEA_API_URL="https://startidea.es" node server.mjs
```

## Conectar a Claude (Claude Desktop / Code)

`claude_desktop_config.json` (o equivalente):
```json
{
  "mcpServers": {
    "copiloto-subvenciones": {
      "command": "node",
      "args": ["/ruta/a/copiloto-mcp/server.mjs"],
      "env": {
        "ADMIN_TOKEN": "<el de startidea-web>",
        "STARTIDEA_API_URL": "https://startidea.es"
      }
    }
  }
}
```
Luego, desde el agente: *"tramita el expediente A7B5F162 en modo autónomo"* →
invoca `tramitar_expediente`.

## Arquitectura (dónde encaja)

```
Agente IA  ──MCP──►  copiloto-mcp  ──HTTPS(admin)──►  startidea-web /api/admin/tramitar-sede
                                                          │ detecta sede + signMode
                                                          ▼
                                                    copiloto-sede (Playwright + firma)
```

El MCP **orquesta**; NO custodia certificados ni navega sedes (eso vive en
`copiloto-sede`). Auth contra startidea-web vía `x-admin-token = sha256(ADMIN_TOKEN)`.

## Seguridad

- Da acceso a tramitar expedientes → trátalo como credencial. `ADMIN_TOKEN` solo
  en el entorno del MCP, nunca en el repo.
- Para autonomía real, la firma sigue requiriendo certificado + custodia segura
  (ver `copiloto-sede/`) y, en modo apoderado, apoderamiento REA.
