<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Support;

final class Auth
{
    public static function requireAdmin(): void
    {
        $expected = Env::required('ADMIN_TOKEN');
        $provided = $_GET['token'] ?? $_POST['token'] ?? $_COOKIE['startidea_admin'] ?? '';

        if (is_string($provided) && hash_equals($expected, $provided)) {
            setcookie('startidea_admin', $provided, [
                'expires' => time() + 86400,
                'path' => '/admin',
                'secure' => self::isHttps(),
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            return;
        }

        http_response_code(403);
        echo '<h1>Acceso restringido</h1><p>Añade <code>?token=ADMIN_TOKEN</code> para entrar.</p>';
        exit;
    }

    private static function isHttps(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    }
}
