import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  PlusCircle,
  Clock,
  Boxes,
  Smartphone,
  BarChart3,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Mic,
  Camera,
  CheckCircle2,
  XCircle,
  Store,
  Share2
} from 'lucide-react';
import type { Product, Bill, BillItem, ScreenId, LanguageCode } from './types/models';
import { ApiClient } from './services/apiClient';
import type { HealthCheckResult } from './services/apiClient';
import { offlineStorage } from './services/offlineDb';

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('home');
  const [lang, setLang] = useState<LanguageCode>('en');
  const [health, setHealth] = useState<HealthCheckResult>({ isOnline: false });
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // New Bill active state
  const [currentBillItems, setCurrentBillItems] = useState<BillItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [lastCreatedBill, setLastCreatedBill] = useState<Bill | null>(null);

  // Quick entry text
  const [quickSearch, setQuickSearch] = useState<string>('');

  // Initial load & health polling
  const checkSystem = async () => {
    const res = await ApiClient.checkHealth();
    setHealth(res);

    const prodRes = await ApiClient.fetchProducts();
    setProducts(prodRes.products);

    const localBills = await offlineStorage.getLocalBills();
    setBills(localBills);

    const pending = await offlineStorage.getPendingOperations();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    checkSystem();
    const interval = setInterval(() => {
      ApiClient.checkHealth().then(setHealth);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await ApiClient.syncPendingOperations();
    await checkSystem();
    setIsSyncing(false);
  };

  // Cart calculation
  const subtotal = currentBillItems.reduce((sum, item) => sum + item.total_price, 0);
  const totalAmount = subtotal;

  const addItemToBill = (prod: Product) => {
    const existingIndex = currentBillItems.findIndex(i => i.product_id === prod.id);
    if (existingIndex >= 0) {
      const updated = [...currentBillItems];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].total_price = newQty * updated[existingIndex].unit_price;
      setCurrentBillItems(updated);
    } else {
      const newItem: BillItem = {
        product_id: prod.id,
        item_name: lang === 'hi' && prod.name_hi ? prod.name_hi : prod.name_en,
        unit: prod.unit,
        quantity: 1,
        unit_price: Number(prod.price),
        total_price: Number(prod.price),
      };
      setCurrentBillItems([...currentBillItems, newItem]);
    }
  };

  const updateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      setCurrentBillItems(currentBillItems.filter((_, idx) => idx !== index));
    } else {
      const updated = [...currentBillItems];
      updated[index].quantity = newQty;
      updated[index].total_price = newQty * updated[index].unit_price;
      setCurrentBillItems(updated);
    }
  };

  const handleCompleteBill = async () => {
    setShowConfirmModal(false);
    const clientOpId = 'op-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    const billNo = 'DS-' + Math.floor(100000 + Math.random() * 900000);

    const newBill: Bill = {
      bill_no: billNo,
      client_op_id: clientOpId,
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone || '',
      items: currentBillItems,
      subtotal: subtotal,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: totalAmount,
      payment_mode: paymentMode,
      payment_status: 'paid',
      device_id: 'counter_01',
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Save locally first (Offline-First guarantee)
    await offlineStorage.saveLocalBill(newBill);
    setLastCreatedBill(newBill);

    // Try immediate background sync if online
    if (health.isOnline) {
      ApiClient.syncPendingOperations().then(() => checkSystem());
    } else {
      await checkSystem();
    }

    // Reset bill state and move to receipt screen
    setCurrentBillItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setActiveScreen('send_receipt');
  };

  const filteredProducts = products.filter(p =>
    p.name_en.toLowerCase().includes(quickSearch.toLowerCase()) ||
    (p.name_hi && p.name_hi.includes(quickSearch)) ||
    (p.barcode && p.barcode.includes(quickSearch))
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800">
      {/* 1. TOP HEADER */}
      <header className="bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 p-2 rounded-xl text-slate-950 font-bold flex items-center justify-center shadow-lg">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
              <span>{lang === 'hi' ? 'दुकान साथी' : 'DukaanSaathi'}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Phase 1 Shell
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {lang === 'hi' ? 'स्मार्ट किराना बिलिंग और स्टॉक' : 'Offline-First Smart Kirana POS'}
            </p>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center space-x-3">
          {/* Online/Offline Badge */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              health.isOnline
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/50'
                : 'bg-amber-950/60 text-amber-300 border-amber-600/50'
            }`}
          >
            {health.isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">
              {health.isOnline ? `MySQL Online (${health.dbVersion || '9.1'})` : 'Offline Mode (Local IDB)'}
            </span>
          </div>

          {/* Pending Sync Count */}
          {pendingCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Click to sync pending operations to MySQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{pendingCount} Pending</span>
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold border border-slate-700 transition"
          >
            {lang === 'en' ? 'हिन्दी' : 'English'}
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE / ACTIVE SCREEN */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-4 pb-24">
        {/* SCREEN 1: HOME */}
        {activeScreen === 'home' && (
          <div className="space-y-4">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  {lang === 'hi' ? 'आज की बिक्री' : "Today's Sales"}
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ₹{bills.reduce((sum, b) => sum + Number(b.total_amount), 0).toFixed(0)}
                </p>
                <span className="text-xs text-emerald-600 font-semibold">{bills.length} bills recorded</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  {lang === 'hi' ? 'उत्पाद सूची' : 'Catalog Items'}
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{products.length}</p>
                <span className="text-xs text-blue-600 font-semibold">Cached in IndexedDB</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  {lang === 'hi' ? 'कम स्टॉक आइटम' : 'Low Stock Alert'}
                </span>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {products.filter(p => Number(p.stock_qty) <= Number(p.low_stock_threshold)).length}
                </p>
                <span className="text-xs text-amber-600 font-semibold">Needs restock</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  {lang === 'hi' ? 'डेटाबेस स्थिति' : 'Database Status'}
                </span>
                <p className="text-sm font-bold text-slate-900 mt-2 truncate">
                  {health.isOnline ? 'MySQL Connected' : 'IndexedDB Local'}
                </p>
                <span className="text-xs text-slate-500">ID: counter_01</span>
              </div>
            </div>

            {/* Hero Quick Action for New Bill */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  {lang === 'hi' ? 'नया ग्राहक बिल बनाएं' : 'Create New Customer Bill'}
                </h2>
                <p className="text-emerald-100 text-sm mt-1">
                  {lang === 'hi'
                    ? 'आवाज, बारकोड या त्वरित चयन से तेज़ी से बिलिंग करें'
                    : 'Fast billing with voice simulation, barcode lookup, or instant catalog tap'}
                </p>
              </div>
              <button
                onClick={() => setActiveScreen('new_bill')}
                className="w-full sm:w-auto bg-white hover:bg-emerald-50 text-emerald-800 px-6 py-3 rounded-xl font-bold shadow-md flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                <span>{lang === 'hi' ? 'बिलिंग शुरू करें' : 'Start Billing'}</span>
              </button>
            </div>

            {/* Quick Feature Grid */}
            <h3 className="font-bold text-slate-800 text-base mt-2">
              {lang === 'hi' ? 'त्वरित कार्यप्रवाह' : 'Quick Operations'}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {[
                { id: 'new_bill', icon: PlusCircle, label: lang === 'hi' ? 'नया बिल' : 'New Bill', color: 'bg-emerald-500' },
                { id: 'barcode_scanner', icon: Camera, label: lang === 'hi' ? 'बारकोड' : 'Scanner', color: 'bg-indigo-500' },
                { id: 'inventory', icon: Boxes, label: lang === 'hi' ? 'स्टॉक / माल' : 'Inventory', color: 'bg-blue-500' },
                { id: 'bill_history', icon: Clock, label: lang === 'hi' ? 'बिल इतिहास' : 'History', color: 'bg-violet-500' },
                { id: 'device_sync', icon: Smartphone, label: lang === 'hi' ? 'फोन सिंक' : 'Device Sync', color: 'bg-amber-500' },
                { id: 'analytics', icon: BarChart3, label: lang === 'hi' ? 'विश्लेषण' : 'Analytics', color: 'bg-teal-500' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveScreen(item.id as ScreenId)}
                  className="bg-white hover:bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col items-center text-center shadow-sm active:scale-95 transition"
                >
                  <div className={`${item.color} text-white p-2.5 rounded-xl shadow-sm mb-2`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Recent Bills preview */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-sm">
                  {lang === 'hi' ? 'हाल के बिल' : 'Recent Bills'}
                </h3>
                <button
                  onClick={() => setActiveScreen('bill_history')}
                  className="text-xs text-emerald-600 font-semibold hover:underline"
                >
                  {lang === 'hi' ? 'सभी देखें' : 'View All'} &rarr;
                </button>
              </div>
              {bills.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  {lang === 'hi' ? 'कोई बिल दर्ज नहीं किया गया है' : 'No bills recorded yet. Create your first bill!'}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {bills.slice(0, 3).map(b => (
                    <div key={b.client_op_id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900">{b.bill_no}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              b.sync_status === 'synced'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {b.sync_status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {b.customer_name} • {b.items.length} items • {b.payment_mode.toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">₹{b.total_amount}</span>
                        <p className="text-[10px] text-slate-400">{new Date(b.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 2: NEW BILL (Catalog & Live Bill) */}
        {activeScreen === 'new_bill' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left: Catalog & Quick Entry (7 cols) */}
            <div className="md:col-span-7 space-y-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
                <input
                  type="text"
                  value={quickSearch}
                  onChange={e => setQuickSearch(e.target.value)}
                  placeholder={lang === 'hi' ? 'उत्पाद या बारकोड खोजें...' : 'Search item name or barcode...'}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => alert("Simulating Speech Recognition: 'Aashirvaad Atta, Maggi 2 packets'")}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 p-2.5 rounded-xl border border-emerald-300 transition"
                  title="Voice Entry"
                >
                  <Mic className="w-5 h-5 text-emerald-700" />
                </button>
                <button
                  onClick={() => setActiveScreen('barcode_scanner')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl border border-slate-300 transition"
                  title="Barcode Scanner"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              {/* Product Quick-tap Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[460px] overflow-y-auto pr-1">
                {filteredProducts.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => addItemToBill(prod)}
                    className="bg-white hover:border-emerald-500 p-3 rounded-xl border border-slate-200 text-left transition shadow-sm active:scale-95 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium uppercase">{prod.category}</span>
                      <p className="font-semibold text-xs text-slate-800 line-clamp-2 mt-0.5">
                        {lang === 'hi' && prod.name_hi ? prod.name_hi : prod.name_en}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-sm text-emerald-700">₹{prod.price}</span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {prod.unit}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Live Bill & Checkout (5 cols) */}
            <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b pb-2 mb-3">
                  <h3 className="font-bold text-base text-slate-900">
                    {lang === 'hi' ? 'लाइव बिल' : 'Live Bill Items'}
                  </h3>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    {currentBillItems.length} items
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2 max-h-[260px] overflow-y-auto mb-3">
                  {currentBillItems.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      {lang === 'hi' ? 'आइटम जोड़ने के लिए सूची से चुनें' : 'Tap products on the left or scan to add'}
                    </div>
                  ) : (
                    currentBillItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl text-xs">
                        <div className="flex-1 mr-2">
                          <p className="font-bold text-slate-800 truncate">{item.item_name}</p>
                          <span className="text-slate-500">₹{item.unit_price} / {item.unit}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => updateItemQty(idx, item.quantity - 1)}
                            className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded font-bold flex items-center justify-center text-slate-700"
                          >
                            -
                          </button>
                          <span className="font-bold w-5 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateItemQty(idx, item.quantity + 1)}
                            className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded font-bold flex items-center justify-center text-slate-700"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-bold text-slate-900 ml-3 w-14 text-right">
                          ₹{item.total_price}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Customer Details */}
                <div className="space-y-2 border-t pt-3">
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder={lang === 'hi' ? 'ग्राहक का नाम (वैकल्पिक)' : 'Customer Name (optional)'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder={lang === 'hi' ? 'मोबाइल नंबर (व्हाट्सएप रसीद के लिए)' : 'Mobile No (for WhatsApp receipt)'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setPaymentMode('cash')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                        paymentMode === 'cash'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {lang === 'hi' ? 'नकद (Cash)' : 'Cash'}
                    </button>
                    <button
                      onClick={() => setPaymentMode('upi')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                        paymentMode === 'upi'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      UPI / QR
                    </button>
                  </div>
                </div>
              </div>

              {/* Total & Confirm Trigger */}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-slate-600">{lang === 'hi' ? 'कुल राशि' : 'Total Amount'}</span>
                  <span className="text-2xl font-black text-slate-900">₹{totalAmount}</span>
                </div>
                <button
                  disabled={currentBillItems.length === 0}
                  onClick={() => setShowConfirmModal(true)}
                  className={`w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition ${
                    currentBillItems.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{lang === 'hi' ? 'बिल की समीक्षा और पुष्टि करें' : 'Review & Confirm Bill'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3 & 4: LIVE BILL REVIEW WITH YES/NO CONFIRMATION MODAL */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center mb-2">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">
                  {lang === 'hi' ? 'क्या आप यह बिल सहेजना चाहते हैं?' : 'Confirm & Finalize Bill?'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'hi'
                    ? 'कृपया नीचे दिए गए विवरण की जांच करें और पुष्टि करें'
                    : 'Check details before saving locally and updating inventory'}
                </p>
              </div>

              {/* Bill Summary Table */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 mb-4 text-xs">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Customer:</span>
                  <span>{customerName || 'Walk-in Customer'}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Payment Mode:</span>
                  <span className="uppercase">{paymentMode}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-black text-sm text-slate-900">
                  <span>Net Payable:</span>
                  <span>₹{totalAmount}</span>
                </div>
              </div>

              {/* Yes / No Buttons (Prominent) */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4 text-slate-500" />
                  <span>{lang === 'hi' ? 'नहीं, सुधारें' : 'No, Edit Bill'}</span>
                </button>
                <button
                  onClick={handleCompleteBill}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'हाँ, पक्का करें' : 'Yes, Confirm'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 5: SEND RECEIPT (WhatsApp / Save Locally) */}
        {activeScreen === 'send_receipt' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">
                {lang === 'hi' ? 'बिल सफलतापूर्वक सहेजा गया!' : 'Bill Saved Successfully!'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Bill #{lastCreatedBill?.bill_no} • {lastCreatedBill?.sync_status === 'synced' ? 'Synced to MySQL' : 'Saved to Local Database'}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-left text-xs space-y-1.5 border">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-slate-900">₹{lastCreatedBill?.total_amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Items:</span>
                <span className="font-bold text-slate-900">{lastCreatedBill?.items.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode:</span>
                <span className="font-bold uppercase text-slate-900">{lastCreatedBill?.payment_mode}</span>
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="space-y-2 pt-2">
              <a
                href={`https://wa.me/${lastCreatedBill?.customer_phone || ''}?text=${encodeURIComponent(
                  `*DukaanSaathi Receipt*\nBill: ${lastCreatedBill?.bill_no}\nTotal: ₹${lastCreatedBill?.total_amount}\nThank you for shopping with us!`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Share2 className="w-4 h-4" />
                <span>{lang === 'hi' ? 'व्हाट्सएप पर रसीद भेजें' : 'Send Receipt on WhatsApp'}</span>
              </a>
              <button
                onClick={() => setActiveScreen('new_bill')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 rounded-xl font-bold text-xs transition"
              >
                {lang === 'hi' ? 'नया बिल शुरू करें' : 'Create Next Bill'}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 6: BARCODE SCANNER FALLBACK */}
        {activeScreen === 'barcode_scanner' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              <span>{lang === 'hi' ? 'बारकोड स्कैनर' : 'Barcode Scanner'}</span>
            </h3>
            <div className="bg-slate-950 rounded-xl h-48 flex flex-col items-center justify-center text-slate-400 p-4 border border-dashed border-slate-700">
              <Camera className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs text-center">Camera stream initialized (ZXing / Quagga integration slot)</p>
              <span className="text-[10px] text-slate-500 mt-1">Ready for product barcode detection</span>
            </div>

            {/* Manual Entry Fallback */}
            <div className="border-t pt-3 space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                {lang === 'hi' ? 'या मैन्युअल रूप से बारकोड दर्ज करें:' : 'Or enter barcode manually (Fallback):'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 8901030383701"
                  className="flex-1 bg-slate-50 border rounded-xl px-3 py-2 text-xs"
                  id="manualBarcode"
                />
                <button
                  onClick={() => {
                    const val = (document.getElementById('manualBarcode') as HTMLInputElement)?.value;
                    const found = products.find(p => p.barcode === val);
                    if (found) {
                      addItemToBill(found);
                      setActiveScreen('new_bill');
                    } else {
                      alert(`Barcode ${val} not found in catalog.`);
                    }
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
                >
                  Lookup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 7 & 8: INVENTORY & STOCK */}
        {activeScreen === 'inventory' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-lg text-slate-900">
                  {lang === 'hi' ? 'इन्वेंट्री और स्टॉक प्रबंधन' : 'Inventory & Stock Management'}
                </h2>
                <p className="text-xs text-slate-500">Authoritative MySQL / Local cache inventory</p>
              </div>
              <button
                onClick={() => alert("Add Product form modal available in Phase 2")}
                className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{lang === 'hi' ? 'नया उत्पाद' : 'Add Product'}</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b">
                  <tr>
                    <th className="p-3">SKU / Item</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Stock Qty</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => {
                    const isLow = Number(p.stock_qty) <= Number(p.low_stock_threshold);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{lang === 'hi' && p.name_hi ? p.name_hi : p.name_en}</p>
                          <span className="text-[10px] text-slate-400">{p.sku_code} {p.barcode ? `• ${p.barcode}` : ''}</span>
                        </td>
                        <td className="p-3 text-slate-600">{p.category}</td>
                        <td className="p-3 text-right font-bold">₹{p.price}</td>
                        <td className="p-3 text-right font-bold">{p.stock_qty} {p.unit}</td>
                        <td className="p-3 text-center">
                          {isLow ? (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Low Stock
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCREEN 9: BILL HISTORY */}
        {activeScreen === 'bill_history' && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg text-slate-900">
              {lang === 'hi' ? 'बिल इतिहास' : 'Billing History & Records'}
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
              {bills.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No bills saved yet.</div>
              ) : (
                bills.map(b => (
                  <div key={b.client_op_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{b.bill_no}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          b.sync_status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {b.sync_status.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400">UUID: {b.client_op_id}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {b.customer_name} • {b.items.length} items • {new Date(b.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900">₹{b.total_amount}</span>
                      <p className="text-xs text-slate-500 uppercase">{b.payment_mode}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SCREEN 10: SYNC WITH ANOTHER PHONE */}
        {activeScreen === 'device_sync' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full mx-auto flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">
                {lang === 'hi' ? 'दूसरे फोन से सिंक करें' : 'Sync With Another Phone'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Peer-to-peer / Server coordination for multi-counter kirana shops
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border text-left space-y-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span>This Device ID:</span>
                <span className="font-mono text-emerald-700">counter_01 (Primary)</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Paired Devices:</span>
                <span>counter_02 (Godown tablet)</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Pending Ops:</span>
                <span className="font-bold text-amber-600">{pendingCount} operations</span>
              </div>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow active:scale-95 transition flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{lang === 'hi' ? 'अभी सिंक्रनाइज़ करें' : 'Synchronize Now'}</span>
            </button>
          </div>
        )}

        {/* SCREEN 11: ANALYTICS */}
        {activeScreen === 'analytics' && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg text-slate-900">
              {lang === 'hi' ? 'दुकान विश्लेषण' : 'Store Analytics & Insights'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <span className="text-xs text-slate-500 font-semibold">Total Revenue</span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  ₹{bills.reduce((sum, b) => sum + Number(b.total_amount), 0)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <span className="text-xs text-slate-500 font-semibold">Cash vs UPI Ratio</span>
                <p className="text-lg font-bold text-emerald-700 mt-2">
                  {bills.filter(b => b.payment_mode === 'cash').length} Cash / {bills.filter(b => b.payment_mode === 'upi').length} UPI
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <span className="text-xs text-slate-500 font-semibold">Top Category</span>
                <p className="text-lg font-bold text-blue-700 mt-2">Groceries & Dairy</p>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 12: SETTINGS & LANGUAGE */}
        {activeScreen === 'settings' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-slate-700" />
              <span>{lang === 'hi' ? 'सेटिंग्स और भाषा' : 'Settings & Language'}</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Language / भाषा</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLang('en')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      lang === 'en' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setLang('hi')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      lang === 'hi' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    हिन्दी
                  </button>
                </div>
              </div>

              {/* MySQL Server Health diagnostics */}
              <div className="border-t pt-3">
                <span className="font-semibold text-slate-700 block mb-2">Backend Diagnostics</span>
                <div className="bg-slate-50 p-3 rounded-xl border space-y-1 font-mono text-[11px]">
                  <p>PHP Version: {health.phpVersion || 'Checking...'}</p>
                  <p>MySQL Status: {health.dbStatus || (health.isOnline ? 'Online' : 'Offline')}</p>
                  <p>MySQL Version: {health.dbVersion || '9.1.0'}</p>
                  <p>Database: dukaansaathi_db</p>
                </div>
                <button
                  onClick={checkSystem}
                  className="mt-2 w-full bg-slate-200 hover:bg-slate-300 text-slate-800 py-2 rounded-xl font-bold text-xs"
                >
                  Re-test Server Connection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. BOTTOM FIXED NAVIGATION BAR */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 py-2 px-3 shadow-lg z-40 flex items-center justify-around max-w-5xl mx-auto">
        {[
          { id: 'home', icon: Store, label: lang === 'hi' ? 'होम' : 'Home' },
          { id: 'new_bill', icon: PlusCircle, label: lang === 'hi' ? 'नया बिल' : 'New Bill' },
          { id: 'inventory', icon: Boxes, label: lang === 'hi' ? 'स्टॉक' : 'Stock' },
          { id: 'bill_history', icon: Clock, label: lang === 'hi' ? 'इतिहास' : 'History' },
          { id: 'settings', icon: SettingsIcon, label: lang === 'hi' ? 'सेटिंग्स' : 'Settings' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveScreen(tab.id as ScreenId)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
              activeScreen === tab.id
                ? 'text-emerald-700 font-bold bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <tab.icon className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
