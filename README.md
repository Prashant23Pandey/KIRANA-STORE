# DukaanSaathi — Kirana Store Operating System
## Backend Architecture: PHP 8+ & MySQL PDO

Authoritative relational database and REST API implementation engineered for DukaanSaathi's local-first Kirana POS system.

---

## 1. Technology Restrictions & Compliance

- **Runtime**: PHP 8.2+ (strict types `declare(strict_types=1);`, clean JSON handling).
- **Database Engine**: MySQL 9.1.0 / 8.0+ / MariaDB with InnoDB engine and `utf8mb4_unicode_ci`.
- **Database Layer**: Native PDO with prepared statements, unbuffered emulation disabled (`PDO::ATTR_EMULATE_PREPARES => false`), and strict exception mode (`PDO::ERRMODE_EXCEPTION`).
- **Data Exchange**: Pure JSON request and response payloads, standardized HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `409 Conflict`, `422 Unprocessable`, `500 Server Error`).
- **No Node.js backend, Firebase, Supabase, or mock layers** — 100% authoritative local PHP & MySQL.

---

## 2. Directory Layout

```text
KIRANA PROBLEM/
├── backend/
│   ├── api/
│   │   └── index.php             # Unified REST router & transaction controller
│   ├── config/
│   │   ├── config.example.php    # Placeholder template for local environments
│   │   ├── config.php            # Active environment config (credentials, CORS)
│   │   └── db.php                # Authoritative PDO connection singleton & health ping
│   └── database/
│       ├── schema.sql            # Version-controlled DDL with indexes and foreign keys
│       └── migrate.php           # Idempotent database creation and seeding utility
├── frontend/                     # React + TypeScript offline-first POS client
└── README.md                     # System documentation & API contract
```

---

## 3. Database Schema (`backend/database/schema.sql`)

### 3.1 Relational Tables

1. **`shops`**:
   - Multi-tenant base (`id`, `name`, `address`, `phone`, `currency`, `tax_number`, timestamps).
2. **`products`**:
   - Master catalog (`id`, `shop_id`, `sku_code` UNIQUE, `barcode` UNIQUE, `name_en`, `name_hi`, `category`, `unit`, `price` DECIMAL(10,2), `cost_price` DECIMAL(10,2), `stock_qty` DECIMAL(10,3), `low_stock_threshold` DECIMAL(10,3), `lead_time_days` INT, `safety_stock_qty` DECIMAL(10,3), `is_active`, `version` INT, timestamps).
   - Indexes: `idx_prod_barcode`, `idx_prod_category`, `idx_prod_name_en`, `idx_prod_updated`.
3. **`bills`**:
   - Invoices (`id`, `shop_id`, `bill_no` UNIQUE, `client_op_id` UNIQUE UUID, `customer_name`, `customer_phone`, `subtotal`, `tax_amount`, `discount_amount`, `total_amount`, `payment_mode`, `payment_status`, `device_id`, `sync_status`, `created_at`, `synced_at`).
   - Indexes: `idx_bill_op_id`, `idx_bill_created`, `idx_bill_customer`.
4. **`bill_items`**:
   - Normalized line items (`id`, `bill_id`, `product_id`, `product_name_snapshot`, `unit`, `quantity` DECIMAL(10,3), `unit_price` DECIMAL(10,2), `total_price` DECIMAL(10,2), `created_at`).
   - Foreign keys: Cascade delete on bill removal; SET NULL on product deletion.
5. **`stock_movements`**:
   - Authoritative audit ledger (`id`, `client_op_id` UNIQUE, `product_id`, `bill_id`, `quantity_delta` DECIMAL(10,3), `balance_after` DECIMAL(10,3), `reason`, `operation_type`, `device_id`, `created_at`).
6. **`sync_operations`**:
   - Offline deduplication & audit trail (`id`, `client_op_id` UNIQUE, `device_id`, `operation_type`, `entity_type`, `entity_id`, `payload_json`, `processing_status` [applied, ignored_duplicate, conflict], `response_metadata_json`, `client_timestamp`, `server_timestamp`).
7. **`settings`**:
   - Shop configuration (`id`, `shop_id`, `setting_key` UNIQUE, `setting_value`, `category`, `updated_at`).
8. **`devices`**:
   - Peer counter & godown tablet registry (`device_id`, `shop_id`, `device_name`, `device_role`, `ip_address`, `last_sync_at`).

---

## 4. API Specification & Endpoints

All endpoints support versioned routes (`/v1/...` and `?endpoint=v1/...`) and unversioned routes.

### 4.1 Health Check
- **`GET /v1/health`**
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "api_version": "v1",
      "app": "DukaanSaathi Kirana System",
      "version": "1.0.0-phase1",
      "php_version": "8.2.26",
      "database": {
        "status": "connected",
        "server_version": "9.1.0",
        "current_db": "dukaansaathi_db",
        "server_time": "2026-10-21 13:48:19"
      },
      "server_time": "2026-10-21T08:18:19Z"
    }
    ```

### 4.2 Products Catalog
- **`GET /v1/products`**
  - Query params: `q` (search name, sku, barcode), `category` (filter category).
- **`GET /v1/products/{id}`**
  - Retrieves full details for a single product ID.
- **`GET /v1/barcode/{barcode}`** or **`GET /v1/products/barcode/{barcode}`**
  - Rapid barcode scan lookup. Returns `200` with product or `404` if not found.
- **`POST /v1/products`**
  - Create new product in catalog.
- **`PUT /v1/products/{id}`**
  - Update product attributes, price, thresholds, and triggers optimistic version increment (`version = version + 1`).

### 4.3 Stock Management
- **`POST /v1/stock/receive`**
  - Purchase inward reception.
  - Body:
    ```json
    {
      "client_op_id": "op-rec-12345",
      "product_id": 13,
      "quantity": 10.0,
      "reason": "Distributor Inward",
      "device_id": "counter_01"
    }
    ```
  - Increments `stock_qty`, records `stock_movements` ledger atomically, enforces idempotent retry protection.
- **`POST /v1/stock/adjust`**
  - Physical audit adjustment.
  - Body:
    ```json
    {
      "client_op_id": "op-adj-12345",
      "product_id": 13,
      "new_quantity": 35.0,
      "reason": "Physical Count Audit",
      "device_id": "counter_01"
    }
    ```

### 4.4 Invoicing & Transactional Bill Creation
- **`POST /v1/bills`**
  - Body:
    ```json
    {
      "client_op_id": "op-bill-78901",
      "bill_no": "DS-20261021-0001",
      "customer_name": "Ramesh Sharma",
      "customer_phone": "9876500001",
      "payment_mode": "cash",
      "discount_amount": 0.0,
      "device_id": "counter_01",
      "items": [
        { "product_id": 1, "quantity": 2.0 },
        { "product_id": 5, "quantity": 1.0 }
      ]
    }
    ```
  - **Transaction Workflow**:
    1. Idempotency Check: Returns existing bill if `client_op_id` already registered (`duplicate_ignored`).
    2. Aggregates requested quantities per product to prevent intra-bill race conditions.
    3. Acquires row-level exclusive locks: `SELECT ... FOR UPDATE`.
    4. Validates real-time availability: If any item exceeds available stock, aborts with **`409 Conflict`** and rolls back immediately without writing partial data.
    5. Recalculates authoritative totals from catalog prices (never trusts browser-provided math).
    6. Writes `bills`, normalized `bill_items`, decrements `products.stock_qty`, and logs `stock_movements` atomically.
    7. Commits database transaction.
- **`GET /v1/bills`**
  - Filter invoices by `date` (`today` or `YYYY-MM-DD`), `phone`, `limit`, `offset`.
- **`GET /v1/bills/{id}`**
  - Retrieves bill and its line items.

### 4.5 Analytics
- **`GET /v1/analytics?period=today|week|month|all`**
  - Server-calculated aggregations:
    - `total_revenue`, `bill_count`, `average_bill`
    - `cash_revenue`, `upi_revenue`, `credit_revenue`, `card_revenue`
    - `top_moving_items` (top 5 products by quantity and revenue)

### 4.6 Batch Offline Synchronization
- **`POST /v1/sync`**
  - Batched flush of offline operations from counter terminals or godown tablets.
  - Automatically identifies duplicates (`ignored_duplicate`), applies valid bills and stock adjustments, and returns actionable conflict errors (`conflict` with `INSUFFICIENT_STOCK`) without aborting non-conflicting peer operations.

### 4.7 Shop Settings
- **`GET /v1/settings`**
  - Retrieves all shop preferences as key-value map.
- **`POST /v1/settings`**
  - Updates configuration keys with `ON DUPLICATE KEY UPDATE`.

---

## 5. Security & Invariant Guarantees

1. **Prepared Statements Exclusively**: Every single query uses PDO parameter binding (`:param`). No raw SQL interpolation.
2. **Safe Error Masking**: `display_errors` is turned off. Caught exceptions roll back active transactions and return sanitized JSON error messages without exposing credentials or internal file paths.
3. **CORS Governance**: Configured development origins (`localhost:5173`, `localhost:5174`, `127.0.0.1:8000`, etc.) are allowed explicitly.
4. **Idempotency & Retry Protection**: Stable `client_op_id` constraints on `bills`, `stock_movements`, and `sync_operations` guarantee that multiple sync clicks or replayed network packets never cause double-decrements or duplicate bills.

---

## 6. Setup & Verification

### 6.1 Database Migration & Seeding
From PowerShell / Command Prompt:
```powershell
# Run automated migration against local MySQL:
& "C:\wamp64\bin\php\php8.2.26\php.exe" "backend\database\migrate.php"
```
Output:
```json
{
    "status": "success",
    "database": "dukaansaathi_db",
    "tables_created": [
        "bill_items",
        "bills",
        "devices",
        "products",
        "settings",
        "shops",
        "stock_movements",
        "sync_operations"
    ],
    "initial_products_seeded": 12,
    "total_products": 12
}
```

### 6.2 Running Local PHP Server
```powershell
& "C:\wamp64\bin\php\php8.2.26\php.exe" -S 127.0.0.1:8000 -t .
```

---

## 7. Automated Test Results (Executed Against Live MySQL 9.1.0)

| Test ID | Endpoint & Method | Purpose | Result |
|---|---|---|---|
| **T01** | `GET /v1/health` | PHP 8 & MySQL 9.1.0 live connection verification | **PASSED** (200 OK, `server_version: 9.1.0`) |
| **T02** | `GET /v1/products?q=Tata` | Catalog search with native prepared statement | **PASSED** (200 OK, 2 matching items found) |
| **T03** | `GET /v1/barcode/8901030383701` | Direct barcode lookup | **PASSED** (200 OK, Tata Salt 1kg returned) |
| **T04** | `GET /v1/products/1` | Single product detail by ID | **PASSED** (200 OK) |
| **T05** | `POST /v1/products` | Create product (Haldiram Bhujia) | **PASSED** (201 Created, ID 13 assigned) |
| **T06** | `PUT /v1/products/13` | Update price and increment version | **PASSED** (200 OK, price 58.00, version 2) |
| **T07** | `POST /v1/stock/receive` | Inward receipt of 10 units | **PASSED** (200 OK, stock 30 -> 40) |
| **T08** | `POST /v1/stock/receive` | Idempotent duplicate check (`op-rec-001`) | **PASSED** (`duplicate_ignored`, stock stayed 40) |
| **T09** | `POST /v1/stock/adjust` | Physical count adjustment to 35 units | **PASSED** (200 OK, delta: -5, stock: 35) |
| **T10** | `POST /v1/bills` | Transactional bill creation for 2 units | **PASSED** (201 Created, stock 35 -> 33) |
| **T11** | `POST /v1/bills` | Deduplication retry test (`op-bill-001`) | **PASSED** (`duplicate_ignored`, no double-decrement, stock remained 33) |
| **T12** | `POST /v1/bills` | Insufficient stock transaction rollback (req 100 units) | **PASSED** (409 Conflict, `INSUFFICIENT_STOCK`, transaction rolled back 100%) |
| **T13** | `GET /v1/bills/1` | In-depth bill and line items retrieval | **PASSED** (200 OK, items snapshot returned) |
| **T14** | `GET /v1/analytics?period=all` | Aggregated revenue and top selling items | **PASSED** (200 OK, calculated total revenue and cash split) |
| **T15** | `GET & POST /v1/settings` | Retrieve and update shop preferences | **PASSED** (200 OK, settings saved and retrieved) |
| **T16** | `POST /v1/sync` | Multi-op batch sync with concurrent conflict & duplicate | **PASSED** (200 OK, applied valid bill/stock, isolated conflict, ignored duplicate) |
