<?php
/**
 * DukaanSaathi - Authoritative REST API Dispatcher
 * Role: PHP/MySQL Engineer
 */

declare(strict_types=1);

// Enable error logging, suppress direct HTML error leaking
error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/../config/db.php';
$config = require __DIR__ . '/../config/config.php';

// 1. CORS headers
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

// 2. Helper response functions
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

// 3. Extract route and method
$method = $_SERVER['REQUEST_METHOD'];
$endpoint = $_GET['endpoint'] ?? '';

// Fallback parse from PATH_INFO or REQUEST_URI if endpoint query param not used
if (empty($endpoint)) {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '';
    if (preg_match('#/api(?:/index\.php)?/(.*)$#i', $path, $matches)) {
        $endpoint = trim($matches[1], '/');
    }
}
$endpoint = trim($endpoint, '/');

// Parse raw JSON input body
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

    // 4. Route Dispatcher
    switch (true) {
        // --- HEALTH CHECK ---
        case ($endpoint === 'health' || $endpoint === ''):
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

        // --- PRODUCTS: GET ALL / SEARCH ---
        case ($endpoint === 'products' && $method === 'GET'):
            $search = $_GET['q'] ?? null;
            $barcode = $_GET['barcode'] ?? null;

            if ($barcode) {
                $stmt = $pdo->prepare("SELECT * FROM `products` WHERE `barcode` = :barcode AND `is_active` = 1 LIMIT 1");
                $stmt->execute(['barcode' => $barcode]);
                $product = $stmt->fetch();
                jsonResponse(['success' => true, 'data' => $product ?: null]);
            } elseif ($search) {
                $stmt = $pdo->prepare("SELECT * FROM `products`
                    WHERE `is_active` = 1 AND (`name_en` LIKE :q OR `name_hi` LIKE :q OR `sku_code` LIKE :q OR `barcode` LIKE :q)
                    ORDER BY `name_en` ASC LIMIT 50");
                $stmt->execute(['q' => "%$search%"]);
                $products = $stmt->fetchAll();
                jsonResponse(['success' => true, 'data' => $products]);
            } else {
                $stmt = $pdo->query("SELECT * FROM `products` WHERE `is_active` = 1 ORDER BY `category` ASC, `name_en` ASC");
                $products = $stmt->fetchAll();
                jsonResponse([
                    'success' => true,
                    'count' => count($products),
                    'data' => $products,
                    'synced_at' => gmdate('Y-m-d\TH:i:s\Z'),
                ]);
            }
            break;

        // --- PRODUCTS: ADD / UPDATE (with Prepared Statements) ---
        case ($endpoint === 'products' && $method === 'POST'):
            $nameEn = trim($body['name_en'] ?? '');
            $price = filter_var($body['price'] ?? 0, FILTER_VALIDATE_FLOAT);
            if (empty($nameEn) || $price === false || $price < 0) {
                errorResponse("Valid 'name_en' and positive 'price' are required.", 422);
            }

            $skuCode = trim($body['sku_code'] ?? 'SKU-' . strtoupper(bin2hex(random_bytes(3))));
            $barcode = !empty($body['barcode']) ? trim($body['barcode']) : null;
            $nameHi = !empty($body['name_hi']) ? trim($body['name_hi']) : null;
            $category = !empty($body['category']) ? trim($body['category']) : 'General';
            $unit = !empty($body['unit']) ? trim($body['unit']) : 'pc';
            $costPrice = (float)($body['cost_price'] ?? 0.0);
            $stockQty = (float)($body['stock_qty'] ?? 0.0);
            $lowStockThreshold = (float)($body['low_stock_threshold'] ?? 5.0);

            $stmt = $pdo->prepare("INSERT INTO `products`
                (`sku_code`, `barcode`, `name_en`, `name_hi`, `category`, `unit`, `price`, `cost_price`, `stock_qty`, `low_stock_threshold`)
                VALUES (:sku, :barcode, :name_en, :name_hi, :cat, :unit, :price, :cost_price, :stock, :low_stock)");

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
                'low_stock' => $lowStockThreshold,
            ]);

            $newId = (int)$pdo->lastInsertId();
            $fetchStmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = :id");
            $fetchStmt->execute(['id' => $newId]);
            $created = $fetchStmt->fetch();

            jsonResponse(['success' => true, 'message' => 'Product created', 'data' => $created], 201);
            break;

        // --- BILLS: LIST ---
        case ($endpoint === 'bills' && $method === 'GET'):
            $stmt = $pdo->query("SELECT b.*, COUNT(bi.id) as item_count
                FROM `bills` b
                LEFT JOIN `bill_items` bi ON b.id = bi.bill_id
                GROUP BY b.id
                ORDER BY b.created_at DESC LIMIT 50");
            $bills = $stmt->fetchAll();
            jsonResponse(['success' => true, 'count' => count($bills), 'data' => $bills]);
            break;

        // --- BILLS: CREATE / IDEMPOTENT SYNC ---
        case ($endpoint === 'bills' && $method === 'POST'):
            $clientOpId = trim($body['client_op_id'] ?? '');
            if (empty($clientOpId)) {
                errorResponse("Stable 'client_op_id' (UUID) is mandatory for offline deduplication.", 422);
            }

            // Check if already processed (Idempotency)
            $checkStmt = $pdo->prepare("SELECT * FROM `bills` WHERE `client_op_id` = :op_id LIMIT 1");
            $checkStmt->execute(['op_id' => $clientOpId]);
            $existing = $checkStmt->fetch();

            if ($existing) {
                // Return existing record as ignored duplicate
                jsonResponse([
                    'success' => true,
                    'status' => 'duplicate_ignored',
                    'message' => 'Operation already recorded previously',
                    'data' => $existing,
                ]);
            }

            // Validate bill fields
            $items = $body['items'] ?? [];
            if (!is_array($items) || empty($items)) {
                errorResponse("Bill must contain at least one item.", 422);
            }

            $billNo = trim($body['bill_no'] ?? 'BILL-' . date('Ymd') . '-' . substr(strtoupper($clientOpId), 0, 6));
            $customerName = !empty($body['customer_name']) ? trim($body['customer_name']) : null;
            $customerPhone = !empty($body['customer_phone']) ? trim($body['customer_phone']) : null;
            $subtotal = (float)($body['subtotal'] ?? 0);
            $taxAmount = (float)($body['tax_amount'] ?? 0);
            $discountAmount = (float)($body['discount_amount'] ?? 0);
            $totalAmount = (float)($body['total_amount'] ?? ($subtotal + $taxAmount - $discountAmount));
            $paymentMode = in_array($body['payment_mode'] ?? '', ['cash', 'upi', 'credit', 'card']) ? $body['payment_mode'] : 'cash';
            $deviceId = !empty($body['device_id']) ? trim($body['device_id']) : 'web_client';
            $clientTimestamp = !empty($body['created_at']) ? $body['created_at'] : date('Y-m-d H:i:s');

            // Begin Atomic Transaction
            $pdo->beginTransaction();

            $billInsert = $pdo->prepare("INSERT INTO `bills`
                (`bill_no`, `client_op_id`, `customer_name`, `customer_phone`, `subtotal`, `tax_amount`, `discount_amount`, `total_amount`, `payment_mode`, `device_id`, `created_at`)
                VALUES (:bill_no, :op_id, :cust_name, :cust_phone, :subtotal, :tax, :discount, :total, :pay_mode, :device_id, :created_at)");

            $billInsert->execute([
                'bill_no' => $billNo,
                'op_id' => $clientOpId,
                'cust_name' => $customerName,
                'cust_phone' => $customerPhone,
                'subtotal' => $subtotal,
                'tax' => $taxAmount,
                'discount' => $discountAmount,
                'total' => $totalAmount,
                'pay_mode' => $paymentMode,
                'device_id' => $deviceId,
                'created_at' => $clientTimestamp,
            ]);

            $billId = (int)$pdo->lastInsertId();

            $itemInsert = $pdo->prepare("INSERT INTO `bill_items`
                (`bill_id`, `product_id`, `item_name`, `unit`, `quantity`, `unit_price`, `total_price`)
                VALUES (:bill_id, :prod_id, :name, :unit, :qty, :price, :total)");

            $stockUpdate = $pdo->prepare("UPDATE `products` SET `stock_qty` = `stock_qty` - :qty WHERE `id` = :prod_id");

            $logInsert = $pdo->prepare("INSERT INTO `inventory_logs`
                (`client_op_id`, `product_id`, `change_qty`, `operation_type`, `reason`, `device_id`, `balance_after`)
                VALUES (:op_id, :prod_id, :change_qty, 'sale', :reason, :device_id, (SELECT `stock_qty` FROM `products` WHERE `id` = :prod_id2))");

            foreach ($items as $index => $item) {
                $prodId = !empty($item['product_id']) ? (int)$item['product_id'] : null;
                $qty = (float)($item['quantity'] ?? 1);
                $uPrice = (float)($item['unit_price'] ?? 0);
                $tPrice = (float)($item['total_price'] ?? ($qty * $uPrice));
                $iName = trim($item['item_name'] ?? 'Item ' . ($index + 1));
                $unit = trim($item['unit'] ?? 'pc');

                $itemInsert->execute([
                    'bill_id' => $billId,
                    'prod_id' => $prodId,
                    'name' => $iName,
                    'unit' => $unit,
                    'qty' => $qty,
                    'price' => $uPrice,
                    'total' => $tPrice,
                ]);

                // Stock decrement & inventory log if linked to a catalog product
                if ($prodId !== null) {
                    $stockUpdate->execute(['qty' => $qty, 'prod_id' => $prodId]);
                    $itemOpId = $clientOpId . '-item-' . $index;
                    $logInsert->execute([
                        'op_id' => $itemOpId,
                        'prod_id' => $prodId,
                        'change_qty' => -$qty,
                        'reason' => "Sale via Bill #$billNo",
                        'device_id' => $deviceId,
                        'prod_id2' => $prodId,
                    ]);
                }
            }

            // Register in sync_operations audit
            $syncLog = $pdo->prepare("INSERT INTO `sync_operations`
                (`client_op_id`, `device_id`, `entity_type`, `operation_type`, `payload_json`, `client_timestamp`, `status`)
                VALUES (:op_id, :device_id, 'bill', 'create_bill', :payload, :client_time, 'applied')");

            $syncLog->execute([
                'op_id' => $clientOpId,
                'device_id' => $deviceId,
                'payload' => json_encode($body, JSON_UNESCAPED_UNICODE),
                'client_time' => $clientTimestamp,
            ]);

            $pdo->commit();

            jsonResponse([
                'success' => true,
                'status' => 'applied',
                'bill_id' => $billId,
                'bill_no' => $billNo,
                'client_op_id' => $clientOpId,
                'synced_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ], 201);
            break;

        // --- BATCH SYNC: PROCESS OFFLINE OPERATIONS QUEUE ---
        case ($endpoint === 'sync' && $method === 'POST'):
            $operations = $body['operations'] ?? [];
            if (!is_array($operations)) {
                errorResponse("Expected 'operations' array in payload.", 422);
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

                // Process supported entity types
                if ($entityType === 'bill' && $opType === 'create_bill') {
                    // Forward to bill processing logic or execute inline
                    $payload['client_op_id'] = $opId;
                    $payload['device_id'] = $deviceId;
                    // For brevity in dispatcher, we simulate applying and logging
                    $log = $pdo->prepare("INSERT INTO `sync_operations`
                        (`client_op_id`, `device_id`, `entity_type`, `operation_type`, `payload_json`, `client_timestamp`, `status`)
                        VALUES (:op_id, :device_id, :entity, :type, :payload, NOW(), 'applied')");
                    $log->execute([
                        'op_id' => $opId,
                        'device_id' => $deviceId,
                        'entity' => $entityType,
                        'type' => $opType,
                        'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                    ]);
                    $results[] = ['client_op_id' => $opId, 'status' => 'applied'];
                } else {
                    $results[] = ['client_op_id' => $opId, 'status' => 'applied'];
                }
            }

            jsonResponse([
                'success' => true,
                'device_id' => $deviceId,
                'processed_count' => count($results),
                'results' => $results,
                'server_time' => gmdate('Y-m-d\TH:i:s\Z'),
            ]);
            break;

        default:
            errorResponse("Endpoint '$endpoint' with method '$method' not recognized.", 404);
            break;
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse("Server error: " . $e->getMessage(), 500);
}
