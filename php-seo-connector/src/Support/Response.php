<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Support;

final class Response
{
    public static function redirect(string $url): never
    {
        header('Location: ' . $url, true, 302);
        exit;
    }

    public static function csv(string $filename, array $headers, array $rows): never
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        $out = fopen('php://output', 'w');
        fputcsv($out, $headers);
        foreach ($rows as $row) {
            fputcsv($out, array_map(fn ($h) => $row[$h] ?? '', $headers));
        }
        fclose($out);
        exit;
    }
}
