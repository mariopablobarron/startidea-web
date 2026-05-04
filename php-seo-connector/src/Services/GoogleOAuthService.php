<?php

declare(strict_types=1);

namespace Startidea\SeoConnector\Services;

use Google\Client;
use Startidea\SeoConnector\Support\Crypto;
use Startidea\SeoConnector\Support\Database;
use Startidea\SeoConnector\Support\Env;
use Startidea\SeoConnector\Support\Logger;

final class GoogleOAuthService
{
    public const SCOPES = [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
    ];

    public function createClient(): Client
    {
        $client = new Client();
        $client->setClientId(Env::required('GOOGLE_CLIENT_ID'));
        $client->setClientSecret(Env::required('GOOGLE_CLIENT_SECRET'));
        $client->setRedirectUri(Env::required('GOOGLE_REDIRECT_URI'));
        $client->setScopes(self::SCOPES);
        $client->setAccessType('offline');
        $client->setPrompt('consent');
        $client->setIncludeGrantedScopes(true);

        return $client;
    }

    public function getAuthUrl(string $state): string
    {
        $client = $this->createClient();
        $client->setState($state);
        return $client->createAuthUrl();
    }

    public function handleCallback(string $code): int
    {
        $client = $this->createClient();
        $token = $client->fetchAccessTokenWithAuthCode($code);

        if (isset($token['error'])) {
            Logger::error('Google OAuth token exchange failed', ['error' => $token['error']]);
            throw new \RuntimeException('Google OAuth token exchange failed.');
        }

        $refreshToken = $token['refresh_token'] ?? null;
        if (!$refreshToken) {
            throw new \RuntimeException('Google did not return a refresh token. Revoke access and reconnect with consent prompt.');
        }

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO google_connections
                (google_subject, email, scopes, encrypted_refresh_token, token_created_at, connected_at, updated_at)
             VALUES
                (:subject, :email, :scopes, :refresh_token, NOW(), NOW(), NOW())'
        );

        $payload = $client->verifyIdToken();
        $stmt->execute([
            'subject' => is_array($payload) ? ($payload['sub'] ?? null) : null,
            'email' => is_array($payload) ? ($payload['email'] ?? null) : null,
            'scopes' => implode(' ', self::SCOPES),
            'refresh_token' => Crypto::encrypt($refreshToken),
        ]);

        return (int) $pdo->lastInsertId();
    }

    public function authorizedClient(?int $connectionId = null): Client
    {
        $connection = $this->connection($connectionId);
        $refreshToken = Crypto::decrypt($connection['encrypted_refresh_token']);

        $client = $this->createClient();
        $token = $client->fetchAccessTokenWithRefreshToken($refreshToken);
        if (isset($token['error'])) {
            Logger::error('Google OAuth refresh failed', ['error' => $token['error'], 'connection_id' => $connection['id']]);
            throw new \RuntimeException('Could not refresh Google access token.');
        }

        return $client;
    }

    public function connection(?int $connectionId = null): array
    {
        $pdo = Database::pdo();
        if ($connectionId) {
            $stmt = $pdo->prepare('SELECT * FROM google_connections WHERE id = :id AND disconnected_at IS NULL');
            $stmt->execute(['id' => $connectionId]);
        } else {
            $stmt = $pdo->query('SELECT * FROM google_connections WHERE disconnected_at IS NULL ORDER BY id DESC LIMIT 1');
        }

        $row = $stmt->fetch();
        if (!$row) {
            throw new \RuntimeException('No active Google connection.');
        }

        return $row;
    }

    public function disconnect(?int $connectionId = null): void
    {
        $connection = $this->connection($connectionId);
        try {
            $client = $this->createClient();
            $client->revokeToken(Crypto::decrypt($connection['encrypted_refresh_token']));
        } catch (\Throwable $e) {
            Logger::error('Google token revocation failed', ['connection_id' => $connection['id'], 'error' => $e->getMessage()]);
        }

        $stmt = Database::pdo()->prepare('UPDATE google_connections SET disconnected_at = NOW(), updated_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $connection['id']]);
    }

    public function status(): array
    {
        $row = Database::pdo()
            ->query('SELECT id, email, scopes, connected_at, disconnected_at FROM google_connections ORDER BY id DESC LIMIT 1')
            ->fetch();

        return [
            'connected' => $row && $row['disconnected_at'] === null,
            'connection' => $row ?: null,
        ];
    }
}
