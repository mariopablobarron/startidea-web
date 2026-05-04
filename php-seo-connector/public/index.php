<?php

declare(strict_types=1);

use Startidea\SeoConnector\Services\GA4Service;
use Startidea\SeoConnector\Services\GoogleOAuthService;
use Startidea\SeoConnector\Services\SearchConsoleService;
use Startidea\SeoConnector\Services\SeoOpportunityService;
use Startidea\SeoConnector\Support\Auth;
use Startidea\SeoConnector\Support\Database;
use Startidea\SeoConnector\Support\Env;
use Startidea\SeoConnector\Support\Logger;
use Startidea\SeoConnector\Support\Response;

require dirname(__DIR__) . '/vendor/autoload.php';

Env::load(dirname(__DIR__));
session_start();

$path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/', '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    match ($path) {
        '/admin/google/connect' => googleConnect(),
        '/admin/google/callback' => googleCallback(),
        '/admin/google/status' => adminStatus(),
        '/admin/google/disconnect' => googleDisconnect(),
        '/admin/seo/sync' => seoSync(),
        '/admin/seo/report' => seoReport(),
        default => notFound(),
    };
} catch (Throwable $e) {
    Logger::error('Unhandled request error', ['path' => $path, 'error' => $e->getMessage()]);
    http_response_code(500);
    echo '<h1>Error interno</h1><p>Revisa <code>storage/logs/app.log</code>. No se muestran credenciales.</p>';
}

function googleConnect(): void
{
    Auth::requireAdmin();
    $state = bin2hex(random_bytes(24));
    $_SESSION['google_oauth_state'] = $state;
    Response::redirect((new GoogleOAuthService())->getAuthUrl($state));
}

function googleCallback(): void
{
    Auth::requireAdmin();

    $state = $_GET['state'] ?? '';
    if (!$state || !hash_equals($_SESSION['google_oauth_state'] ?? '', (string) $state)) {
        throw new RuntimeException('Invalid OAuth state.');
    }

    unset($_SESSION['google_oauth_state']);
    if (!empty($_GET['error'])) {
        throw new RuntimeException('Google OAuth error: ' . (string) $_GET['error']);
    }

    $code = $_GET['code'] ?? null;
    if (!$code) {
        throw new RuntimeException('Missing Google OAuth code.');
    }

    (new GoogleOAuthService())->handleCallback((string) $code);
    Response::redirect('/admin/google/status');
}

function googleDisconnect(): void
{
    Auth::requireAdmin();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        http_response_code(405);
        exit;
    }
    (new GoogleOAuthService())->disconnect();
    Response::redirect('/admin/google/status');
}

function seoSync(): void
{
    Auth::requireAdmin();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        http_response_code(405);
        exit;
    }

    $pdo = Database::pdo();
    savePropertySelection();

    $ga4 = $pdo->query('SELECT property_id FROM seo_properties WHERE type = "ga4" AND is_active = 1 ORDER BY id DESC LIMIT 1')->fetch();
    $gsc = $pdo->query('SELECT property_id FROM seo_properties WHERE type = "gsc" AND is_active = 1 ORDER BY id DESC LIMIT 1')->fetch();

    if (!$gsc) {
        throw new RuntimeException('Select a Search Console property before syncing.');
    }

    $start = date('Y-m-d', strtotime(Env::get('SEO_DEFAULT_START_DATE', '-28 days') ?? '-28 days'));
    $end = date('Y-m-d', strtotime(Env::get('SEO_DEFAULT_END_DATE', 'yesterday') ?? 'yesterday'));

    $oauth = new GoogleOAuthService();
    $gscService = new SearchConsoleService($oauth);
    $ga4Service = new GA4Service($oauth);

    $gscQueries = $gscService->syncDailyQueries($gsc['property_id'], $start, $end);
    $gscPages = $gscService->syncDailyPages($gsc['property_id'], $start, $end);
    $ga4Rows = 0;

    if ($ga4) {
        $ga4Rows = $ga4Service->syncDailyPageMetrics($ga4['property_id'], $start, $end);
    }

    $opportunities = (new SeoOpportunityService())->generate($gsc['property_id'], $ga4['property_id'] ?? null);
    Logger::info('SEO sync completed', compact('gscQueries', 'gscPages', 'ga4Rows', 'opportunities'));

    Response::redirect('/admin/google/status?sync=ok');
}

function seoReport(): void
{
    Auth::requireAdmin();
    $rows = Database::pdo()->query(
        'SELECT priority, type, page_url, keyword, metric_name, metric_value, evidence, recommended_action, status, created_at
         FROM seo_opportunities
         ORDER BY priority ASC, created_at DESC
         LIMIT 1000'
    )->fetchAll();

    Response::csv('seo-opportunities-' . date('Y-m-d') . '.csv', [
        'priority',
        'type',
        'page_url',
        'keyword',
        'metric_name',
        'metric_value',
        'evidence',
        'recommended_action',
        'status',
        'created_at',
    ], $rows);
}

function adminStatus(): void
{
    Auth::requireAdmin();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        savePropertySelection();
        Response::redirect('/admin/google/status?saved=ok');
    }

    $oauth = new GoogleOAuthService();
    $status = $oauth->status();
    $ga4Properties = [];
    $gscProperties = [];
    $apiError = null;

    if ($status['connected']) {
        try {
            $ga4Properties = (new GA4Service($oauth))->listProperties();
            $gscProperties = (new SearchConsoleService($oauth))->listProperties();
        } catch (Throwable $e) {
            $apiError = $e->getMessage();
            Logger::error('Could not list Google properties', ['error' => $e->getMessage()]);
        }
    }

    $selected = selectedProperties();
    $opportunities = Database::pdo()->query(
        'SELECT priority, type, page_url, keyword, metric_name, metric_value, evidence, recommended_action, created_at
         FROM seo_opportunities
         ORDER BY priority ASC, created_at DESC
         LIMIT 100'
    )->fetchAll();
    $lastRun = Database::pdo()->query('SELECT * FROM seo_agent_runs ORDER BY id DESC LIMIT 1')->fetch();

    render('SEO interno · Startidea', function () use ($status, $ga4Properties, $gscProperties, $selected, $opportunities, $lastRun, $apiError): void {
        ?>
        <section class="card">
            <h2>Estado Google</h2>
            <?php if ($status['connected']): ?>
                <p class="ok">Conectado<?= $status['connection']['email'] ? ' como ' . e($status['connection']['email']) : '' ?>.</p>
                <form method="post" action="/admin/google/disconnect">
                    <button class="danger" type="submit">Desconectar Google</button>
                </form>
            <?php else: ?>
                <p>No hay conexión activa con Google.</p>
                <a class="button" href="/admin/google/connect">Conectar Google</a>
            <?php endif; ?>
            <?php if ($apiError): ?><p class="warn">No se pudieron listar propiedades: <?= e($apiError) ?></p><?php endif; ?>
        </section>

        <section class="card">
            <h2>Propiedades</h2>
            <form method="post" action="/admin/google/status">
                <label>GA4</label>
                <select name="ga4_property_id">
                    <option value="">Seleccionar propiedad GA4</option>
                    <?php foreach ($ga4Properties as $property): ?>
                        <option value="<?= e($property['property_id']) ?>" <?= ($selected['ga4'] ?? '') === $property['property_id'] ? 'selected' : '' ?>>
                            <?= e(($property['account_name'] ?? '') . ' · ' . $property['name'] . ' · ' . $property['property_id']) ?>
                        </option>
                    <?php endforeach; ?>
                </select>

                <label>Search Console</label>
                <select name="gsc_property_id">
                    <option value="">Seleccionar propiedad GSC</option>
                    <?php foreach ($gscProperties as $property): ?>
                        <option value="<?= e($property['site_url']) ?>" <?= ($selected['gsc'] ?? '') === $property['site_url'] ? 'selected' : '' ?>>
                            <?= e($property['site_url'] . ' · ' . $property['permission_level']) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <button type="submit">Guardar propiedades</button>
            </form>
        </section>

        <section class="card">
            <h2>Sincronización</h2>
            <p>Última sincronización: <?= $lastRun ? e($lastRun['started_at'] . ' · ' . $lastRun['status'] . ' · ' . $lastRun['opportunities_count'] . ' oportunidades') : 'Sin sincronizaciones todavía' ?></p>
            <form method="post" action="/admin/seo/sync">
                <button type="submit">Sincronizar GA4 + GSC y generar oportunidades</button>
            </form>
            <p><a href="/admin/seo/report">Exportar CSV</a></p>
        </section>

        <section class="card">
            <h2>Oportunidades SEO</h2>
            <table>
                <thead>
                    <tr>
                        <th>Prioridad</th><th>Tipo</th><th>URL</th><th>Keyword</th><th>Métrica</th><th>Evidencia</th><th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($opportunities as $row): ?>
                        <tr>
                            <td><?= e((string) $row['priority']) ?></td>
                            <td><?= e($row['type']) ?></td>
                            <td class="url"><?= e($row['page_url'] ?? '') ?></td>
                            <td><?= e($row['keyword'] ?? '') ?></td>
                            <td><?= e($row['metric_name'] . ': ' . $row['metric_value']) ?></td>
                            <td><?= e($row['evidence']) ?></td>
                            <td><?= e($row['recommended_action']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </section>
        <?php
    });
}

function savePropertySelection(): void
{
    $ga4 = trim((string) ($_POST['ga4_property_id'] ?? ''));
    $gsc = trim((string) ($_POST['gsc_property_id'] ?? ''));
    if ($ga4 !== '') {
        (new GA4Service(new GoogleOAuthService()))->saveSelectedProperty($ga4, $ga4);
    }
    if ($gsc !== '') {
        (new SearchConsoleService(new GoogleOAuthService()))->saveSelectedProperty($gsc, $gsc);
    }
}

function selectedProperties(): array
{
    $rows = Database::pdo()->query('SELECT type, property_id FROM seo_properties WHERE is_active = 1 ORDER BY id DESC')->fetchAll();
    $selected = [];
    foreach ($rows as $row) {
        $selected[$row['type']] ??= $row['property_id'];
    }
    return $selected;
}

function render(string $title, callable $content): void
{
    ?><!doctype html>
    <html lang="es">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?= e($title) ?></title>
        <style>
            body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f7f2ef;color:#191512}
            main{max-width:1200px;margin:0 auto;padding:32px}
            .card{background:#fff;border:1px solid #ddd2cb;padding:24px;margin:0 0 24px}
            .button,button{background:#191512;color:#fff;border:0;padding:10px 14px;text-decoration:none;cursor:pointer}
            .danger{background:#b42318}.ok{color:#067647}.warn{color:#b54708}
            label{display:block;font-weight:700;margin-top:16px}select{width:100%;padding:10px;margin-top:6px}
            table{width:100%;border-collapse:collapse;font-size:14px}th,td{border-top:1px solid #ddd2cb;padding:10px;text-align:left;vertical-align:top}
            .url{max-width:260px;word-break:break-all}
        </style>
    </head>
    <body><main><h1><?= e($title) ?></h1><?php $content(); ?></main></body></html><?php
}

function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

function notFound(): void
{
    http_response_code(404);
    echo '404';
}
