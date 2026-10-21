import React, { useState } from 'react';
import {
  Clock,
  Search,
  XCircle,
} from 'lucide-react';
import type { Bill, LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';

interface BillHistoryPageProps {
  lang: LanguageCode;
  bills: Bill[];
  selectedBillForDetails: Bill | null;
  setSelectedBillForDetails: (bill: Bill | null) => void;
}

export const BillHistoryPage: React.FC<BillHistoryPageProps> = ({
  lang,
  bills,
  selectedBillForDetails,
  setSelectedBillForDetails,
}) => {
  const t = getT(lang);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'cash' | 'upi'>('all');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.bill_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.customer_phone && b.customer_phone.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterMode === 'today') {
      return new Date(b.created_at).getTime() >= todayStart.getTime();
    }
    if (filterMode === 'cash') {
      return b.payment_mode === 'cash';
    }
    if (filterMode === 'upi') {
      return b.payment_mode === 'upi';
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-slate-700" />
            <span>{t.historyTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {bills.length} total customer receipts stored locally & synced
          </p>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by bill #, customer name or phone..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: t.filterAll },
            { id: 'today', label: t.filterToday },
            { id: 'cash', label: t.filterCash },
            { id: 'upi', label: t.filterUpi },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                filterMode === f.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Bills List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
        {filteredBills.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No bills found matching your search.
          </div>
        ) : (
          filteredBills.map((b) => (
            <div
              key={b.client_op_id}
              onClick={() => setSelectedBillForDetails(b)}
              className="p-4 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-900">{b.bill_no}</span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      b.sync_status === 'synced'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {b.sync_status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    {b.client_op_id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Customer: <span className="font-semibold text-slate-700">{b.customer_name || 'Walk-in'}</span> • {b.items.length} items • <span className="uppercase font-semibold">{b.payment_mode}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="text-right sm:border-l sm:pl-4">
                <span className="text-xl font-black text-slate-900">₹{b.total_amount}</span>
                <button
                  type="button"
                  className="text-xs text-blue-600 font-bold hover:underline block sm:mt-1"
                >
                  {t.viewBillDetails} &rarr;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. BILL DETAILS MODAL */}
      {selectedBillForDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Bill Receipt #{selectedBillForDetails.bill_no}
                </h3>
                <p className="text-xs text-slate-500">
                  {new Date(selectedBillForDetails.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedBillForDetails(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Details Strip */}
            <div className="bg-slate-50 p-3 rounded-xl border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">{selectedBillForDetails.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span>{selectedBillForDetails.customer_phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span className="uppercase font-bold text-blue-700">{selectedBillForDetails.payment_mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sync Status:</span>
                <span className="uppercase font-bold text-emerald-700">{selectedBillForDetails.sync_status}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Items ({selectedBillForDetails.items.length})
              </h4>
              <div className="border rounded-xl divide-y text-xs">
                {selectedBillForDetails.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{item.item_name}</p>
                      <span className="text-slate-400 text-[11px]">
                        ₹{item.unit_price} x {item.quantity} {item.unit}
                      </span>
                    </div>
                    <span className="font-black text-slate-900">₹{item.total_price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-semibold">₹{selectedBillForDetails.subtotal}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t pt-2">
                <span>Grand Total:</span>
                <span className="text-blue-700">₹{selectedBillForDetails.total_amount}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedBillForDetails(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
