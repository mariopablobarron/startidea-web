<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Services;

use Startidea\SeoConnector\Support\Database;

final class SeoOpportunityService
{
    public function generate(string $siteUrl, ?string $ga4PropertyId = null): int
    {
        $pdo = Database::pdo();
        $runId = $this->startRun($siteUrl, $ga4PropertyId);

        $count = 0;
        $count += $this->keywordsPosition4to20($siteUrl, $runId);
        $count += $this->highImpressionsLowCtr($siteUrl, $runId);
        $count += $this->fallingClicks($siteUrl, $runId);
        $count += $this->risingImpressionsFewClicks($siteUrl, $runId);
        $count += $this->cannibalizations($siteUrl, $runId);

        if ($ga4PropertyId) {
            $count += $this->organicTrafficLowConversion($ga4PropertyId, $runId);
            $count += $this->goodConversionLowTraffic($ga4PropertyId, $runId);
        }

        $count += $this->contentIdeas($siteUrl, $runId);
        $count += $this->titleMetaImprovements($siteUrl, $runId);
        $count += $this->internalLinking($siteUrl, $runId);

        $stmt = $pdo->prepare('UPDATE seo_agent_runs SET finished_at = NOW(), opportunities_count = :count, status = "completed" WHERE id = :id');
        $stmt->execute(['count' => $count, 'id' => $runId]);

        return $count;
    }

    private function startRun(string $siteUrl, ?string $ga4PropertyId): int
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO seo_agent_runs (site_url, ga4_property_id, status, started_at, created_at)
             VALUES (:site_url, :ga4_property_id, "running", NOW(), NOW())'
        );
        $stmt->execute(['site_url' => $siteUrl, 'ga4_property_id' => $ga4PropertyId]);
        return (int) Database::pdo()->lastInsertId();
    }

    private function insert(array $item): void
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO seo_opportunities
                (run_id, type, priority, site_url, page_url, keyword, metric_name, metric_value, evidence, recommended_action, status, created_at, updated_at)
             VALUES
                (:run_id, :type, :priority, :site_url, :page_url, :keyword, :metric_name, :metric_value, :evidence, :recommended_action, "open", NOW(), NOW())'
        );
        $stmt->execute($item);
    }

    private function keywordsPosition4to20(string $siteUrl, int $runId): int
    {
        $rows = Database::pdo()->prepare(
            'SELECT query, page_url, SUM(impressions) impressions, SUM(clicks) clicks, AVG(position) position
             FROM gsc_daily_queries
             WHERE site_url = :site_url AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY query, page_url
             HAVING position BETWEEN 4 AND 20 AND impressions >= 50
             ORDER BY impressions DESC
             LIMIT 50'
        );
        $rows->execute(['site_url' => $siteUrl]);
        return $this->mapRows($rows->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'keyword_position_4_20',
            'priority' => $r['position'] <= 10 ? 2 : 3,
            'site_url' => $siteUrl,
            'page_url' => $r['page_url'],
            'keyword' => $r['query'],
            'metric_name' => 'avg_position',
            'metric_value' => (string) round((float) $r['position'], 2),
            'evidence' => "{$r['impressions']} impresiones y {$r['clicks']} clicks en 28 dias.",
            'recommended_action' => 'Reforzar contenido, title, H1 y enlazado interno para empujar la keyword hacia top 3.',
        ]);
    }

    private function highImpressionsLowCtr(string $siteUrl, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT page_url, SUM(impressions) impressions, SUM(clicks) clicks, AVG(ctr) ctr, AVG(position) position
             FROM gsc_daily_pages
             WHERE site_url = :site_url AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY page_url
             HAVING impressions >= 500 AND ctr < 0.02
             ORDER BY impressions DESC
             LIMIT 50'
        );
        $stmt->execute(['site_url' => $siteUrl]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'high_impressions_low_ctr',
            'priority' => 1,
            'site_url' => $siteUrl,
            'page_url' => $r['page_url'],
            'keyword' => null,
            'metric_name' => 'ctr',
            'metric_value' => (string) round((float) $r['ctr'], 4),
            'evidence' => "{$r['impressions']} impresiones con CTR bajo.",
            'recommended_action' => 'Reescribir title/meta description orientados a intención de busqueda y beneficio concreto.',
        ]);
    }

    private function fallingClicks(string $siteUrl, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT recent.page_url, recent.clicks recent_clicks, previous.clicks previous_clicks
             FROM (
               SELECT page_url, SUM(clicks) clicks FROM gsc_daily_pages
               WHERE site_url = :site_url AND metric_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 28 DAY) AND CURDATE()
               GROUP BY page_url
             ) recent
             JOIN (
               SELECT page_url, SUM(clicks) clicks FROM gsc_daily_pages
               WHERE site_url = :site_url AND metric_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 56 DAY) AND DATE_SUB(CURDATE(), INTERVAL 29 DAY)
               GROUP BY page_url
             ) previous ON previous.page_url = recent.page_url
             WHERE previous.clicks >= 20 AND recent.clicks < previous.clicks * 0.7
             ORDER BY previous.clicks - recent.clicks DESC
             LIMIT 50'
        );
        $stmt->execute(['site_url' => $siteUrl]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'falling_clicks',
            'priority' => 1,
            'site_url' => $siteUrl,
            'page_url' => $r['page_url'],
            'keyword' => null,
            'metric_name' => 'click_drop',
            'metric_value' => (string) ((int) $r['previous_clicks'] - (int) $r['recent_clicks']),
            'evidence' => "Clicks recientes {$r['recent_clicks']} vs anteriores {$r['previous_clicks']}.",
            'recommended_action' => 'Auditar cambios de ranking, intención de búsqueda, canibalización y freshness del contenido.',
        ]);
    }

    private function risingImpressionsFewClicks(string $siteUrl, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT query, page_url, SUM(impressions) impressions, SUM(clicks) clicks, AVG(position) position
             FROM gsc_daily_queries
             WHERE site_url = :site_url AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY query, page_url
             HAVING impressions >= 100 AND clicks <= 3 AND position <= 30
             ORDER BY impressions DESC
             LIMIT 50'
        );
        $stmt->execute(['site_url' => $siteUrl]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'rising_impressions_few_clicks',
            'priority' => 2,
            'site_url' => $siteUrl,
            'page_url' => $r['page_url'],
            'keyword' => $r['query'],
            'metric_name' => 'impressions',
            'metric_value' => (string) $r['impressions'],
            'evidence' => "{$r['impressions']} impresiones, {$r['clicks']} clicks, posicion media {$r['position']}.",
            'recommended_action' => 'Crear o ampliar seccion que responda mejor a la intención de la consulta.',
        ]);
    }

    private function cannibalizations(string $siteUrl, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT query, COUNT(DISTINCT page_url) urls, SUM(impressions) impressions, GROUP_CONCAT(DISTINCT page_url SEPARATOR " | ") pages
             FROM gsc_daily_queries
             WHERE site_url = :site_url AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY query
             HAVING urls >= 2 AND impressions >= 100
             ORDER BY impressions DESC
             LIMIT 30'
        );
        $stmt->execute(['site_url' => $siteUrl]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'possible_cannibalization',
            'priority' => 2,
            'site_url' => $siteUrl,
            'page_url' => null,
            'keyword' => $r['query'],
            'metric_name' => 'competing_urls',
            'metric_value' => (string) $r['urls'],
            'evidence' => $r['pages'],
            'recommended_action' => 'Elegir URL principal, consolidar contenido y reforzar canonical/enlazado interno.',
        ]);
    }

    private function organicTrafficLowConversion(string $propertyId, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT page_path, SUM(sessions) sessions, SUM(conversions) conversions
             FROM ga4_daily_metrics
             WHERE property_id = :property_id AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY page_path
             HAVING sessions >= 100 AND conversions < 1
             ORDER BY sessions DESC
             LIMIT 50'
        );
        $stmt->execute(['property_id' => $propertyId]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'traffic_low_conversion',
            'priority' => 2,
            'site_url' => '',
            'page_url' => $r['page_path'],
            'keyword' => null,
            'metric_name' => 'sessions',
            'metric_value' => (string) $r['sessions'],
            'evidence' => "{$r['sessions']} sesiones y {$r['conversions']} conversiones.",
            'recommended_action' => 'Revisar CTA, formulario, prueba social y siguiente paso de la pagina.',
        ]);
    }

    private function goodConversionLowTraffic(string $propertyId, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT page_path, SUM(sessions) sessions, SUM(conversions) conversions
             FROM ga4_daily_metrics
             WHERE property_id = :property_id AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY page_path
             HAVING sessions < 100 AND conversions >= 2
             ORDER BY conversions DESC
             LIMIT 50'
        );
        $stmt->execute(['property_id' => $propertyId]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'good_conversion_low_traffic',
            'priority' => 2,
            'site_url' => '',
            'page_url' => $r['page_path'],
            'keyword' => null,
            'metric_name' => 'conversions',
            'metric_value' => (string) $r['conversions'],
            'evidence' => "Convierte con poco trafico: {$r['conversions']} conversiones / {$r['sessions']} sesiones.",
            'recommended_action' => 'Aumentar enlaces internos, contenidos satelite y visibilidad en navegación.',
        ]);
    }

    private function contentIdeas(string $siteUrl, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT query, SUM(impressions) impressions, AVG(position) position
             FROM gsc_daily_queries
             WHERE site_url = :site_url AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY query
             HAVING impressions >= 80 AND position > 20
             ORDER BY impressions DESC
             LIMIT 30'
        );
        $stmt->execute(['site_url' => $siteUrl]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'new_content_opportunity',
            'priority' => 3,
            'site_url' => $siteUrl,
            'page_url' => null,
            'keyword' => $r['query'],
            'metric_name' => 'impressions',
            'metric_value' => (string) $r['impressions'],
            'evidence' => "Demanda detectada sin ranking fuerte. Posicion media {$r['position']}.",
            'recommended_action' => 'Crear contenido especifico para esa intención o ampliar una pagina pilar existente.',
        ]);
    }

    private function titleMetaImprovements(string $siteUrl, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT page_url, SUM(impressions) impressions, SUM(clicks) clicks, AVG(ctr) ctr, AVG(position) position
             FROM gsc_daily_pages
             WHERE site_url = :site_url AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY page_url
             HAVING impressions >= 300 AND ctr < 0.03 AND position <= 15
             ORDER BY impressions DESC
             LIMIT 30'
        );
        $stmt->execute(['site_url' => $siteUrl]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'title_meta_improvement',
            'priority' => 2,
            'site_url' => $siteUrl,
            'page_url' => $r['page_url'],
            'keyword' => null,
            'metric_name' => 'ctr',
            'metric_value' => (string) round((float) $r['ctr'], 4),
            'evidence' => "{$r['impressions']} impresiones, posicion media {$r['position']} y CTR bajo.",
            'recommended_action' => 'Reescribir title y meta description con propuesta concreta, prueba y llamada al siguiente paso.',
        ]);
    }

    private function internalLinking(string $siteUrl, int $runId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT page_url, SUM(impressions) impressions, AVG(position) position
             FROM gsc_daily_pages
             WHERE site_url = :site_url AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
             GROUP BY page_url
             HAVING position BETWEEN 8 AND 20 AND impressions >= 100
             ORDER BY impressions DESC
             LIMIT 30'
        );
        $stmt->execute(['site_url' => $siteUrl]);
        return $this->mapRows($stmt->fetchAll(), fn ($r) => [
            'run_id' => $runId,
            'type' => 'internal_linking',
            'priority' => 3,
            'site_url' => $siteUrl,
            'page_url' => $r['page_url'],
            'keyword' => null,
            'metric_name' => 'avg_position',
            'metric_value' => (string) round((float) $r['position'], 2),
            'evidence' => "{$r['impressions']} impresiones con posicion media mejorable.",
            'recommended_action' => 'Añadir enlaces internos contextuales desde paginas con autoridad y anchors descriptivos.',
        ]);
    }

    private function mapRows(array $rows, callable $mapper): int
    {
        $count = 0;
        foreach ($rows as $row) {
            $this->insert($mapper($row));
            $count++;
        }
        return $count;
    }
}
