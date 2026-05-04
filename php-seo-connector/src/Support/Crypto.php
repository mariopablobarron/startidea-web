<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Support;

final class Crypto
{
    private const CIPHER = 'aes-256-gcm';

    public static function encrypt(string $plain): string
    {
        $key = self::key();
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            throw new \RuntimeException('Could not encrypt value.');
        }

        return base64_encode(json_encode([
            'v' => 1,
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'data' => base64_encode($cipher),
        ], JSON_THROW_ON_ERROR));
    }

    public static function decrypt(string $payload): string
    {
        $decoded = json_decode(base64_decode($payload, true) ?: '', true, 512, JSON_THROW_ON_ERROR);
        $plain = openssl_decrypt(
            base64_decode($decoded['data'], true),
            self::CIPHER,
            self::key(),
            OPENSSL_RAW_DATA,
            base64_decode($decoded['iv'], true),
            base64_decode($decoded['tag'], true)
        );

        if ($plain === false) {
            throw new \RuntimeException('Could not decrypt value.');
        }

        return $plain;
    }

    private static function key(): string
    {
        $raw = Env::required('APP_ENCRYPTION_KEY');
        $decoded = base64_decode($raw, true);
        if ($decoded !== false && strlen($decoded) === 32) {
            return $decoded;
        }

        return hash('sha256', $raw, true);
    }
}
