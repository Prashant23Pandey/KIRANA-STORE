/**
 * DukaanSaathi - Authoritative API Client Layer
 * Role: PHP/MySQL Engineer & Offline Engineer
 */

import type { Product } from '../types/models';
import { offlineStorage } from './offlineDb';

const CANDIDATE_URLS = [
  'http://127.0.0.1:8000/backend/api/index.php',
  'http://localhost/KIRANA%20PROBLEM/backend/api/index.php',
];

let activeBaseUrl = CANDIDATE_URLS[0];

export const getApiBaseUrl = () => activeBaseUrl;

export interface HealthCheckResult {
  isOnline: boolean;
  app?: string;
  version?: string;
  apiVersion?: string;
  phpVersion?: string;
  dbStatus?: string;
  dbVersion?: string;
  error?: string;
}

export class ApiClient {
  public static async checkHealth(): Promise<HealthCheckResult> {
    for (const url of CANDIDATE_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${url}?endpoint=v1/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          activeBaseUrl = url;
          return {
            isOnline: true,
            app: json.app,
            version: json.version,
            apiVersion: json.api_version,
            phpVersion: json.php_version,
            dbStatus: json.database?.status,
            dbVersion: json.database?.server_version,
          };
        }
      } catch {
        // Try next candidate url
      }
    }

    return {
      isOnline: false,
      error: 'Backend unreachable (Offline Mode active)',
    };
  }

  public static async fetchProducts(): Promise<{ products: Product[]; source: 'server' | 'cache' }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${activeBaseUrl}?endpoint=v1/products`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          await offlineStorage.cacheProducts(json.data);
          return { products: json.data, source: 'server' };
        }
      }
    } catch {
      // Fall through to local cache
    }

    const cached = await offlineStorage.getCachedProducts();
    return { products: cached, source: 'cache' };
  }

  public static async createProduct(product: Partial<Product>): Promise<any> {
    const res = await fetch(`${activeBaseUrl}?endpoint=v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    return res.json();
  }

  public static async receiveStock(productId: number, quantity: number, reason = 'Goods Inward'): Promise<any> {
    const clientOpId = 'op-rec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const res = await fetch(`${activeBaseUrl}?endpoint=v1/stock/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_op_id: clientOpId,
        product_id: productId,
        quantity,
        reason,
        device_id: 'counter_01',
      }),
    });
    return res.json();
  }

  public static async adjustStock(productId: number, exactQty: number, reason = 'Physical Audit Correction'): Promise<any> {
    const clientOpId = 'op-adj-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const res = await fetch(`${activeBaseUrl}?endpoint=v1/stock/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_op_id: clientOpId,
        product_id: productId,
        new_quantity: exactQty,
        reason,
        device_id: 'counter_01',
      }),
    });
    return res.json();
  }

  public static async syncPendingOperations(): Promise<{ synced: number; failed: number }> {
    const pending = await offlineStorage.getPendingOperations();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const op of pending) {
      try {
        if (op.entity_type === 'bill' && op.operation_type === 'create_bill') {
          const res = await fetch(`${activeBaseUrl}?endpoint=v1/bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.payload),
          });

          if (res.ok) {
            await offlineStorage.markOperationApplied(op.client_op_id);
            synced++;
          } else {
            failed++;
          }
        }
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  }
}
