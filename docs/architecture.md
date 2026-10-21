# DukaanSaathi — Architecture & System Foundation

## 1. System Overview & Philosophy

**DukaanSaathi** is a resilient, offline-first Point of Sale (POS) and inventory platform engineered specifically for Indian Kirana store ergonomics. It combines the responsiveness and offline independence of modern client-side storage (IndexedDB + PWA) with the authoritative persistence of a local relational database (PHP 8+ and MySQL).

### High-Level Topology

```
+-------------------------------------------------------------+
|             Client Application (React + Vite + PWA)         |
|                                                             |
|  +--------------------+        +-------------------------+  |
|  | Kirana Touch UI    | <----> | IndexedDB Local Cache   |  |
|  | - Bilingual (EN/HI)|        | - Products Catalog      |  |
|  | - Live Bill Review |        | - Local Bills           |  |
|  | - Voice/Barcode    |        | - Pending Op Queue      |  |
|  +--------------------+        +-------------------------+  |
+---------------------------------------------|---------------+
                                              |
                             REST Sync (when online)
                             Idempotent client_op_id
                                              |
                                              v
+-------------------------------------------------------------+
|               Authoritative Backend Tier (PHP 8.2+)         |
|                                                             |
|  +-------------------------------------------------------+  |
|  | backend/api/index.php (REST Router + CORS + Auth)     |  |
|  +-------------------------------------------------------+  |
|  | backend/config/db.php (PDO Prepared Statements)       |  |
|  +-------------------------------------------------------+  |
+---------------------------------------------|---------------+
                                              |
                                              v
+-------------------------------------------------------------+
|               Authoritative Database Tier (MySQL 9.1+)       |
|                                                             |
|  - products (Master catalog & real-time stock levels)       |
|  - bills (Authoritative finalized receipts)                 |
|  - bill_items (Normalized line items)                       |
|  - inventory_logs (Audit trail of every stock modification) |
|  - sync_operations (Deduplication registry & conflict log)  |
|  - devices (Counter pairing & peer-to-peer tracking)        |
+-------------------------------------------------------------+
```

---

## 2. Synchronization & Conflict Handling Protocol

### A. Idempotent Operation Delivery
Every mutation generated on a client device is assigned a cryptographically random `client_op_id` (UUIDv4) and client timestamp before persistence.
- When an operation is sent to the PHP API (`POST /api/bills` or `POST /api/sync`), the server checks `sync_operations` and `bills.client_op_id`.
- If `client_op_id` exists: The server immediately returns HTTP 200 with `status: "duplicate_ignored"` and returns the previously saved record.
- **Stock Guard**: Stock decrement statements are only executed if the operation has not been previously processed. This guarantees zero duplicate deductions during network retries.

### B. Conflict Resolution Strategy
1. **Bills (Sales Operations)**: Append-only. Bills never overwrite each other. Each sale is a discrete financial transaction.
2. **Concurrent Offline Over-selling**: If two offline counter phones sell the same unit of stock simultaneously, upon reconnect both sales are recorded in `bills`. The inventory log reflects the actual physical distribution, allowing provisional negative stock balance with a flagged status in `sync_operations.conflict_details`. An alert is raised on the shopkeeper's dashboard for physical stock verification, avoiding disruptive customer transaction rollbacks at checkout.
3. **Product Master & Price Updates**: Last-Write-Wins (LWW) anchored to authoritative server timestamp (`updated_at`) and incrementing record `version`.
4. **Provisional Stock Decrement**: The client immediately applies provisional stock deductions in local IndexedDB so the shopkeeper sees accurate remaining inventory while offline. Once synced, server stock becomes the canonical truth.

---

## 3. Authoritative Data Contracts

### 3.1. Products Schema & Contract
```json
{
  "id": 1,
  "sku_code": "SKU-001",
  "barcode": "8901030383701",
  "name_en": "Tata Salt 1kg",
  "name_hi": "टाटा नमक १ किलो",
  "category": "Groceries",
  "unit": "packet",
  "price": "28.00",
  "cost_price": "24.50",
  "stock_qty": "45.00",
  "low_stock_threshold": "10.00",
  "is_active": 1,
  "version": 1,
  "updated_at": "2026-10-21 11:21:50"
}
```

### 3.2. Bill Creation Request Contract (`POST /api/bills`)
```json
{
  "client_op_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "bill_no": "DS-20261021-001",
  "customer_name": "Ramesh Kumar",
  "customer_phone": "9876543210",
  "subtotal": 287.00,
  "tax_amount": 0.00,
  "discount_amount": 7.00,
  "total_amount": 280.00,
  "payment_mode": "cash",
  "device_id": "counter_01",
  "created_at": "2026-10-21 11:25:00",
  "items": [
    {
      "product_id": 1,
      "item_name": "Tata Salt 1kg",
      "unit": "packet",
      "quantity": 1.0,
      "unit_price": 28.00,
      "total_price": 28.00
    }
  ]
}
```

### 3.3. Bill Creation Response Contract
```json
{
  "success": true,
  "status": "applied",
  "bill_id": 1,
  "bill_no": "DS-20261021-001",
  "client_op_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "synced_at": "2026-10-21T05:55:21Z"
}
```
*(If retried, returns `status: "duplicate_ignored"`)*

---

## 4. Agent Roles & File Ownership Matrix

To avoid file contention and ensure clean separation of concerns, file ownership is allocated as follows:

| Agent Role | Primary Focus | Explicit File Ownership |
| :--- | :--- | :--- |
| **Lead Architect** | System contracts, task coordination, acceptance criteria | `docs/architecture.md`, `frontend/src/types/models.ts` |
| **PHP/MySQL Engineer** | Database schema, PDO queries, transactions, REST API | `backend/config/*`, `backend/database/*`, `backend/api/*` |
| **Offline Engineer** | IndexedDB store, pending sync queue, PWA service worker | `frontend/src/services/offlineDb.ts`, `frontend/public/sw.js`, `frontend/public/manifest.json` |
| **UI/UX Engineer** | 12 reference screens, responsive layout, Tailwind styles | `frontend/src/App.tsx`, `frontend/src/components/*`, `frontend/src/index.css`, `frontend/tailwind.config.js` |
| **Voice/Barcode Engineer** | Web Speech API, barcode scanner & manual fallbacks | `frontend/src/services/voiceInput.ts`, `frontend/src/services/barcodeScanner.ts` |
| **QA Engineer** | Automated test scripts, offline simulation, API validation | `scratch/*`, `tests/*`, end-to-end verification |

---

## 5. Task Checklist for Subsequent Phases

- [x] **Phase 1: Foundation & Lead Architecture**
  - [x] Environment discovery: PHP 8.2.26, MySQL 9.1.0, Node.js 24.
  - [x] Database migration & initial Kirana products catalog seeded.
  - [x] PHP PDO connection layer with prepared statements.
  - [x] REST API entry point with health, products, idempotent bill creation, and sync endpoints.
  - [x] IndexedDB offline persistence for products, local bills, and pending operations queue.
  - [x] React 19 + TypeScript + Vite + Tailwind CSS app shell with all 12 screen state views.
  - [x] PWA manifest & service worker offline cache.
  - [x] Deduplication and build verification tested and verified.

- [ ] **Phase 2: Enhanced UI & 12 Complete Screens**
  - [ ] Implement full visual design reproducing all 4 reference UI flows.
  - [ ] Web Speech API voice parser for bilingual item entry (e.g. "एक किलो चीनी").
  - [ ] Camera barcode scanner component using ZXing/Quagga with continuous scan mode.
  - [ ] Add/Edit product modal with category selector and image/icon picker.
  - [ ] Inventory restock batch modal (+5, +10, supplier invoice entry).
  - [ ] WhatsApp receipt link generation with formatted markdown receipt text.

- [ ] **Phase 3: Multi-Device Sync & Resilient Networking**
  - [ ] QR-code counter pairing for secondary phone / godown tablet.
  - [ ] Background sync worker polling when browser detects `navigator.onLine`.
  - [ ] Comprehensive conflict dashboard and stock adjustment ledger.
