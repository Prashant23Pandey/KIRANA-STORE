/**
 * DukaanSaathi - Shared TypeScript Models & Contracts
 * Role: Lead Architect / Shared Contracts
 */

export type LanguageCode = 'en' | 'hi' | 'hinglish';

export type PaymentMode = 'cash' | 'upi' | 'credit' | 'card';
export type PaymentStatus = 'paid' | 'pending' | 'cancelled';
export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type OperationType =
  | 'create_bill'
  | 'cancel_bill'
  | 'restock'
  | 'adjust_stock'
  | 'update_product';

export type EntityType = 'bill' | 'inventory' | 'product';

export interface Product {
  id: number;
  sku_code: string;
  barcode: string | null;
  name_en: string;
  name_hi: string | null;
  category: string;
  unit: 'pc' | 'kg' | 'g' | 'ltr' | 'ml' | 'packet';
  price: number;
  cost_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_active: number;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface BillItem {
  id?: number;
  product_id?: number | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Bill {
  id?: number;
  bill_no: string;
  client_op_id: string; // Mandatory UUID for idempotent offline synchronization
  customer_name?: string | null;
  customer_phone?: string | null;
  items: BillItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_mode: PaymentMode;
  payment_status: PaymentStatus;
  device_id: string;
  sync_status: SyncStatus;
  created_at: string;
  synced_at?: string | null;
}

export interface PendingOperation {
  client_op_id: string;
  device_id: string;
  entity_type: EntityType;
  operation_type: OperationType;
  payload: any;
  client_timestamp: string;
  retry_count: number;
  last_error?: string | null;
  status: 'pending' | 'in_flight' | 'applied' | 'conflict';
}

export interface InventoryLog {
  id?: number;
  client_op_id: string;
  product_id: number;
  change_qty: number;
  operation_type: 'sale' | 'restock' | 'damage' | 'return' | 'adjustment';
  reason: string;
  device_id: string;
  balance_after: number;
  created_at: string;
}

export interface DevicePeer {
  device_id: string;
  device_name: string;
  device_role: 'primary' | 'counter_2' | 'godown';
  ip_address?: string;
  last_sync_at?: string;
  is_online?: boolean;
}

export interface StoreSettings {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_upi_id: string;
  language: LanguageCode;
  device_id: string;
  device_name: string;
  server_url: string;
}

export type ScreenId =
  | 'home'
  | 'new_bill'
  | 'bill_review'
  | 'edit_bill'
  | 'send_receipt'
  | 'barcode_scanner'
  | 'product_details'
  | 'inventory'
  | 'bill_history'
  | 'device_sync'
  | 'analytics'
  | 'settings';
