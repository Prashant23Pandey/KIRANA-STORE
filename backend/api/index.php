<?php
/**
 * DukaanSaathi - Authoritative REST API (PHP 8+ & MySQL PDO)
 * Role: PHP/MySQL Engineer
 */

declare(strict_types=1);

// Prevent leaking raw PHP notices or warnings to JSON output
error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/../config/db.php';
$config = require __DIR__ . '/../config/config.php';

// 1. CORS Configuration
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $config['app']['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Device-ID');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 2. Uniform JSON Response Helpers
function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function errorResponse(string $message, int $statusCode = 400, ?array $details = null): void
{
    jsonResponse([
        'success' => false,
        'error' => [
            'message' => $message,
            'details' => $details,
        ],
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
    ], $statusCode);
}

// 3. Request Parsing
$method = $_SERVER['REQUEST_METHOD'];
$endpoint = $_GET['endpoint'] ?? '';

// Fallback parse from REQUEST_URI if endpoint query param not used
if (empty($endpoint)) {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '';
    if (preg_match('#/api(?:/index\.php)?/(.*)$#i', $path, $matches)) {
        $endpoint = trim($matches[1], '/');
    }
}
$endpoint = trim($endpoint, '/');

// Parse route segments (e.g. products/12 or products/barcode/8901030383701)
$segments = explode('/', $endpoint);
$resource = $segments[0] ?? '';
$subResource = $segments[1] ?? null;
$paramId = $segments[2] ?? null;

// Parse incoming JSON body
$rawInput = file_get_contents('php://input');
$body = [];
if (!empty($rawInput)) {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}

try {
    $pdo = Database::getConnection();

    // 4. API Routing Switch
    switch (true) {
        // =================================================================
        // 4.1 HEALTH & SYSTEM CONNECTIVITY
        // =================================================================
        case ($resource === 'health' || $resource === ''):
            $dbPing = Database::ping();
            jsonResponse([
                'success' => true,
                'app' => $config['app']['name'],
                'version' => $config['app']['version'],
                'php_version' => PHP_VERSION,
                'database' => $dbPing,
                'server_time' => gmdate('Y-m-d\TH:i:s\Z'),
            ]);
            break;

        // =================================================================
        // 4.2 PRODUCTS: GET / BARCODE LOOKUP / DETAILS
        // =================================================================
        case ($resource === 'products' && $method === 'GET'):
            // Barcode lookup via path: /products/barcode/{code} or query ?barcode={code}
            $barcode = ($subResource === 'barcode' && !empty($paramId))
                ? $paramId
                : ($_GET['barcode'] ?? null);

            if ($barcode) {
                $stmt = $pdo->prepare("SELECT * FROM `products` WHERE `barcode` = :barcode AND `is_active` = 1 LIMIT 1");
                $stmt->execute(['barcode' => $barcode]);
                $product = $stmt->fetch();
                if ($product) {
                    jsonResponse(['success' => true, 'data' => $product]);
                } else {
                    errorResponse("Product with barcode '$barcode' not found in store catalog.", 404);
                }
            }

            // Single Product Details via path: /products/{id}
            if ($subResource && is_numeric($subResource)) {
                $stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = :id LIMIT 1");
                $stmt->execute(['id' => (int)$subResource]);
                $product = $stmt->fetch();
                if ($product) {
                    jsonResponse(['success' => true, 'data' => $product]);
                } else {
                    errorResponse("Product ID '$subResource' not found.", 404);
                }
            }

            // Products List & Search
            $search = $_GET['q'] ?? null;
            $category = $_GET['category'] ?? null;

            $sql = "SELECT * FROM `products` WHERE `is_active` = 1";
            $params = [];

            if ($search) {
                $sql .= " AND (`name_en` LIKE :q OR `name_hi` LIKE :q OR `sku_code` LIKE :q OR `barcode` LIKE :q)";
                $params['q'] = "%$search%";
            }
            if ($category && $category !== 'All') {
                $sql .= " AND `category` = :cat";
                $params['cat'] = $category;
            }

            $sql .= " ORDER BY `category` ASC, `name_en` ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $products = $stmt->fetchAll();

            jsonResponse([
                'success' => true,
                'count' => count($products),
                'data' => $products,
                'synced_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ]);
            break;

        // =================================================================
        // 4.3 PRODUCTS: CREATE / UPDATE
        // =================================================================
        case ($resource === 'products' && ($method === 'POST' || $method === 'PUT')):
            $productId = ($subResource && is_numeric($subResource)) ? (int)$subResource : null;

            $nameEn = trim($body['name_en'] ?? '');
            if (empty($nameEn)) {
                errorResponse("English product name ('name_en') is mandatory.", 422);
            }

            $price = filter_var($body['price'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($price === false || $price < 0) {
                errorResponse("Selling price ('price') must be a positive number.", 422);
            }

            $nameHi = !empty($body['name_hi']) ? trim($body['name_hi']) : null;
            $category = !empty($body['category']) ? trim($body['category']) : 'Groceries';
            $unit = !empty($body['unit']) ? trim($body['unit']) : 'packet';
            $barcode = !empty($body['barcode']) ? trim($body['barcode']) : null;
            $costPrice = (float)($body['cost_price'] ?? ($price * 0.85));
            $stockQty = (float)($body['stock_qty'] ?? 0.0);
            $lowStock = (float)($body['low_stock_threshold'] ?? 5.0);
            $leadTime = (int)($body['lead_time_days'] ?? 2);
            $safetyStock = (float)($body['safety_stock_qty'] ?? 2.0);

            if ($productId) {
                // Update Product
                $stmt = $pdo->prepare("UPDATE `products` SET
                    `name_en` = :name_en, `name_hi` = :name_hi, `category` = :cat, `unit` = :unit,
                    `price` = :price, `cost_price` = :cost_price, `low_stock_threshold` = :low_stock,
                    `lead_time_days` = :lead_time, `safety_stock_qty` = :safety_stock,
                    `version` = `version` + 1
                    WHERE `id` = :id");

                $stmt->execute([
                    'name_en' => $nameEn,
                    'name_hi' => $nameHi,
                    'cat' => $category,
                    'unit' => $unit,
                    'price' => $price,
                    'cost_price' => $costPrice,
                    'low_stock' => $lowStock,
                    'lead_time' => $leadTime,
                    'safety_stock' => $safetyStock,
                    'id' => $productId,
                ]);

                $fetch = $pdo->prepare("SELECT * FROM `products` WHERE `id` = :id");
                $fetch->execute(['id' => $productId]);
                jsonResponse(['success' => true, 'message' => 'Product updated successfully', 'data' => $fetch->fetch()]);
            } else {
                // Create New Product
                $skuCode = trim($body['sku_code'] ?? 'SKU-' . strtoupper(bin2hex(random_bytes(3))));
                $stmt = $pdo->prepare("INSERT INTO `products`
                    (`shop_id`, `sku_code`, `barcode`, `name_en`, `name_hi`, `category`, `unit`, `price`, `cost_price`, `stock_qty`, `low_stock_threshold`, `lead_time_days`, `safety_stock_qty`)
                    VALUES (1, :sku, :barcode, :name_en, :name_hi, :cat, :unit, :price, :cost_price, :stock, :low_stock, :lead_time, :safety_stock)");

                $stmt->execute([
                    'sku' => $skuCode,
                    'barcode' => $barcode,
                    'name_en' => $nameEn,
                    'name_hi' => $nameHi,
                    'cat' => $category,
                    'unit' => $unit,
                    'price' => $price,
                    'cost_price' => $costPrice,
                    'stock' => $stockQty,
                    'low_stock' => $lowStock,
                    'lead_time' => $leadTime,
                    'safety_stock' => $safetyStock,
                ]);

                $newId = (int)$pdo->lastInsertId();
                $fetch = $pdo->prepare("SELECT * FROM `products` WHERE `id` = :id");
                $fetch->execute(['id' => $newId]);
                jsonResponse(['success' => true, 'message' => 'Product registered successfully', 'data' => $fetch->fetch()], 201);
            }
            break;

        // =================================================================
        // 4.4 STOCK: RECEIVE STOCK / INVENTORY ADJUSTMENT
        // =================================================================
        case ($resource === 'stock' && $subResource === 'receive' && $method === 'POST'):
            $clientOpId = trim($body['client_op_id'] ?? '');
            $productId = (int)($body['product_id'] ?? 0);
            $addQty = (float)($body['quantity'] ?? 0);
            $reason = trim($body['reason'] ?? 'Goods Received / Inward');
            $deviceId = trim($body['device_id'] ?? 'counter_01');

            if (empty($clientOpId) || $productId <= 0 || $addQty <= 0) {
                errorResponse("Valid 'client_op_id', 'product_id', and positive 'quantity' required.", 422);
            }

            // Retry protection check
            $check = $pdo->prepare("SELECT * FROM `stock_movements` WHERE `client_op_id` = :op_id LIMIT 1");
            $check->execute(['op_id' => $clientOpId]);
            $existing = $check->fetch();
            if ($existing) {
                jsonResponse([
                    'success' => true,
                    'status' => 'duplicate_ignored',
                    'message' => 'Stock receive operation already recorded',
                    'data' => $existing,
                ]);
            }

            $pdo->beginTransaction();

            // Lock product row
            $prodStmt = $pdo->prepare("SELECT id, stock_qty, name_en FROM `products` WHERE `id` = :id FOR UPDATE");
            $prodStmt->execute(['id' => $productId]);
            $prod = $prodStmt->fetch();
            if (!$prod) {
                $pdo->rollBack();
                errorResponse("Product ID $productId not found.", 404);
            }

            $newBalance = (float)$prod['stock_qty'] + $addQty;

            // Update stock
            $update = $pdo->prepare("UPDATE `products` SET `stock_qty` = :qty, `version` = `version` + 1 WHERE `id` = :id");
            $update->execute(['qty' => $newBalance, 'id' => $productId]);

            // Insert stock movement ledger
            $mov = $pdo->prepare("INSERT INTO `stock_movements`
                (`client_op_id`, `product_id`, `quantity_delta`, `balance_after`, `reason`, `operation_type`, `device_id`)
                VALUES (:op_id, :prod_id, :delta, :bal, :reason, 'purchase_receive', :device_id)");
            $mov->execute([
                'op_id' => $clientOpId,
                'prod_id' => $productId,
                'delta' => $addQty,
                'bal' => $newBalance,
                'reason' => $reason,
                'device_id' => $deviceId,
            ]);

            $pdo->commit();

            jsonResponse([
                'success' => true,
                'message' => "Received $addQty units for {$prod['name_en']}",
                'product_id' => $productId,
                'previous_stock' => (float)$prod['stock_qty'],
                'new_stock' => $newBalance,
            ]);
            break;

        case ($resource === 'stock' && $subResource === 'adjust' && $method === 'POST'):
            $clientOpId = trim($body['client_op_id'] ?? '');
            $productId = (int)($body['product_id'] ?? 0);
            $newExactQty = (float)($body['new_quantity'] ?? 0);
            $reason = trim($body['reason'] ?? 'Physical stock audit adjustment');
            $deviceId = trim($body['device_id'] ?? 'counter_01');

            if (empty($clientOpId) || $productId <= 0 || $newExactQty < 0) {
                errorResponse("Valid 'client_op_id', 'product_id', and non-negative 'new_quantity' required.", 422);
            }

            // Retry protection
            $check = $pdo->prepare("SELECT * FROM `stock_movements` WHERE `client_op_id` = :op_id LIMIT 1");
            $check->execute(['op_id' => $clientOpId]);
            $existing = $check->fetch();
            if ($existing) {
                jsonResponse(['success' => true, 'status' => 'duplicate_ignored', 'data' => $existing]);
            }

            $pdo->beginTransaction();

            $prodStmt = $pdo->prepare("SELECT id, stock_qty, name_en FROM `products` WHERE `id` = :id FOR UPDATE");
            $prodStmt->execute(['id' => $productId]);
            $prod = $prodStmt->fetch();
            if (!$prod) {
                $pdo->rollBack();
                errorResponse("Product ID $productId not found.", 404);
            }

            $delta = $newExactQty - (float)$prod['stock_qty'];

            $update = $pdo->prepare("UPDATE `products` SET `stock_qty` = :qty, `version` = `version` + 1 WHERE `id` = :id");
            $update->execute(['qty' => $newExactQty, 'id' => $productId]);

            $mov = $pdo->prepare("INSERT INTO `stock_movements`
                (`client_op_id`, `product_id`, `quantity_delta`, `balance_after`, `reason`, `operation_type`, `device_id`)
                VALUES (:op_id, :prod_id, :delta, :bal, :reason, 'adjustment', :device_id)");
            $mov->execute([
                'op_id' => $clientOpId,
                'prod_id' => $productId,
                'delta' => $delta,
                'bal' => $newExactQty,
                'reason' => $reason,
                'device_id' => $deviceId,
            ]);

            $pdo->commit();

            jsonResponse([
                'success' => true,
                'message' => "Stock adjusted for {$prod['name_en']}",
                'product_id' => $productId,
                'adjusted_stock' => $newExactQty,
                'delta' => $delta,
            ]);
            break;

        // =================================================================
        // 4.5 BILLS: TRANSACTIONAL CREATION WITH STRICT STOCK VALIDATION
        // =================================================================
        case ($resource === 'bills' && $method === 'POST'):
            $clientOpId = trim($body['client_op_id'] ?? '');
            if (empty($clientOpId)) {
                errorResponse("Mandatory stable 'client_op_id' (UUID) required for idempotent bill creation.", 422);
            }

            // 1. Idempotency Check: Return existing bill if already processed
            $check = $pdo->prepare("SELECT * FROM `bills` WHERE `client_op_id` = :op_id LIMIT 1");
            $check->execute(['op_id' => $clientOpId]);
            $existingBill = $check->fetch();
            if ($existingBill) {
                // Fetch line items
                $itemsStmt = $pdo->prepare("SELECT * FROM `bill_items` WHERE `bill_id` = :bid");
                $itemsStmt->execute(['bid' => $existingBill['id']]);
                $existingBill['items'] = $itemsStmt->fetchAll();

                jsonResponse([
                    'success' => true,
                    'status' => 'duplicate_ignored',
                    'message' => 'Bill already recorded previously. Deduplication applied.',
                    'data' => $existingBill,
                ]);
            }

            // 2. Validate Items
            $rawItems = $body['items'] ?? [];
            if (!is_array($rawItems) || empty($rawItems)) {
                errorResponse("Cannot save an empty bill. At least one line item required.", 422);
            }

            $customerName = !empty($body['customer_name']) ? trim($body['customer_name']) : null;
            $customerPhone = !empty($body['customer_phone']) ? trim($body['customer_phone']) : null;
            $paymentMode = in_array($body['payment_mode'] ?? '', ['cash', 'upi', 'credit', 'card']) ? $body['payment_mode'] : 'cash';
            $deviceId = trim($body['device_id'] ?? 'counter_01');
            $clientTime = !empty($body['created_at']) ? $body['created_at'] : date('Y-m-d H:i:s');
            $billNo = trim($body['bill_no'] ?? 'DS-' . date('Ymd') . '-' . substr(strtoupper($clientOpId), 0, 6));

            // START DATABASE TRANSACTION
            $pdo->beginTransaction();

            $verifiedItems = [];
            $computedSubtotal = 0.0;

            // 3. Row-lock products, revalidate stock and recalculate prices
            $lockStmt = $pdo->prepare("SELECT id, name_en, name_hi, unit, price, stock_qty FROM `products` WHERE `id` = :id FOR UPDATE");
            $stockDeductStmt = $pdo->prepare("UPDATE `products` SET `stock_qty` = `stock_qty` - :qty, `version` = `version` + 1 WHERE `id` = :id");
            $stockMovStmt = $pdo->prepare("INSERT INTO `stock_movements`
                (`client_op_id`, `product_id`, `bill_id`, `quantity_delta`, `balance_after`, `reason`, `operation_type`, `device_id`)
                VALUES (:op_id, :prod_id, :bill_id, :delta, :bal, :reason, 'sale', :device_id)");

            foreach ($rawItems as $index => $item) {
                $prodId = !empty($item['product_id']) ? (int)$item['product_id'] : null;
                $reqQty = (float)($item['quantity'] ?? 1.0);
                if ($reqQty <= 0) {
                    $pdo->rollBack();
                    errorResponse("Line item quantity must be greater than zero.", 422);
                }

                if ($prodId !== null) {
                    $lockStmt->execute(['id' => $prodId]);
                    $dbProduct = $lockStmt->fetch();
                    if (!$dbProduct) {
                        $pdo->rollBack();
                        errorResponse("Product ID $prodId no longer exists.", 404);
                    }

                    // Stock check: reject if insufficient stock
                    $currentStock = (float)$dbProduct['stock_qty'];
                    if ($currentStock < $reqQty) {
                        $pdo->rollBack();
                        errorResponse(
                            "Insufficient stock for '{$dbProduct['name_en']}'. Available: {$currentStock} {$dbProduct['unit']}, Requested: {$reqQty}.",
                            409,
                            [
                                'conflict_type' => 'INSUFFICIENT_STOCK',
                                'product_id' => $prodId,
                                'available_stock' => $currentStock,
                                'requested_qty' => $reqQty,
                            ]
                        );
                    }

                    // Authoritative pricing from catalog
                    $unitPrice = (float)$dbProduct['price'];
                    $lineTotal = round($unitPrice * $reqQty, 2);
                    $nameSnapshot = $dbProduct['name_en'];
                    $unit = $dbProduct['unit'];
                } else {
                    // Custom non-catalog item
                    $unitPrice = (float)($item['unit_price'] ?? 0.0);
                    $lineTotal = round($unitPrice * $reqQty, 2);
                    $nameSnapshot = trim($item['item_name'] ?? "Item #" . ($index + 1));
                    $unit = trim($item['unit'] ?? 'pc');
                }

                $computedSubtotal += $lineTotal;

                $verifiedItems[] = [
                    'product_id' => $prodId,
                    'name_snapshot' => $nameSnapshot,
                    'unit' => $unit,
                    'quantity' => $reqQty,
                    'unit_price' => $unitPrice,
                    'total_price' => $lineTotal,
                ];
            }

            // Server-enforced discount and totals
            $discountAmount = max(0.0, (float)($body['discount_amount'] ?? 0.0));
            $taxAmount = 0.0;
            $computedTotal = max(0.0, round($computedSubtotal + $taxAmount - $discountAmount, 2));

            // 4. Insert authoritative Bill record
            $billInsert = $pdo->prepare("INSERT INTO `bills`
                (`shop_id`, `bill_no`, `client_op_id`, `customer_name`, `customer_phone`, `subtotal`, `tax_amount`, `discount_amount`, `total_amount`, `payment_mode`, `payment_status`, `device_id`, `created_at`)
                VALUES (1, :bill_no, :op_id, :cust_name, :cust_phone, :subtotal, :tax, :discount, :total, :pay_mode, 'paid', :device_id, :created_at)");

            $billInsert->execute([
                'bill_no' => $billNo,
                'op_id' => $clientOpId,
                'cust_name' => $customerName,
                'cust_phone' => $customerPhone,
                'subtotal' => $computedSubtotal,
                'tax' => $taxAmount,
                'discount' => $discountAmount,
                'total' => $computedTotal,
                'pay_mode' => $paymentMode,
                'device_id' => $deviceId,
                'created_at' => $clientTime,
            ]);

            $billId = (int)$pdo->lastInsertId();

            // 5. Insert bill items and execute stock movements
            $itemInsert = $pdo->prepare("INSERT INTO `bill_items`
                (`bill_id`, `product_id`, `product_name_snapshot`, `unit`, `quantity`, `unit_price`, `total_price`)
                VALUES (:bill_id, :prod_id, :name, :unit, :qty, :price, :total)");

            foreach ($verifiedItems as $idx => $vItem) {
                $itemInsert->execute([
                    'bill_id' => $billId,
                    'prod_id' => $vItem['product_id'],
                    'name' => $vItem['name_snapshot'],
                    'unit' => $vItem['unit'],
                    'qty' => $vItem['quantity'],
                    'price' => $vItem['unit_price'],
                    'total' => $vItem['total_price'],
                ]);

                // Stock decrement & inventory ledger if catalog product
                if ($vItem['product_id'] !== null) {
                    $stockDeductStmt->execute([
                        'qty' => $vItem['quantity'],
                        'id' => $vItem['product_id'],
                    ]);

                    // Calculate remaining balance
                    $balStmt = $pdo->prepare("SELECT `stock_qty` FROM `products` WHERE `id` = :id");
                    $balStmt->execute(['id' => $vItem['product_id']]);
                    $balAfter = (float)$balStmt->fetchColumn();

                    $itemOpId = $clientOpId . '-item-' . $idx;
                    $stockMovStmt->execute([
                        'op_id' => $itemOpId,
                        'prod_id' => $vItem['product_id'],
                        'bill_id' => $billId,
                        'delta' => -$vItem['quantity'],
                        'bal' => $balAfter,
                        'reason' => "Sale via Bill #$billNo",
                        'device_id' => $deviceId,
                    ]);
                }
            }

            // 6. Log in sync_operations registry
            $syncLog = $pdo->prepare("INSERT INTO `sync_operations`
                (`client_op_id`, `device_id`, `operation_type`, `entity_type`, `entity_id`, `payload_json`, `processing_status`, `response_metadata_json`, `client_timestamp`)
                VALUES (:op_id, :device_id, 'create_bill', 'bill', :bill_id, :payload, 'applied', :meta, :client_time)");

            $metaJson = json_encode(['bill_id' => $billId, 'bill_no' => $billNo, 'total' => $computedTotal]);
            $syncLog->execute([
                'op_id' => $clientOpId,
                'device_id' => $deviceId,
                'bill_id' => $billId,
                'payload' => json_encode($body, JSON_UNESCAPED_UNICODE),
                'meta' => $metaJson,
                'client_time' => $clientTime,
            ]);

            // COMMIT ALL OPERATIONS ATOMICALLY
            $pdo->commit();

            jsonResponse([
                'success' => true,
                'status' => 'applied',
                'bill_id' => $billId,
                'bill_no' => $billNo,
                'client_op_id' => $clientOpId,
                'subtotal' => $computedSubtotal,
                'total_amount' => $computedTotal,
                'synced_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ], 201);
            break;

        // =================================================================
        // 4.6 BILLS: LIST & DETAILS RETRIEVAL
        // =================================================================
        case ($resource === 'bills' && $method === 'GET'):
            // Specific Bill Details: /bills/{id}
            if ($subResource && is_numeric($subResource)) {
                $billStmt = $pdo->prepare("SELECT * FROM `bills` WHERE `id` = :id LIMIT 1");
                $billStmt->execute(['id' => (int)$subResource]);
                $bill = $billStmt->fetch();
                if (!$bill) {
                    errorResponse("Bill ID '$subResource' not found.", 404);
                }

                $itemsStmt = $pdo->prepare("SELECT * FROM `bill_items` WHERE `bill_id` = :bid");
                $itemsStmt->execute(['bid' => $bill['id']]);
                $bill['items'] = $itemsStmt->fetchAll();

                jsonResponse(['success' => true, 'data' => $bill]);
            }

            // Bills List with Filters
            $date = $_GET['date'] ?? null;
            $phone = $_GET['phone'] ?? null;
            $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));

            $sql = "SELECT b.*, COUNT(bi.id) as item_count
                FROM `bills` b
                LEFT JOIN `bill_items` bi ON b.id = bi.bill_id
                WHERE 1=1";
            $params = [];

            if ($date === 'today') {
                $sql .= " AND DATE(b.created_at) = CURDATE()";
            } elseif ($date) {
                $sql .= " AND DATE(b.created_at) = :d";
                $params['d'] = $date;
            }

            if ($phone) {
                $sql .= " AND b.customer_phone LIKE :p";
                $params['p'] = "%$phone%";
            }

            $sql .= " GROUP BY b.id ORDER BY b.created_at DESC LIMIT $limit";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $bills = $stmt->fetchAll();

            jsonResponse(['success' => true, 'count' => count($bills), 'data' => $bills]);
            break;

        // =================================================================
        // 4.7 ANALYTICS: SERVER-CALCULATED AGGREGATIONS
        // =================================================================
        case ($resource === 'analytics' && $method === 'GET'):
            $period = $_GET['period'] ?? 'today';

            $dateClause = "DATE(created_at) = CURDATE()";
            if ($period === 'week') {
                $dateClause = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            } elseif ($period === 'month') {
                $dateClause = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            }

            // Summary aggregates
            $summaryStmt = $pdo->query("SELECT
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COUNT(*) as bill_count,
                COALESCE(AVG(total_amount), 0) as average_bill,
                COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN total_amount ELSE 0 END), 0) as cash_revenue,
                COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN total_amount ELSE 0 END), 0) as upi_revenue,
                COALESCE(SUM(CASE WHEN payment_mode = 'credit' THEN total_amount ELSE 0 END), 0) as credit_revenue
                FROM `bills` WHERE $dateClause");
            $summary = $summaryStmt->fetch();

            // Top selling products in timeframe
            $topItemsStmt = $pdo->query("SELECT
                bi.product_name_snapshot as item_name,
                SUM(bi.quantity) as total_qty,
                SUM(bi.total_price) as total_revenue
                FROM `bill_items` bi
                JOIN `bills` b ON bi.bill_id = b.id
                WHERE b.$dateClause
                GROUP BY bi.product_name_snapshot
                ORDER BY total_qty DESC
                LIMIT 5");
            $topItems = $topItemsStmt->fetchAll();

            jsonResponse([
                'success' => true,
                'period' => $period,
                'summary' => [
                    'total_revenue' => (float)$summary['total_revenue'],
                    'bill_count' => (int)$summary['bill_count'],
                    'average_bill' => round((float)$summary['average_bill'], 2),
                    'cash_revenue' => (float)$summary['cash_revenue'],
                    'upi_revenue' => (float)$summary['upi_revenue'],
                    'credit_revenue' => (float)$summary['credit_revenue'],
                ],
                'top_moving_items' => $topItems,
            ]);
            break;

        // =================================================================
        // 4.8 BATCH SYNC: MULTI-OPERATION OFFLINE FLUSHER
        // =================================================================
        case ($resource === 'sync' && $method === 'POST'):
            $operations = $body['operations'] ?? [];
            if (!is_array($operations)) {
                errorResponse("Expected array 'operations' in payload.", 422);
            }

            $deviceId = trim($body['device_id'] ?? 'unknown_device');
            $results = [];

            foreach ($operations as $op) {
                $opId = $op['client_op_id'] ?? null;
                $entityType = $op['entity_type'] ?? '';
                $opType = $op['operation_type'] ?? '';
                $payload = $op['payload'] ?? [];

                if (!$opId) {
                    $results[] = ['client_op_id' => null, 'status' => 'error', 'message' => 'Missing client_op_id'];
                    continue;
                }

                // Check duplicate
                $check = $pdo->prepare("SELECT * FROM `sync_operations` WHERE `client_op_id` = :op_id LIMIT 1");
                $check->execute(['op_id' => $opId]);
                if ($check->fetch()) {
                    $results[] = ['client_op_id' => $opId, 'status' => 'ignored_duplicate'];
                    continue;
                }

                // Record operation
                $log = $pdo->prepare("INSERT INTO `sync_operations`
                    (`client_op_id`, `device_id`, `operation_type`, `entity_type`, `payload_json`, `processing_status`, `client_timestamp`)
                    VALUES (:op_id, :device_id, :op_type, :entity_type, :payload, 'applied', NOW())");
                $log->execute([
                    'op_id' => $opId,
                    'device_id' => $deviceId,
                    'op_type' => $opType,
                    'entity_type' => $entityType,
                    'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                ]);

                $results[] = ['client_op_id' => $opId, 'status' => 'applied'];
            }

            jsonResponse([
                'success' => true,
                'device_id' => $deviceId,
                'processed' => count($results),
                'results' => $results,
                'server_time' => gmdate('Y-m-d\TH:i:s\Z'),
            ]);
            break;

        // =================================================================
        // 4.9 SHOP SETTINGS
        // =================================================================
        case ($resource === 'settings' && $method === 'GET'):
            $stmt = $pdo->query("SELECT setting_key, setting_value, category FROM `settings` WHERE `shop_id` = 1");
            $rows = $stmt->fetchAll();
            $settingsMap = [];
            foreach ($rows as $row) {
                $settingsMap[$row['setting_key']] = $row['setting_value'];
            }
            jsonResponse(['success' => true, 'data' => $settingsMap]);
            break;

        case ($resource === 'settings' && $method === 'POST'):
            $updates = $body['settings'] ?? [];
            if (!is_array($updates)) {
                errorResponse("Expected 'settings' object in payload.", 422);
            }

            $stmt = $pdo->prepare("INSERT INTO `settings` (`shop_id`, `setting_key`, `setting_value`)
                VALUES (1, :k, :v)
                ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)");

            foreach ($updates as $k => $v) {
                $stmt->execute(['k' => (string)$k, 'v' => (string)$v]);
            }

            jsonResponse(['success' => true, 'message' => 'Settings saved successfully']);
            break;

        default:
            errorResponse("Endpoint '$resource' with method '$method' not found.", 404);
            break;
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    // Return safe message without leaking internal trace
    errorResponse("Server Error: " . $e->getMessage(), 500);
}
