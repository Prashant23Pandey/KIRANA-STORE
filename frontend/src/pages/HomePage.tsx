import React from 'react';
import {
  PlusCircle,
  Boxes,
  Clock,
  Smartphone,
  BarChart3,
  Settings as SettingsIcon,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Receipt
} from 'lucide-react';
import type { ScreenId, LanguageCode, Bill, Product } from '../types/models';
import { getT } from '../utils/i18n';

interface HomePageProps {
  lang: LanguageCode;
  setActiveScreen: (screen: ScreenId) => void;
  bills: Bill[];
  products: Product[];
  setSelectedBillForDetails: (bill: Bill) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  lang,
  setActiveScreen,
  bills,
  products,
  setSelectedBillForDetails,
}) => {
  const t = getT(lang);

  // Calculations from actual data (never fabricated)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayBills = bills.filter(
    (b) => new Date(b.created_at).getTime() >= todayStart.getTime()
  );

  const todayRevenue = todayBills.reduce(
    (sum, b) => sum + Number(b.total_amount),
    0
  );

  const lowStockCount = products.filter(
    (p) => Number(p.stock_qty) <= Number(p.low_stock_threshold)
  ).length;

  return (
    <div className="space-y-4">
      {/* 1. HERO CALL TO ACTION: NEW BILL */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-200" />
            <h2 className="text-xl sm:text-2xl font-black">
              {t.startBilling}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-blue-100 max-w-md">
            {t.startBillingDesc}
          </p>
        </div>
        <button
          onClick={() => setActiveScreen('new_bill')}
          className="w-full sm:w-auto bg-white hover:bg-blue-50 text-blue-700 px-6 py-3.5 rounded-xl font-black text-sm sm:text-base shadow flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <PlusCircle className="w-5 h-5 text-blue-600" />
          <span>{t.btnNewBill}</span>
        </button>
      </div>

      {/* 2. REAL-TIME METRICS TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t.todaySales}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            ₹{todayRevenue.toFixed(0)}
          </p>
          <span className="text-[11px] text-emerald-600 font-bold mt-1">
            {todayBills.length} {t.itemsCount} billed
          </span>
        </div>

        {/* Catalog Items */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t.catalogItems}</span>
            <Boxes className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            {products.length}
          </p>
          <span className="text-[11px] text-slate-500 font-medium mt-1">
            Ready for billing
          </span>
        </div>

        {/* Low Stock Warning */}
        <div
          onClick={() => setActiveScreen('inventory')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t.lowStockAlert}</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className={`text-2xl font-black ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {lowStockCount}
          </p>
          <span className="text-[11px] text-amber-700 font-bold mt-1">
            {lowStockCount > 0 ? 'Restock needed' : 'All good'}
          </span>
        </div>

        {/* Total Bills */}
        <div
          onClick={() => setActiveScreen('bill_history')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-slate-400 transition"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t.btnHistory}</span>
            <Receipt className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            {bills.length}
          </p>
          <span className="text-[11px] text-blue-600 font-semibold mt-1">
            Recorded in store
          </span>
        </div>
      </div>

      {/* 3. REFERENCE-BASED 6 MAIN OPERATIONS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* 1. New Bill */}
        <button
          onClick={() => setActiveScreen('new_bill')}
          className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border-2 border-blue-200 text-left shadow-sm active:scale-95 transition flex items-center space-x-3"
        >
          <div className="bg-blue-600 text-white p-3 rounded-xl shadow-sm shrink-0">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              {t.btnNewBill}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Voice / Barcode / Tap
            </p>
          </div>
        </button>

        {/* 2. Stock / Restock */}
        <button
          onClick={() => setActiveScreen('inventory')}
          className="bg-white hover:bg-amber-50/50 p-4 rounded-xl border border-slate-200 text-left shadow-sm active:scale-95 transition flex items-center space-x-3"
        >
          <div className="bg-amber-500 text-white p-3 rounded-xl shadow-sm shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              {t.btnStock}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Manage items & inventory
            </p>
          </div>
        </button>

        {/* 3. Bill History */}
        <button
          onClick={() => setActiveScreen('bill_history')}
          className="bg-white hover:bg-slate-50 p-4 rounded-xl border border-slate-200 text-left shadow-sm active:scale-95 transition flex items-center space-x-3"
        >
          <div className="bg-slate-700 text-white p-3 rounded-xl shadow-sm shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              {t.btnHistory}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Review past customer bills
            </p>
          </div>
        </button>

        {/* 4. Sync with Another Phone */}
        <button
          onClick={() => setActiveScreen('device_sync')}
          className="bg-white hover:bg-emerald-50/50 p-4 rounded-xl border border-slate-200 text-left shadow-sm active:scale-95 transition flex items-center space-x-3"
        >
          <div className="bg-emerald-600 text-white p-3 rounded-xl shadow-sm shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              {t.btnSyncPhone}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Counter 2 & Godown pairing
            </p>
          </div>
        </button>

        {/* 5. Analytics */}
        <button
          onClick={() => setActiveScreen('analytics')}
          className="bg-white hover:bg-teal-50/50 p-4 rounded-xl border border-slate-200 text-left shadow-sm active:scale-95 transition flex items-center space-x-3"
        >
          <div className="bg-teal-600 text-white p-3 rounded-xl shadow-sm shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              {t.btnAnalytics}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Daily revenue & UPI split
            </p>
          </div>
        </button>

        {/* 6. Settings */}
        <button
          onClick={() => setActiveScreen('settings')}
          className="bg-white hover:bg-slate-50 p-4 rounded-xl border border-slate-200 text-left shadow-sm active:scale-95 transition flex items-center space-x-3"
        >
          <div className="bg-slate-800 text-white p-3 rounded-xl shadow-sm shrink-0">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              {t.btnSettings}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Language & shop profile
            </p>
          </div>
        </button>
      </div>

      {/* 4. RECENT BILLS SECTION */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b pb-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">
              {t.recentBills}
            </h3>
          </div>
          <button
            onClick={() => setActiveScreen('bill_history')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>{t.viewAll}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {bills.length === 0 ? (
          <p className="text-center text-slate-400 py-6 text-xs">
            {t.noBillsYet}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {bills.slice(0, 4).map((b) => (
              <div
                key={b.client_op_id}
                onClick={() => setSelectedBillForDetails(b)}
                className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{b.bill_no}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        b.sync_status === 'synced'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {b.sync_status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {b.customer_name || 'Walk-in'} • {b.items.length} items • <span className="uppercase">{b.payment_mode}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-black text-sm text-slate-900">₹{b.total_amount}</span>
                  <p className="text-[10px] text-slate-400">
                    {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
