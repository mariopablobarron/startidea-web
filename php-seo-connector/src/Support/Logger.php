<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Support;

final class Logger
{
    public static function error(string $message, array $context = []): void
    {
        self::write('error', $message, self::redact($context));
    }

    public static function info(string $message, array $context = []): void
    {
        self::write('info', $message, self::redact($context));
    }

    private static function write(string $level, string $message, array $context): void
    {
        $root = dirname(__DIR__, 2);
        $line = json_encode([
            'ts' => gmdate('c'),
            'level' => $level,
            'message' => $message,
            'context' => $context,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        file_put_contents($root . '/storage/logs/app.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }

    private static function redact(array $context): array
    {
        foreach ($context as $key => $value) {
            if (preg_match('/token|secret|password|client/i', (string) $key)) {
                $context[$key] = '[redacted]';
            } elseif (is_array($value)) {
                $context[$key] = self::redact($value);
            }
        }

        return $context;
    }
}
