-- DukaanSaathi Kirana Store Schema (Production Edition)
-- Compatible with MySQL 8+ / 9+
-- Character Set: utf8mb4 / utf8mb4_unicode_ci

CREATE DATABASE IF NOT EXISTS `dukaansaathi_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `dukaansaathi_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Shops Master
CREATE TABLE IF NOT EXISTS `shops` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(25) NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `tax_number` VARCHAR(50) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Products Master Catalog
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `shop_id` INT NOT NULL DEFAULT 1,
    `sku_code` VARCHAR(50) UNIQUE NOT NULL,
    `barcode` VARCHAR(64) UNIQUE NULL,
    `name_en` VARCHAR(150) NOT NULL,
    `name_hi` VARCHAR(150) NULL,
    `category` VARCHAR(60) NOT NULL DEFAULT 'Groceries',
    `unit` VARCHAR(20) NOT NULL DEFAULT 'packet', -- packet, pc, kg, g, ltr, ml
    `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `stock_qty` DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    `low_stock_threshold` DECIMAL(10,3) NOT NULL DEFAULT 5.000,
    `lead_time_days` INT NOT NULL DEFAULT 2,
    `safety_stock_qty` DECIMAL(10,3) NOT NULL DEFAULT 2.000,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `version` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_prod_barcode` (`barcode`),
    INDEX `idx_prod_category` (`category`),
    INDEX `idx_prod_name_en` (`name_en`),
    INDEX `idx_prod_updated` (`updated_at`),
    CONSTRAINT `fk_products_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bills (Invoices)
CREATE TABLE IF NOT EXISTS `bills` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `shop_id` INT NOT NULL DEFAULT 1,
    `bill_no` VARCHAR(64) UNIQUE NOT NULL,
    `client_op_id` VARCHAR(64) UNIQUE NOT NULL, -- UUID generated offline for retry protection
    `customer_name` VARCHAR(120) NULL,
    `customer_phone` VARCHAR(25) NULL,
    `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `payment_mode` ENUM('cash', 'upi', 'credit', 'card') NOT NULL DEFAULT 'cash',
    `payment_status` ENUM('paid', 'pending', 'cancelled') NOT NULL DEFAULT 'paid',
    `device_id` VARCHAR(64) NOT NULL DEFAULT 'counter_01',
    `sync_status` ENUM('pending', 'synced', 'conflict') NOT NULL DEFAULT 'synced',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `synced_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_bill_op_id` (`client_op_id`),
    INDEX `idx_bill_created` (`created_at`),
    INDEX `idx_bill_customer` (`customer_phone`),
    CONSTRAINT `fk_bills_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bill Items (Normalized Line Items with Snapshot)
CREATE TABLE IF NOT EXISTS `bill_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `bill_id` INT NOT NULL,
    `product_id` INT NULL,
    `product_name_snapshot` VARCHAR(150) NOT NULL,
    `unit` VARCHAR(20) NOT NULL DEFAULT 'pc',
    `quantity` DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_items_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL,
    INDEX `idx_items_bill` (`bill_id`),
    INDEX `idx_items_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Stock Movements (Authoritative Inventory Ledger)
CREATE TABLE IF NOT EXISTS `stock_movements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_op_id` VARCHAR(64) UNIQUE NOT NULL, -- Deduplication key
    `product_id` INT NOT NULL,
    `bill_id` INT NULL,
    `quantity_delta` DECIMAL(10,3) NOT NULL, -- Negative for sales/damage, positive for receive
    `balance_after` DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    `reason` VARCHAR(255) NOT NULL,
    `operation_type` ENUM('sale', 'purchase_receive', 'adjustment', 'damage', 'return') NOT NULL,
    `device_id` VARCHAR(64) NOT NULL DEFAULT 'counter_01',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_movement_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_movement_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE SET NULL,
    INDEX `idx_mov_prod_created` (`product_id`, `created_at`),
    INDEX `idx_mov_op_id` (`client_op_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Sync Operations Registry (Deduplication & Conflict Resolution Audit)
CREATE TABLE IF NOT EXISTS `sync_operations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_op_id` VARCHAR(64) UNIQUE NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `operation_type` VARCHAR(64) NOT NULL, -- 'create_bill', 'stock_receive', 'stock_adjust', 'product_update'
    `entity_type` VARCHAR(64) NOT NULL, -- 'bill', 'inventory', 'product'
    `entity_id` INT NULL,
    `payload_json` JSON NOT NULL,
    `processing_status` ENUM('applied', 'ignored_duplicate', 'conflict') NOT NULL DEFAULT 'applied',
    `response_metadata_json` JSON NULL,
    `client_timestamp` DATETIME NOT NULL,
    `server_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sync_status` (`processing_status`),
    INDEX `idx_sync_dev_time` (`device_id`, `client_timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Settings (Shop Preferences & System Configuration)
CREATE TABLE IF NOT EXISTS `settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `shop_id` INT NOT NULL DEFAULT 1,
    `setting_key` VARCHAR(64) UNIQUE NOT NULL,
    `setting_value` TEXT NOT NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'general',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_settings_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Device Peers (Multi-Counter & Tablet Pairing)
CREATE TABLE IF NOT EXISTS `devices` (
    `device_id` VARCHAR(64) PRIMARY KEY,
    `shop_id` INT NOT NULL DEFAULT 1,
    `device_name` VARCHAR(100) NOT NULL,
    `device_role` ENUM('primary', 'counter_2', 'godown') NOT NULL DEFAULT 'counter_2',
    `ip_address` VARCHAR(45) NULL,
    `last_sync_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_devices_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
