import React, { useState } from 'react';
import {
  BarChart3,
  CreditCard,
  Banknote,
  Award
} from 'lucide-react';
import type { Bill, LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';

interface AnalyticsPageProps {
  lang: LanguageCode;
  bills: Bill[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  lang,
  bills,
}) => {
  const t = getT(lang);

  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today');

  // Filter bills based on selected window
  const now = new Date();
  const filteredBills = bills.filter((b) => {
    const billTime = new Date(b.created_at).getTime();
    if (timeFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return billTime >= startOfDay;
    }
    if (timeFilter === 'week') {
      const oneWeekAgo = now.getTime() - 7 * 86400000;
      return billTime >= oneWeekAgo;
    }
    if (timeFilter === 'month') {
      const oneMonthAgo = now.getTime() - 30 * 86400000;
      return billTime >= oneMonthAgo;
    }
    return true;
  });

  const totalRevenue = filteredBills.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const totalBillsCount = filteredBills.length;
  const averageBillValue = totalBillsCount > 0 ? totalRevenue / totalBillsCount : 0;

  // Payment Breakdown
  const cashBills = filteredBills.filter((b) => b.payment_mode === 'cash');
  const upiBills = filteredBills.filter((b) => b.payment_mode === 'upi');
  const creditBills = filteredBills.filter((b) => b.payment_mode === 'credit');

  const cashAmount = cashBills.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const upiAmount = upiBills.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const creditAmount = creditBills.reduce((sum, b) => sum + Number(b.total_amount), 0);

  // Top Selling Items count
  const itemMap: { [name: string]: { qty: number; revenue: number } } = {};
  filteredBills.forEach((b) => {
    b.items.forEach((item) => {
      if (!itemMap[item.item_name]) {
        itemMap[item.item_name] = { qty: 0, revenue: 0 };
      }
      itemMap[item.item_name].qty += Number(item.quantity);
      itemMap[item.item_name].revenue += Number(item.total_price);
    });
  });

  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* 1. Top Header with Time Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-600" />
            <span>{t.analyticsTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated from actual locally recorded receipts
          </p>
        </div>

        {/* Time Tabs */}
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm self-start sm:self-auto">
          {[
            { id: 'today', label: t.today },
            { id: 'week', label: t.thisWeek },
            { id: 'month', label: t.thisMonth },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                timeFilter === tab.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Primary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500">{t.totalRevenue}</span>
          <p className="text-3xl font-black text-slate-900 mt-1">₹{totalRevenue.toFixed(0)}</p>
          <span className="text-[11px] text-teal-700 font-bold mt-2">
            From {totalBillsCount} total sales bills
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500">{t.averageBill}</span>
          <p className="text-3xl font-black text-slate-900 mt-1">₹{averageBillValue.toFixed(0)}</p>
          <span className="text-[11px] text-slate-500 mt-2">
            Average ticket size
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500">Total Billed Items</span>
          <p className="text-3xl font-black text-blue-700 mt-1">
            {filteredBills.reduce((sum, b) => sum + b.items.length, 0)}
          </p>
          <span className="text-[11px] text-slate-500 mt-2">
            Units moved across counter
          </span>
        </div>
      </div>

      {/* 3. Payment Mode Split Breakdown (Accessible Real Progress Bars) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center justify-between">
          <span>{t.paymentSplit}</span>
          <span className="text-xs text-slate-400 font-normal">Real breakdown</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Cash */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1">
              <span className="flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-700" />
                <span>Cash (Rokad)</span>
              </span>
              <span>₹{cashAmount}</span>
            </div>
            <p className="text-[11px] text-emerald-700">
              {cashBills.length} transactions ({totalRevenue > 0 ? ((cashAmount / totalRevenue) * 100).toFixed(0) : 0}%)
            </p>
          </div>

          {/* UPI */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-1">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-700" />
                <span>UPI / QR</span>
              </span>
              <span>₹{upiAmount}</span>
            </div>
            <p className="text-[11px] text-blue-700">
              {upiBills.length} transactions ({totalRevenue > 0 ? ((upiAmount / totalRevenue) * 100).toFixed(0) : 0}%)
            </p>
          </div>

          {/* Credit */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
              <span>Credit (Khata)</span>
              <span>₹{creditAmount}</span>
            </div>
            <p className="text-[11px] text-amber-800">
              {creditBills.length} transactions ({totalRevenue > 0 ? ((creditAmount / totalRevenue) * 100).toFixed(0) : 0}%)
            </p>
          </div>
        </div>
      </div>

      {/* 4. Top Selling Items */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span>{t.topSellingItems}</span>
        </h3>

        {topItems.length === 0 ? (
          <p className="text-center text-slate-400 py-6 text-xs">
            No sales recorded during this timeframe.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {topItems.map(([name, data], idx) => (
              <div key={name} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-100 font-black text-slate-600 flex items-center justify-center text-[11px]">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{name}</p>
                    <span className="text-[11px] text-slate-400">Total Qty: {data.qty} units</span>
                  </div>
                </div>
                <span className="font-black text-slate-900 text-sm">
                  ₹{data.revenue.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
