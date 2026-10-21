<?php
/**
 * DukaanSaathi - Schema Migration & Seed Utility
 * Role: PHP/MySQL Engineer
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

function runMigration(): array
{
    $pdo = Database::getConnection();

    // 1. Run schema DDL
    $schemaSql = file_get_contents(__DIR__ . '/schema.sql');
    if ($schemaSql === false) {
        throw new RuntimeException("Unable to read schema.sql");
    }

    // Split SQL commands by semicolon safely
    $pdo->exec($schemaSql);

    // 2. Verify tables
    $stmt = $pdo->query("SHOW TABLES FROM `dukaansaathi_db`");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // 3. Seed initial Kirana catalog if empty
    $countStmt = $pdo->query("SELECT COUNT(*) FROM `products`");
    $productCount = (int)$countStmt->fetchColumn();

    $seededCount = 0;
    if ($productCount === 0) {
        $seedProducts = [
            ['SKU-001', '8901030383701', 'Tata Salt 1kg', 'टाटा नमक १ किलो', 'Groceries', 'packet', 28.00, 24.50, 45.00, 10.00],
            ['SKU-002', '8901725181222', 'Aashirvaad Shudh Chakki Atta 5kg', 'आशीर्वाद शुद्ध चक्की आटा ५ किलो', 'Flour & Grains', 'packet', 245.00, 220.00, 20.00, 5.00],
            ['SKU-003', '8901491101831', 'Fortune Sunlite Refined Oil 1L', 'फॉर्च्यून सूरजमुखी तेल १ लीटर', 'Oils & Ghee', 'ltr', 135.00, 122.00, 30.00, 8.00],
            ['SKU-004', '8901058852333', 'Maggi 2-Minute Noodles 70g', 'मैगी २-मिनट नूडल्स ७० ग्राम', 'Snacks', 'packet', 14.00, 12.20, 80.00, 15.00],
            ['SKU-005', '8901719101014', 'Parle-G Gold Biscuits 100g', 'पारले-जी गोल्ड बिस्कुट १०० ग्राम', 'Biscuits', 'packet', 10.00, 8.50, 60.00, 12.00],
            ['SKU-006', '8901262010052', 'Amul Taaza Homogenised Toned Milk 1L', 'अमूल ताज़ा टोंड दूध १ लीटर', 'Dairy', 'ltr', 72.00, 66.00, 25.00, 6.00],
            ['SKU-007', '8901030825317', 'Surf Excel Quick Wash Detergent Powder 1kg', 'सर्फ एक्सेल डिटर्जेंट पाउडर १ किलो', 'Household', 'packet', 140.00, 126.00, 18.00, 4.00],
            ['SKU-008', '8901052002130', 'Tata Tea Gold 250g', 'टाटा टी गोल्ड २५० ग्राम', 'Beverages', 'packet', 160.00, 142.00, 22.00, 5.00],
            ['SKU-009', 'SKU-SUGAR-1KG', 'Loose Crystal Sugar 1kg', 'खुली चीनी १ किलो', 'Groceries', 'kg', 44.00, 39.00, 150.00, 25.00],
            ['SKU-010', 'SKU-TOOR-1KG', 'Toor Dal Desi 1kg', 'तूर दाल देसी १ किलो', 'Pulses', 'kg', 165.00, 148.00, 85.00, 15.00],
            ['SKU-011', '8901207040220', 'Dettol Original Soap 125g', 'डेटॉल ओरिजिनल साबुन १२५ ग्राम', 'Personal Care', 'pc', 42.00, 36.50, 40.00, 8.00],
            ['SKU-012', '8901063012210', 'Britannia Good Day Butter Cookies 120g', 'ब्रिटानिया गुड डे कुकीज १२० ग्राम', 'Biscuits', 'packet', 30.00, 25.50, 50.00, 10.00],
        ];

        $insertSql = "INSERT INTO `products`
            (`sku_code`, `barcode`, `name_en`, `name_hi`, `category`, `unit`, `price`, `cost_price`, `stock_qty`, `low_stock_threshold`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $insertStmt = $pdo->prepare($insertSql);
        foreach ($seedProducts as $item) {
            $insertStmt->execute($item);
            $seededCount++;
        }
    }

    return [
        'status' => 'success',
        'database' => 'dukaansaathi_db',
        'tables_created' => $tables,
        'initial_products_seeded' => $seededCount,
        'total_products' => $productCount === 0 ? $seededCount : $productCount,
    ];
}

if (php_sapi_name() === 'cli') {
    echo "Starting DukaanSaathi MySQL Migration...\n";
    try {
        $result = runMigration();
        echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
        echo "Migration finished successfully.\n";
    } catch (Throwable $e) {
        echo "Migration failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}
