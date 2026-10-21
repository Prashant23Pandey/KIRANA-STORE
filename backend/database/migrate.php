<?php
/**
 * DukaanSaathi - Authoritative Schema Migration & Seed Utility
 * Role: PHP/MySQL Engineer
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

function runMigration(): array
{
    $pdo = Database::getConnection();

    // 1. Drop old tables cleanly to ensure exact schema compliance with Prompt 3
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
    $tablesToDrop = [
        'stock_movements',
        'inventory_logs',
        'sync_operations',
        'bill_items',
        'bills',
        'products',
        'settings',
        'devices',
        'shops'
    ];
    foreach ($tablesToDrop as $tbl) {
        $pdo->exec("DROP TABLE IF EXISTS `$tbl`;");
    }
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

    // 2. Run full schema DDL
    $schemaSql = file_get_contents(__DIR__ . '/schema.sql');
    if ($schemaSql === false) {
        throw new RuntimeException("Unable to read schema.sql");
    }

    $pdo->exec($schemaSql);

    // 3. Ensure default shop exists
    $stmt = $pdo->prepare("INSERT INTO `shops` (`id`, `name`, `address`, `phone`, `currency`, `tax_number`)
        VALUES (1, 'DukaanSaathi Kirana Store', 'Shop No. 4, Main Bazaar, Near Old Post Office', '+91 98765 43210', 'INR', 'GSTIN-DEMO27AAAAA0000A1Z5')");
    $stmt->execute();

    // 4. Ensure default shop settings exist
    $defaultSettings = [
        ['store_name', 'DukaanSaathi Kirana Store', 'profile'],
        ['store_address', 'Shop No. 4, Main Bazaar, Near Old Post Office', 'profile'],
        ['store_phone', '+91 98765 43210', 'profile'],
        ['store_upi_id', 'kirana@upi', 'payment'],
        ['currency', 'INR', 'general'],
        ['default_language', 'hi', 'localization'],
        ['whatsapp_receipt_note', 'धन्यवाद! आपकी यात्रा शुभ हो।', 'receipt'],
        ['auto_sync_interval_sec', '30', 'sync'],
    ];

    $settingStmt = $pdo->prepare("INSERT INTO `settings` (`shop_id`, `setting_key`, `setting_value`, `category`)
        VALUES (1, :key, :val, :cat)");

    foreach ($defaultSettings as [$key, $val, $cat]) {
        $settingStmt->execute(['key' => $key, 'val' => $val, 'cat' => $cat]);
    }

    // 5. Seed Kirana catalog
    $seedProducts = [
        ['SKU-001', '8901030383701', 'Tata Salt 1kg', 'टाटा नमक १ किलो', 'Groceries', 'packet', 28.00, 24.50, 45.000, 10.000, 2, 5.000],
        ['SKU-002', '8901725181222', 'Aashirvaad Shudh Chakki Atta 5kg', 'आशीर्वाद शुद्ध चक्की आटा ५ किलो', 'Flour & Grains', 'packet', 245.00, 220.00, 20.000, 5.000, 3, 5.000],
        ['SKU-003', '8901491101831', 'Fortune Sunlite Refined Oil 1L', 'फॉर्च्यून सूरजमुखी तेल १ लीटर', 'Oils & Ghee', 'ltr', 135.00, 122.00, 30.000, 8.000, 2, 5.000],
        ['SKU-004', '8901058852333', 'Maggi 2-Minute Noodles 70g', 'मैगी २-मिनट नूडल्स ७० ग्राम', 'Snacks', 'packet', 14.00, 12.20, 80.000, 15.000, 1, 10.000],
        ['SKU-005', '8901719101014', 'Parle-G Gold Biscuits 100g', 'पारले-जी गोल्ड बिस्कुट १०० ग्राम', 'Biscuits', 'packet', 10.00, 8.50, 60.000, 12.000, 2, 10.000],
        ['SKU-006', '8901262010052', 'Amul Taaza Milk 1L', 'अमूल ताज़ा टोंड दूध १ लीटर', 'Dairy', 'ltr', 72.00, 66.00, 25.000, 6.000, 1, 4.000],
        ['SKU-007', '8901030825317', 'Surf Excel Detergent Powder 1kg', 'सर्फ एक्सेल डिटर्जेंट पाउडर १ किलो', 'Household', 'packet', 140.00, 126.00, 18.000, 4.000, 3, 3.000],
        ['SKU-008', '8901052002130', 'Tata Tea Gold 250g', 'टाटा टी गोल्ड २५० ग्राम', 'Beverages', 'packet', 160.00, 142.00, 22.000, 5.000, 2, 4.000],
        ['SKU-009', 'SKU-SUGAR-1KG', 'Loose Crystal Sugar 1kg', 'खुली चीनी १ किलो', 'Groceries', 'kg', 44.00, 39.00, 150.000, 25.000, 2, 20.000],
        ['SKU-010', 'SKU-TOOR-1KG', 'Toor Dal Desi 1kg', 'तूर दाल देसी १ किलो', 'Pulses', 'kg', 165.00, 148.00, 85.000, 15.000, 3, 15.000],
        ['SKU-011', '8901207040220', 'Dettol Original Soap 125g', 'डेटॉल ओरिजिनल साबुन १२५ ग्राम', 'Personal Care', 'pc', 42.00, 36.50, 40.000, 8.000, 2, 8.000],
        ['SKU-012', '8901063012210', 'Britannia Good Day Cookies 120g', 'ब्रिटानिया गुड डे कुकीज १२० ग्राम', 'Biscuits', 'packet', 30.00, 25.50, 50.000, 10.000, 2, 10.000],
    ];

    $insertSql = "INSERT INTO `products`
        (`shop_id`, `sku_code`, `barcode`, `name_en`, `name_hi`, `category`, `unit`, `price`, `cost_price`, `stock_qty`, `low_stock_threshold`, `lead_time_days`, `safety_stock_qty`)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    $insertStmt = $pdo->prepare($insertSql);
    $seededCount = 0;
    foreach ($seedProducts as $item) {
        $insertStmt->execute($item);
        $seededCount++;
    }

    $stmt = $pdo->query("SHOW TABLES FROM `dukaansaathi_db`");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    return [
        'status' => 'success',
        'database' => 'dukaansaathi_db',
        'tables_created' => $tables,
        'initial_products_seeded' => $seededCount,
        'total_products' => $seededCount,
    ];
}

if (php_sapi_name() === 'cli') {
    echo "Starting DukaanSaathi Clean Schema Migration...\n";
    try {
        $result = runMigration();
        echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
        echo "Migration completed successfully.\n";
    } catch (Throwable $e) {
        echo "Migration failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}
