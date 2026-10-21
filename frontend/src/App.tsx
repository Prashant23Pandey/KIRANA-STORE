import React, { useState, useEffect } from 'react';
import type { Product, Bill, BillItem, ScreenId, LanguageCode } from './types/models';
import { ApiClient } from './services/apiClient';
import type { HealthCheckResult } from './services/apiClient';
import { offlineStorage } from './services/offlineDb';
import { REALISTIC_SAMPLE_PRODUCTS, REALISTIC_SAMPLE_BILLS } from './utils/sampleData';

// Component & Page Imports
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';

import { HomePage } from './pages/HomePage';
import { NewBillPage } from './pages/NewBillPage';
import { BillReviewPage } from './pages/BillReviewPage';
import { SendReceiptPage } from './pages/SendReceiptPage';
import { InventoryPage } from './pages/InventoryPage';
import { BillHistoryPage } from './pages/BillHistoryPage';
import { DeviceSyncPage } from './pages/DeviceSyncPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('home');
  const [lang, setLang] = useState<LanguageCode>('hi'); // Default Hindi for shopkeeper workflow
  const [health, setHealth] = useState<HealthCheckResult>({ isOnline: false });
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDemoData, setIsDemoData] = useState<boolean>(false);

  // New Bill active draft state
  const [currentBillItems, setCurrentBillItems] = useState<BillItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'credit' | 'card'>('cash');
  const [lastCreatedBill, setLastCreatedBill] = useState<Bill | null>(null);
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<Bill | null>(null);

  // Barcode scanner modal state
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);

  // Initial load & system polling
  const refreshSystemData = async () => {
    const healthRes = await ApiClient.checkHealth();
    setHealth(healthRes);

    const prodRes = await ApiClient.fetchProducts();
    if (prodRes.products.length > 0) {
      setProducts(prodRes.products);
    } else {
      // Fallback to initial realistic sample products if empty
      await offlineStorage.cacheProducts(REALISTIC_SAMPLE_PRODUCTS);
      setProducts(REALISTIC_SAMPLE_PRODUCTS);
      setIsDemoData(true);
    }

    const localBills = await offlineStorage.getLocalBills();
    if (localBills.length > 0) {
      setBills(localBills);
    } else {
      // Preload sample bills for realistic initial history
      for (const b of REALISTIC_SAMPLE_BILLS) {
        await offlineStorage.saveLocalBill(b);
      }
      setBills(REALISTIC_SAMPLE_BILLS);
    }

    const pending = await offlineStorage.getPendingOperations();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    refreshSystemData();
    const interval = setInterval(() => {
      ApiClient.checkHealth().then(setHealth);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await ApiClient.syncPendingOperations();
    await refreshSystemData();
    setIsSyncing(false);
  };

  const handleLoadDemoData = async () => {
    await offlineStorage.cacheProducts(REALISTIC_SAMPLE_PRODUCTS);
    setProducts(REALISTIC_SAMPLE_PRODUCTS);
    for (const b of REALISTIC_SAMPLE_BILLS) {
      await offlineStorage.saveLocalBill(b);
    }
    const freshBills = await offlineStorage.getLocalBills();
    setBills(freshBills);
    setIsDemoData(true);
    alert('Realistic Kirana Demo Data loaded into local IndexedDB!');
  };

  // Bill Finalization Workflow
  const handleFinalizeBill = async () => {
    if (currentBillItems.length === 0) return;

    const clientOpId = 'uuid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const billNo = 'DS-' + Math.floor(100000 + Math.random() * 900000);
    const subtotal = currentBillItems.reduce((sum, item) => sum + item.total_price, 0);

    const newBill: Bill = {
      bill_no: billNo,
      client_op_id: clientOpId,
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone || '',
      items: currentBillItems,
      subtotal: subtotal,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: subtotal,
      payment_mode: paymentMode,
      payment_status: 'paid',
      device_id: 'counter_01',
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Save locally to IndexedDB first (Offline-First Guarantee)
    await offlineStorage.saveLocalBill(newBill);
    setLastCreatedBill(newBill);

    // Trigger immediate background sync if online
    if (health.isOnline) {
      ApiClient.syncPendingOperations().then(() => refreshSystemData());
    } else {
      await refreshSystemData();
    }

    // Reset draft and navigate to send receipt screen
    setCurrentBillItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setActiveScreen('send_receipt');
  };

  // Inventory actions
  const handleAddProduct = async (newProd: Partial<Product>) => {
    // If online, post to server; also save locally in IndexedDB
    try {
      if (health.isOnline) {
        await ApiClient.createProduct(newProd);
      }
    } catch {
      // offline fallback
    }

    const created: Product = {
      id: Date.now(),
      sku_code: newProd.sku_code || 'SKU-' + Date.now().toString().slice(-6),
      barcode: newProd.barcode || null,
      name_en: newProd.name_en || 'Product',
      name_hi: newProd.name_hi || null,
      category: newProd.category || 'Groceries',
      unit: newProd.unit || 'packet',
      price: newProd.price || 0,
      cost_price: newProd.cost_price || 0,
      stock_qty: newProd.stock_qty || 0,
      low_stock_threshold: newProd.low_stock_threshold || 5,
      is_active: 1,
      version: 1,
    };

    const updated = [...products, created];
    setProducts(updated);
    await offlineStorage.cacheProducts(updated);
  };

  const handleReceiveStock = async (productId: number, addQty: number) => {
    try {
      if (health.isOnline) {
        await ApiClient.receiveStock(productId, addQty, 'Goods Inward Received');
      }
    } catch {
      // offline fallback
    }

    // Update local state and IndexedDB
    const updated = products.map((p) => {
      if (p.id === productId) {
        return { ...p, stock_qty: Number(p.stock_qty) + addQty };
      }
      return p;
    });
    setProducts(updated);
    await offlineStorage.cacheProducts(updated);
  };

  const handleAdjustStock = async (productId: number, exactQty: number) => {
    try {
      if (health.isOnline) {
        await ApiClient.adjustStock(productId, exactQty, 'Physical Audit Correction');
      }
    } catch {
      // offline fallback
    }

    const updated = products.map((p) => {
      if (p.id === productId) {
        return { ...p, stock_qty: exactQty };
      }
      return p;
    });
    setProducts(updated);
    await offlineStorage.cacheProducts(updated);
  };

  const handleProductScanned = (prod: Product) => {
    // Add to cart and navigate to new_bill
    const existing = currentBillItems.find((i) => i.product_id === prod.id);
    if (existing) {
      existing.quantity += 1;
      existing.total_price = existing.quantity * existing.unit_price;
      setCurrentBillItems([...currentBillItems]);
    } else {
      const displayName = lang === 'hi' && prod.name_hi ? prod.name_hi : prod.name_en;
      setCurrentBillItems([
        ...currentBillItems,
        {
          product_id: prod.id,
          item_name: displayName,
          unit: prod.unit,
          quantity: 1,
          unit_price: Number(prod.price),
          total_price: Number(prod.price),
        },
      ]);
    }
    setActiveScreen('new_bill');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* 1. Accessible Trilingual Header */}
      <Header
        lang={lang}
        setLang={setLang}
        health={health}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
        isDemoData={isDemoData}
      />

      {/* 2. Main Page Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 pb-24">
        {activeScreen === 'home' && (
          <HomePage
            lang={lang}
            setActiveScreen={setActiveScreen}
            bills={bills}
            products={products}
            setSelectedBillForDetails={(b) => {
              setSelectedBillForDetails(b);
              setActiveScreen('bill_history');
            }}
          />
        )}

        {activeScreen === 'new_bill' && (
          <NewBillPage
            lang={lang}
            products={products}
            currentBillItems={currentBillItems}
            setCurrentBillItems={setCurrentBillItems}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode}
            onProceedToReview={() => setActiveScreen('bill_review')}
            onOpenScanner={() => setScannerOpen(true)}
          />
        )}

        {activeScreen === 'bill_review' && (
          <BillReviewPage
            lang={lang}
            items={currentBillItems}
            customerName={customerName}
            customerPhone={customerPhone}
            paymentMode={paymentMode}
            onConfirmAndFinalize={handleFinalizeBill}
            onBackToEdit={() => setActiveScreen('new_bill')}
          />
        )}

        {activeScreen === 'send_receipt' && (
          <SendReceiptPage
            lang={lang}
            bill={lastCreatedBill}
            onStartNewBill={() => setActiveScreen('new_bill')}
          />
        )}

        {activeScreen === 'inventory' && (
          <InventoryPage
            lang={lang}
            products={products}
            onAddProduct={handleAddProduct}
            onReceiveStock={handleReceiveStock}
            onAdjustStock={handleAdjustStock}
            onOpenScanner={() => setScannerOpen(true)}
          />
        )}

        {activeScreen === 'bill_history' && (
          <BillHistoryPage
            lang={lang}
            bills={bills}
            selectedBillForDetails={selectedBillForDetails}
            setSelectedBillForDetails={setSelectedBillForDetails}
          />
        )}

        {activeScreen === 'device_sync' && (
          <DeviceSyncPage
            lang={lang}
            health={health}
            pendingCount={pendingCount}
            isSyncing={isSyncing}
            onManualSync={handleManualSync}
          />
        )}

        {activeScreen === 'analytics' && (
          <AnalyticsPage
            lang={lang}
            bills={bills}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsPage
            lang={lang}
            setLang={setLang}
            health={health}
            onRetestConnection={refreshSystemData}
            onLoadDemoData={handleLoadDemoData}
            isDemoData={isDemoData}
          />
        )}
      </main>

      {/* 3. Barcode Scanner Modal with Manual Entry Fallback */}
      <BarcodeScannerModal
        lang={lang}
        products={products}
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onProductScanned={handleProductScanned}
      />

      {/* 4. Accessible Bottom Fixed Navigation */}
      <BottomNav
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        lang={lang}
      />
    </div>
  );
};

export default App;
