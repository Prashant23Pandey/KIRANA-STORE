/**
 * DukaanSaathi - Authoritative API Client Layer
 * Role: PHP/MySQL Engineer & Offline Engineer
 */

import type { Product } from '../types/models';
import { offlineStorage } from './offlineDb';

const API_BASE_URL = 'http://localhost/KIRANA%20PROBLEM/backend/api/index.php';

export interface HealthCheckResult {
  isOnline: boolean;
  app?: string;
  version?: string;
  phpVersion?: string;
  dbStatus?: string;
  dbVersion?: string;
  error?: string;
}

export class ApiClient {
  public static async checkHealth(): Promise<HealthCheckResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${API_BASE_URL}?endpoint=health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { isOnline: false, error: `HTTP ${res.status}` };
      }

      const json = await res.json();
      return {
        isOnline: true,
        app: json.app,
        version: json.version,
        phpVersion: json.php_version,
        dbStatus: json.database?.status,
        dbVersion: json.database?.server_version,
      };
    } catch (e: any) {
      return {
        isOnline: false,
        error: e.name === 'AbortError' ? 'Connection timed out' : 'Backend unreachable (Offline Mode active)',
      };
    }
  }

  public static async fetchProducts(): Promise<{ products: Product[]; source: 'server' | 'cache' }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE_URL}?endpoint=products`, {
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

  public static async syncPendingOperations(): Promise<{ synced: number; failed: number }> {
    const pending = await offlineStorage.getPendingOperations();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const op of pending) {
      try {
        if (op.entity_type === 'bill' && op.operation_type === 'create_bill') {
          const res = await fetch(`${API_BASE_URL}?endpoint=bills`, {
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
