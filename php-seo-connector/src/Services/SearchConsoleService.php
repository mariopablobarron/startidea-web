<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Services;

use Startidea\SeoConnector\Support\Database;

final class SearchConsoleService
{
    public function __construct(private readonly GoogleOAuthService $oauth)
    {
    }

    public function listProperties(): array
    {
        $service = $this->service();
        $sites = $service->sites->listSites();
        $items = [];
        foreach ($sites->getSiteEntry() ?? [] as $site) {
            $items[] = [
                'site_url' => $site->getSiteUrl(),
                'permission_level' => $site->getPermissionLevel(),
            ];
        }
        return $items;
    }

    public function saveSelectedProperty(string $siteUrl, string $name = ''): void
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO seo_properties (type, property_id, display_name, is_active, created_at, updated_at)
             VALUES ("gsc", :property_id, :display_name, 1, NOW(), NOW())
             ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_active = 1, updated_at = NOW()'
        );
        $stmt->execute(['property_id' => $siteUrl, 'display_name' => $name ?: $siteUrl]);
    }

    public function syncDailyQueries(string $siteUrl, string $startDate, string $endDate): int
    {
        return $this->sync($siteUrl, $startDate, $endDate, ['date', 'query', 'page', 'country', 'device'], 'gsc_daily_queries');
    }

    public function syncDailyPages(string $siteUrl, string $startDate, string $endDate): int
    {
        return $this->sync($siteUrl, $startDate, $endDate, ['date', 'page', 'country', 'device'], 'gsc_daily_pages');
    }

    private function sync(string $siteUrl, string $startDate, string $endDate, array $dimensions, string $table): int
    {
        $service = $this->service();
        $requestClass = class_exists(\Google\Service\SearchConsole\SearchAnalyticsQueryRequest::class)
            ? \Google\Service\SearchConsole\SearchAnalyticsQueryRequest::class
            : \Google\Service\Webmasters\SearchAnalyticsQueryRequest::class;

        $request = new $requestClass([
            'startDate' => $startDate,
            'endDate' => $endDate,
            'dimensions' => $dimensions,
            'rowLimit' => 25000,
        ]);

        $response = $service->searchanalytics->query($siteUrl, $request);
        $pdo = Database::pdo();
        $isQueryTable = $table === 'gsc_daily_queries';
        $sql = $isQueryTable
            ? 'INSERT INTO gsc_daily_queries
                (site_url, metric_date, query, page_url, country, device, clicks, impressions, ctr, position, created_at, updated_at)
               VALUES (:site_url, :metric_date, :query, :page_url, :country, :device, :clicks, :impressions, :ctr, :position, NOW(), NOW())
               ON DUPLICATE KEY UPDATE clicks = VALUES(clicks), impressions = VALUES(impressions), ctr = VALUES(ctr), position = VALUES(position), updated_at = NOW()'
            : 'INSERT INTO gsc_daily_pages
                (site_url, metric_date, page_url, country, device, clicks, impressions, ctr, position, created_at, updated_at)
               VALUES (:site_url, :metric_date, :page_url, :country, :device, :clicks, :impressions, :ctr, :position, NOW(), NOW())
               ON DUPLICATE KEY UPDATE clicks = VALUES(clicks), impressions = VALUES(impressions), ctr = VALUES(ctr), position = VALUES(position), updated_at = NOW()';

        $stmt = $pdo->prepare($sql);
        $count = 0;

        foreach ($response->getRows() ?? [] as $row) {
            $keys = $row->getKeys();
            $params = [
                'site_url' => $siteUrl,
                'metric_date' => $keys[0] ?? null,
                'page_url' => $isQueryTable ? ($keys[2] ?? '') : ($keys[1] ?? ''),
                'country' => $isQueryTable ? ($keys[3] ?? '') : ($keys[2] ?? ''),
                'device' => $isQueryTable ? ($keys[4] ?? '') : ($keys[3] ?? ''),
                'clicks' => (int) $row->getClicks(),
                'impressions' => (int) $row->getImpressions(),
                'ctr' => (float) $row->getCtr(),
                'position' => (float) $row->getPosition(),
            ];
            if ($isQueryTable) {
                $params['query'] = $keys[1] ?? '';
            }
            $stmt->execute($params);
            $count++;
        }

        return $count;
    }

    private function service(): object
    {
        $client = $this->oauth->authorizedClient();
        if (class_exists(\Google\Service\SearchConsole::class)) {
            return new \Google\Service\SearchConsole($client);
        }
        if (class_exists(\Google\Service\Webmasters::class)) {
            return new \Google\Service\Webmasters($client);
        }
        throw new \RuntimeException('Search Console service class not found. Check google/apiclient installation.');
    }
}
