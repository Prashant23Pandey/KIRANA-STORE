/**
 * DukaanSaathi - IndexedDB Offline Storage Foundation
 * Role: Offline Engineer
 */

import type { Product, Bill, PendingOperation, InventoryLog } from '../types/models';

const DB_NAME = 'DukaanSaathi_OfflineDB';
const DB_VERSION = 1;

class OfflineStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Cached Products Catalog
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('barcode', 'barcode', { unique: false });
          productStore.createIndex('name_en', 'name_en', { unique: false });
          productStore.createIndex('category', 'category', { unique: false });
        }

        // 2. Local Bills (Keyed by client_op_id)
        if (!db.objectStoreNames.contains('bills')) {
          const billStore = db.createObjectStore('bills', { keyPath: 'client_op_id' });
          billStore.createIndex('bill_no', 'bill_no', { unique: false });
          billStore.createIndex('sync_status', 'sync_status', { unique: false });
          billStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // 3. Pending Operations Queue (Keyed by client_op_id)
        if (!db.objectStoreNames.contains('pending_operations')) {
          const opStore = db.createObjectStore('pending_operations', { keyPath: 'client_op_id' });
          opStore.createIndex('status', 'status', { unique: false });
          opStore.createIndex('entity_type', 'entity_type', { unique: false });
          opStore.createIndex('client_timestamp', 'client_timestamp', { unique: false });
        }

        // 4. Provisional Inventory Logs
        if (!db.objectStoreNames.contains('inventory_logs')) {
          const logStore = db.createObjectStore('inventory_logs', { keyPath: 'client_op_id' });
          logStore.createIndex('product_id', 'product_id', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- PRODUCTS CACHE ---
  public async cacheProducts(products: Product[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      for (const item of products) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getCachedProducts(): Promise<Product[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async findProductByBarcode(barcode: string): Promise<Product | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const index = store.index('barcode');
      const request = index.get(barcode);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- BILLS STORAGE ---
  public async saveLocalBill(bill: Bill): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['bills', 'products', 'inventory_logs', 'pending_operations'], 'readwrite');
      const billStore = tx.objectStore('bills');
      const productStore = tx.objectStore('products');
      const logStore = tx.objectStore('inventory_logs');
      const opStore = tx.objectStore('pending_operations');

      // 1. Store Bill
      billStore.put(bill);

      // 2. Provisional local stock decrement
      bill.items.forEach((item, idx) => {
        if (item.product_id) {
          const prodReq = productStore.get(item.product_id);
          prodReq.onsuccess = () => {
            const product: Product = prodReq.result;
            if (product) {
              product.stock_qty = Math.max(0, Number(product.stock_qty) - Number(item.quantity));
              productStore.put(product);

              // Record local inventory audit
              const log: InventoryLog = {
                client_op_id: `${bill.client_op_id}-item-${idx}`,
                product_id: item.product_id!,
                change_qty: -Number(item.quantity),
                operation_type: 'sale',
                reason: `Offline bill #${bill.bill_no}`,
                device_id: bill.device_id,
                balance_after: product.stock_qty,
                created_at: bill.created_at,
              };
              logStore.put(log);
            }
          };
        }
      });

      // 3. Queue Pending Operation for background sync
      const op: PendingOperation = {
        client_op_id: bill.client_op_id,
        device_id: bill.device_id,
        entity_type: 'bill',
        operation_type: 'create_bill',
        payload: bill,
        client_timestamp: bill.created_at,
        retry_count: 0,
        status: 'pending',
      };
      opStore.put(op);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getLocalBills(): Promise<Bill[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bills', 'readonly');
      const store = tx.objectStore('bills');
      const request = store.getAll();
      request.onsuccess = () => {
        const sorted = (request.result || []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- PENDING QUEUE ---
  public async getPendingOperations(): Promise<PendingOperation[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const store = tx.objectStore('pending_operations');
      const index = store.index('status');
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async markOperationApplied(clientOpId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['pending_operations', 'bills'], 'readwrite');
      const opStore = tx.objectStore('pending_operations');
      const billStore = tx.objectStore('bills');

      // Update op
      const opReq = opStore.get(clientOpId);
      opReq.onsuccess = () => {
        if (opReq.result) {
          const op = opReq.result;
          op.status = 'applied';
          opStore.put(op);
        }
      };

      // Mark bill synced
      const billReq = billStore.get(clientOpId);
      billReq.onsuccess = () => {
        if (billReq.result) {
          const bill: Bill = billReq.result;
          bill.sync_status = 'synced';
          bill.synced_at = new Date().toISOString();
          billStore.put(bill);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
