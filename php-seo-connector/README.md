# PHP SEO Connector

Conector interno PHP 8+ para Google Analytics 4, Google Search Console y generación de oportunidades SEO.

Incluye:

- OAuth 2.0 con `google/apiclient`.
- Refresh tokens cifrados en MySQL/MariaDB.
- Rutas admin:
  - `/admin/google/connect`
  - `/admin/google/callback`
  - `/admin/google/status`
  - `/admin/google/disconnect`
  - `/admin/seo/sync`
  - `/admin/seo/report`
- Servicios separados:
  - `GoogleOAuthService`
  - `GA4Service`
  - `SearchConsoleService`
  - `SeoOpportunityService`
- SQL en `database/schema.sql`.
- Documentación completa en `docs/INSTALL.md`.

Instalación rápida:

```bash
cd php-seo-connector
composer install
cp .env.example .env
mysql -u root -p startidea_seo < database/schema.sql
php -S 127.0.0.1:8080 -t public public/router.php
```

Después abre:

```text
http://127.0.0.1:8080/admin/google/status?token=ADMIN_TOKEN
```
