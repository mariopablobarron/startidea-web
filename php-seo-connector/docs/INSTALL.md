# Conector PHP GA4 + Search Console

Módulo interno en PHP 8+ para conectar una web con Google Analytics 4 y Google Search Console mediante APIs oficiales, OAuth 2.0, MySQL/MariaDB y tokens cifrados.

Referencias oficiales:

- OAuth 2.0 para aplicaciones web: https://developers.google.com/identity/protocols/oauth2/web-server
- Google Analytics Data API: https://developers.google.com/analytics/devguides/reporting/data/v1
- Google Analytics Admin API: https://developers.google.com/analytics/devguides/config/admin/v1
- Search Console API: https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics
- Google API PHP Client: https://github.com/googleapis/google-api-php-client

## 1. Preparar Google Cloud

1. Entra en Google Cloud Console: https://console.cloud.google.com/
2. Crea un proyecto nuevo o selecciona uno existente.
3. Ve a **APIs y servicios → Biblioteca**.
4. Activa **Google Analytics Data API**.
5. Activa **Google Search Console API**.
6. Para listar propiedades GA4 desde el panel, activa también **Google Analytics Admin API**. La lectura de métricas usa Data API; el listado de cuentas/propiedades usa Admin API.
7. Ve a **APIs y servicios → Pantalla de consentimiento OAuth**.
8. Configura la app como interna si es una cuenta de Google Workspace, o externa si hace falta.
9. Añade los scopes:
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/webmasters.readonly`
10. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
11. Tipo: **Aplicación web**.
12. En **URI de redirección autorizados**, añade:
    - `https://startidea.es/admin/google/callback`
    - o la URL equivalente de staging/local si pruebas fuera de producción.
13. Copia `Client ID` y `Client Secret` al `.env`.

No se pide contraseña de Google en ningún momento. Google muestra una pantalla de consentimiento y devuelve un `authorization code`, que el servidor intercambia por tokens.

## 2. Instalación

Desde esta carpeta:

```bash
cd php-seo-connector
composer install
```

Si partes de cero y quieres reinstalar la dependencia principal:

```bash
composer require google/apiclient
```

Copia variables:

```bash
cp .env.example .env
php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
```

Rellena `.env`:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://startidea.es/admin/google/callback
DB_HOST=127.0.0.1
DB_NAME=startidea_seo
DB_USER=startidea_seo
DB_PASS=...
APP_ENCRYPTION_KEY=base64_de_32_bytes
ADMIN_TOKEN=token_largo_aleatorio
APP_URL=https://startidea.es
```

## 3. Base de datos

Crea la base de datos y aplica el SQL:

```bash
mysql -u root -p -e "CREATE DATABASE startidea_seo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p startidea_seo < database/schema.sql
```

Tablas creadas:

- `google_connections`
- `seo_properties`
- `ga4_daily_metrics`
- `gsc_daily_queries`
- `gsc_daily_pages`
- `seo_opportunities`
- `seo_agent_runs`

## 4. Rutas

Publica `php-seo-connector/public` como document root del vhost PHP, o monta estas rutas hacia el front controller `public/index.php`:

- `/admin/google/connect`
- `/admin/google/callback`
- `/admin/google/status`
- `/admin/google/disconnect`
- `/admin/seo/sync`
- `/admin/seo/report`

Para probar localmente en un entorno que sí tenga PHP:

```bash
php -S 127.0.0.1:8080 -t public public/router.php
```

Entra en:

```text
http://127.0.0.1:8080/admin/google/status?token=ADMIN_TOKEN
```

## 5. Flujo OAuth

1. El admin entra en `/admin/google/status?token=ADMIN_TOKEN`.
2. Pulsa **Conectar Google**.
3. `/admin/google/connect` genera `state` y redirige a Google.
4. Google devuelve el `authorization code` a `/admin/google/callback`.
5. El sistema valida `state`.
6. Se intercambia el code por `access_token` y `refresh_token`.
7. Solo se guarda el `refresh_token` cifrado con AES-256-GCM.
8. En cada llamada de API, `GoogleOAuthService` renueva el access token con el refresh token.
9. Los tokens nunca se muestran en pantalla ni se escriben en logs.
10. `/admin/google/disconnect` revoca el token y marca la conexión como desconectada.

## 6. Uso del panel

1. Abre `/admin/google/status?token=ADMIN_TOKEN`.
2. Conecta Google.
3. Selecciona una propiedad GA4.
4. Selecciona una propiedad Search Console.
5. Guarda propiedades.
6. Pulsa **Sincronizar GA4 + GSC y generar oportunidades**.
7. Revisa la tabla de oportunidades.
8. Exporta CSV desde `/admin/seo/report`.

## 7. Qué analiza

`SeoOpportunityService` genera oportunidades para:

1. Keywords en posición 4-20.
2. URLs con muchas impresiones y bajo CTR.
3. Páginas con caída de clicks.
4. Páginas con impresiones crecientes pero pocos clicks.
5. Posibles canibalizaciones entre URLs.
6. Páginas con tráfico pero baja conversión.
7. Páginas con buena conversión pero poco tráfico.
8. Nuevos contenidos.
9. Mejoras de title y meta description.
10. Mejoras de enlazado interno.

## 8. Seguridad

- No pedir nunca la contraseña de Google.
- No usar Selenium.
- No hacer scraping de Analytics ni Search Console.
- Usar solo APIs oficiales.
- Proteger `/admin/*` con `ADMIN_TOKEN` o sustituirlo por el login interno de la web.
- Cifrar `refresh_token`.
- No subir `.env`.
- Revisar que `vendor/`, `.env` y logs no entren en git.
- Registrar errores sin credenciales.
- Permitir desconexión desde `/admin/google/disconnect`.

Para revocar acceso desde Google:

1. Entra en https://myaccount.google.com/permissions
2. Busca la app OAuth creada en Google Cloud.
3. Pulsa **Quitar acceso**.
4. Después vuelve al panel y conecta de nuevo si hace falta.

## 9. Checklist final

- [ ] `composer install` termina correctamente.
- [ ] `.env` existe y tiene `APP_ENCRYPTION_KEY` de 32 bytes en base64.
- [ ] `database/schema.sql` está aplicado en MySQL/MariaDB.
- [ ] `/admin/google/status?token=...` carga el panel.
- [ ] Sin token, `/admin/google/status` devuelve acceso restringido.
- [ ] `/admin/google/connect` redirige a Google.
- [ ] Google vuelve a `/admin/google/callback`.
- [ ] `google_connections.encrypted_refresh_token` contiene texto cifrado, no token plano.
- [ ] El panel lista propiedades de Search Console.
- [ ] El panel lista propiedades GA4. Si no, activar Google Analytics Admin API.
- [ ] Se guardan propiedades en `seo_properties`.
- [ ] `/admin/seo/sync` descarga datos y rellena tablas GA4/GSC.
- [ ] `seo_opportunities` se llena con oportunidades.
- [ ] `/admin/seo/report` descarga CSV.
- [ ] `/admin/google/disconnect` revoca y desconecta.
