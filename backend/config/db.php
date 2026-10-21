<?php
/**
 * DukaanSaathi - Database Connection Layer (PDO Prepared Statements)
 * Role: PHP/MySQL Engineer
 */

declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    /**
     * Get or create authoritative PDO connection
     */
    public static function getConnection(?array $customConfig = null): PDO
    {
        if (self::$instance === null) {
            $config = $customConfig ?? require __DIR__ . '/config.php';
            $db = $config['db'];

            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $db['host'],
                $db['port'],
                $db['dbname'],
                $db['charset']
            );

            try {
                self::$instance = new PDO(
                    $dsn,
                    $db['username'],
                    $db['password'],
                    $db['options']
                );
            } catch (PDOException $e) {
                // If database does not exist yet during initial boot, allow connection without dbname for migrations
                if ($e->getCode() === 1049) { // Unknown database
                    $fallbackDsn = sprintf(
                        'mysql:host=%s;port=%d;charset=%s',
                        $db['host'],
                        $db['port'],
                        $db['charset']
                    );
                    self::$instance = new PDO(
                        $fallbackDsn,
                        $db['username'],
                        $db['password'],
                        $db['options']
                    );
                } else {
                    throw new RuntimeException("Database connection error: " . $e->getMessage(), (int)$e->getCode(), $e);
                }
            }
        }

        return self::$instance;
    }

    /**
     * Helper to verify database connectivity and return metadata
     */
    public static function ping(): array
    {
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->query('SELECT VERSION() as server_version, DATABASE() as current_db, NOW() as server_time');
            $data = $stmt->fetch();
            return [
                'status' => 'connected',
                'server_version' => $data['server_version'] ?? 'unknown',
                'current_db' => $data['current_db'] ?? null,
                'server_time' => $data['server_time'] ?? null,
            ];
        } catch (Throwable $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }
}
