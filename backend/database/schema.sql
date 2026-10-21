-- DukaanSaathi Kirana Store Schema
-- Target: MySQL 8+ / 9+
-- Character set: utf8mb4

CREATE DATABASE IF NOT EXISTS `dukaansaathi_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `dukaansaathi_db`;

-- 1. Products Master Catalog
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sku_code` VARCHAR(50) UNIQUE NOT NULL,
    `barcode` VARCHAR(64) UNIQUE NULL,
    `name_en` VARCHAR(150) NOT NULL,
    `name_hi` VARCHAR(150) NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'General',
    `unit` VARCHAR(20) NOT NULL DEFAULT 'pc', -- pc, kg, g, ltr, ml, packet
    `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `stock_qty` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `low_stock_threshold` DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `version` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_barcode` (`barcode`),
    INDEX `idx_category` (`category`),
    INDEX `idx_name_en` (`name_en`),
    INDEX `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bills Table (with client_op_id for offline deduplication)
CREATE TABLE IF NOT EXISTS `bills` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `bill_no` VARCHAR(50) UNIQUE NOT NULL,
    `client_op_id` VARCHAR(64) UNIQUE NOT NULL, -- UUID generated offline
    `customer_name` VARCHAR(100) NULL,
    `customer_phone` VARCHAR(20) NULL,
    `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `payment_mode` ENUM('cash', 'upi', 'credit', 'card') NOT NULL DEFAULT 'cash',
    `payment_status` ENUM('paid', 'pending', 'cancelled') NOT NULL DEFAULT 'paid',
    `device_id` VARCHAR(64) NOT NULL DEFAULT 'main_pos',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `synced_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_client_op_id` (`client_op_id`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_customer_phone` (`customer_phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bill Items Table
CREATE TABLE IF NOT EXISTS `bill_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `bill_id` INT NOT NULL,
    `product_id` INT NULL,
    `item_name` VARCHAR(150) NOT NULL,
    `unit` VARCHAR(20) NOT NULL DEFAULT 'pc',
    `quantity` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_bill_items_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bill_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL,
    INDEX `idx_bill_id` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Inventory Logs (Idempotent stock audits)
CREATE TABLE IF NOT EXISTS `inventory_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_op_id` VARCHAR(64) UNIQUE NOT NULL,
    `product_id` INT NOT NULL,
    `change_qty` DECIMAL(10,2) NOT NULL, -- negative for sales, positive for restock
    `operation_type` ENUM('sale', 'restock', 'damage', 'return', 'adjustment') NOT NULL,
    `reason` VARCHAR(255) NULL,
    `device_id` VARCHAR(64) NOT NULL DEFAULT 'main_pos',
    `balance_after` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    INDEX `idx_product_created` (`product_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Sync Operations Registry (Deduplication & Conflict Audit Log)
CREATE TABLE IF NOT EXISTS `sync_operations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_op_id` VARCHAR(64) UNIQUE NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL, -- 'bill', 'inventory', 'product'
    `operation_type` VARCHAR(50) NOT NULL, -- 'create_bill', 'restock', 'price_update'
    `payload_json` JSON NOT NULL,
    `client_timestamp` DATETIME NOT NULL,
    `server_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `status` ENUM('applied', 'ignored_duplicate', 'conflict') NOT NULL DEFAULT 'applied',
    `conflict_details` TEXT NULL,
    INDEX `idx_sync_status` (`status`),
    INDEX `idx_device_client` (`device_id`, `client_timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Paired Device Peers (for Phone-to-Phone Sync)
CREATE TABLE IF NOT EXISTS `devices` (
    `device_id` VARCHAR(64) PRIMARY KEY,
    `device_name` VARCHAR(100) NOT NULL,
    `device_role` ENUM('primary', 'counter_2', 'godown') NOT NULL DEFAULT 'counter_2',
    `ip_address` VARCHAR(45) NULL,
    `last_sync_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
