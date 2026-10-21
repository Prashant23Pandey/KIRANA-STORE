import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Receipt,
  Store,
  ArrowLeft
} from 'lucide-react';
import type { BillItem, LanguageCode, PaymentMode } from '../types/models';
import { getT } from '../utils/i18n';

interface BillReviewPageProps {
  lang: LanguageCode;
  items: BillItem[];
  customerName: string;
  customerPhone: string;
  paymentMode: PaymentMode;
  onConfirmAndFinalize: () => void;
  onBackToEdit: () => void;
  isSubmitting?: boolean;
}

export const BillReviewPage: React.FC<BillReviewPageProps> = ({
  lang,
  items,
  customerName,
  customerPhone,
  paymentMode,
  onConfirmAndFinalize,
  onBackToEdit,
  isSubmitting = false,
}) => {
  const t = getT(lang);

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const discount = 0;
  const grandTotal = subtotal - discount;

  const temporaryBillNo = 'DS-' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Banner Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between text-blue-900">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <h3 className="font-bold text-sm">{t.reviewTitle}</h3>
            <p className="text-xs text-blue-700">{t.reviewSubtitle}</p>
          </div>
        </div>
        <button
          onClick={onBackToEdit}
          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Edit Draft</span>
        </button>
      </div>

      {/* FULL ITEMIZED RECEIPT PREVIEW (White Paper Card Style) */}
      <div className="bg-white rounded-2xl border border-slate-300 p-5 sm:p-6 shadow-sm space-y-4">
        {/* Receipt Header */}
        <div className="text-center border-b pb-4 space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-black text-lg text-slate-900">
            <Store className="w-5 h-5 text-blue-600" />
            <span>DUKAAN SAATHI KIRANA STORE</span>
          </div>
          <p className="text-xs text-slate-500">
            Main Market Road, Near Post Office • Ph: +91 98765 43210
          </p>
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            {t.receiptHeader}
          </span>
        </div>

        {/* Bill Metadata */}
        <div className="grid grid-cols-2 text-xs text-slate-600 gap-2 border-b pb-3">
          <div>
            <span className="font-semibold">{t.billNumber}:</span>{' '}
            <span className="font-mono font-bold text-slate-900">{temporaryBillNo}</span>
          </div>
          <div className="text-right">
            <span className="font-semibold">{t.billDate}:</span>{' '}
            <span>{now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div>
            <span className="font-semibold">Customer:</span>{' '}
            <span className="font-bold text-slate-900">{customerName || 'Walk-in Customer'}</span>
          </div>
          <div className="text-right">
            <span className="font-semibold">Mobile:</span>{' '}
            <span>{customerPhone || 'N/A'}</span>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-300 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2">Item</th>
                <th className="py-2 text-center">Unit</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 font-bold text-slate-900">{item.item_name}</td>
                  <td className="py-2.5 text-center text-slate-500">{item.unit}</td>
                  <td className="py-2.5 text-center font-bold text-slate-900">{item.quantity}</td>
                  <td className="py-2.5 text-right text-slate-600">₹{item.unit_price}</td>
                  <td className="py-2.5 text-right font-black text-slate-900">₹{item.total_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Calculation */}
        <div className="border-t border-slate-300 pt-3 space-y-1.5 text-xs text-slate-700">
          <div className="flex justify-between">
            <span>{t.subtotal} ({items.length} items):</span>
            <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>{t.discount}:</span>
              <span>-₹{discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm sm:text-base font-black text-slate-900 border-t border-slate-200 pt-2">
            <span>{t.grandTotal}:</span>
            <span className="text-xl sm:text-2xl text-blue-700">₹{grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 pt-1">
            <span>{t.paymentModeLabel}:</span>
            <span className="uppercase font-bold text-slate-800">{paymentMode}</span>
          </div>
        </div>
      </div>

      {/* EXPLICIT MANDATORY CONFIRMATION ACTIONS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* NO: Change Bill (Red/Neutral Action) */}
        <button
          type="button"
          onClick={onBackToEdit}
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95"
        >
          <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{t.noChange}</span>
        </button>

        {/* YES: Confirm Bill (Green Success Action) */}
        <button
          type="button"
          onClick={onConfirmAndFinalize}
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{isSubmitting ? 'Saving...' : t.yesCorrect}</span>
        </button>
      </div>
    </div>
  );
};
