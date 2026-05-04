<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Services;

use Google\Service\AnalyticsData;
use Google\Service\AnalyticsData\DateRange;
use Google\Service\AnalyticsData\Dimension;
use Google\Service\AnalyticsData\Metric;
use Google\Service\AnalyticsData\RunReportRequest;
use Startidea\SeoConnector\Support\Database;

final class GA4Service
{
    public function __construct(private readonly GoogleOAuthService $oauth)
    {
    }

    public function listProperties(): array
    {
        $client = $this->oauth->authorizedClient();

        $adminClass = class_exists(\Google\Service\AnalyticsAdmin::class)
            ? \Google\Service\AnalyticsAdmin::class
            : (class_exists(\Google\Service\GoogleAnalyticsAdmin::class) ? \Google\Service\GoogleAnalyticsAdmin::class : null);

        if (!$adminClass) {
            return [];
        }

        $admin = new $adminClass($client);
        $items = [];
        foreach ($admin->accountSummaries->listAccountSummaries()->getAccountSummaries() ?? [] as $account) {
            foreach ($account->getPropertySummaries() ?? [] as $property) {
                $items[] = [
                    'property_id' => preg_replace('/^properties\//', '', $property->getProperty()),
                    'name' => $property->getDisplayName(),
                    'account_name' => $account->getDisplayName(),
                ];
            }
        }

        return $items;
    }

    public function saveSelectedProperty(string $propertyId, string $name = ''): void
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO seo_properties (type, property_id, display_name, is_active, created_at, updated_at)
             VALUES ("ga4", :property_id, :display_name, 1, NOW(), NOW())
             ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_active = 1, updated_at = NOW()'
        );
        $stmt->execute(['property_id' => $propertyId, 'display_name' => $name]);
    }

    public function syncDailyPageMetrics(string $propertyId, string $startDate, string $endDate): int
    {
        $service = new AnalyticsData($this->oauth->authorizedClient());
        $request = new RunReportRequest([
            'dateRanges' => [new DateRange(['startDate' => $startDate, 'endDate' => $endDate])],
            'dimensions' => [
                new Dimension(['name' => 'date']),
                new Dimension(['name' => 'pagePathPlusQueryString']),
            ],
            'metrics' => [
                new Metric(['name' => 'activeUsers']),
                new Metric(['name' => 'sessions']),
                new Metric(['name' => 'screenPageViews']),
                new Metric(['name' => 'eventCount']),
                new Metric(['name' => 'conversions']),
            ],
            'limit' => 100000,
        ]);

        $response = $service->properties->runReport('properties/' . $propertyId, $request);
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO ga4_daily_metrics
                (property_id, metric_date, page_path, active_users, sessions, screen_page_views, event_count, conversions, created_at, updated_at)
             VALUES
                (:property_id, :metric_date, :page_path, :active_users, :sessions, :screen_page_views, :event_count, :conversions, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                active_users = VALUES(active_users), sessions = VALUES(sessions),
                screen_page_views = VALUES(screen_page_views), event_count = VALUES(event_count),
                conversions = VALUES(conversions), updated_at = NOW()'
        );

        $count = 0;
        foreach ($response->getRows() ?? [] as $row) {
            $dims = $row->getDimensionValues();
            $metrics = $row->getMetricValues();
            $date = $dims[0]->getValue();
            $stmt->execute([
                'property_id' => $propertyId,
                'metric_date' => substr($date, 0, 4) . '-' . substr($date, 4, 2) . '-' . substr($date, 6, 2),
                'page_path' => $dims[1]->getValue(),
                'active_users' => (int) $metrics[0]->getValue(),
                'sessions' => (int) $metrics[1]->getValue(),
                'screen_page_views' => (int) $metrics[2]->getValue(),
                'event_count' => (int) $metrics[3]->getValue(),
                'conversions' => (float) $metrics[4]->getValue(),
            ]);
            $count++;
        }

        return $count;
    }
}
