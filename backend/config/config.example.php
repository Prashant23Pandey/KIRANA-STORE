<?php
/**
 * DukaanSaathi - Configuration Template (Example)
 * Copy this file to config.php and update with your local environment values.
 */

declare(strict_types=1);

return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'dbname' => 'dukaansaathi_db',
        'username' => 'root',       // Replace with your local MySQL username
        'password' => '',           // Replace with your local MySQL password
        'charset' => 'utf8mb4',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ],
    ],
    'app' => [
        'name' => 'DukaanSaathi Kirana System',
        'version' => '1.0.0',
        'env' => 'development', // 'development' or 'production'
        'allowed_origins' => [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://localhost',
            'http://127.0.0.1',
        ],
    ],
];
