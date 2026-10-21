import React from 'react';
import {
  CheckCircle2,
  Share2,
  Printer,
  PlusCircle
} from 'lucide-react';
import type { Bill, LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';

interface SendReceiptPageProps {
  lang: LanguageCode;
  bill: Bill | null;
  onStartNewBill: () => void;
}

export const SendReceiptPage: React.FC<SendReceiptPageProps> = ({
  lang,
  bill,
  onStartNewBill,
}) => {
  const t = getT(lang);

  if (!bill) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white rounded-xl border p-6">
        <p className="text-slate-500 text-sm">No bill selected.</p>
        <button
          onClick={onStartNewBill}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
        >
          {t.createNextBill}
        </button>
      </div>
    );
  }

  // Generate formatted WhatsApp message text
  const storeName = 'DukaanSaathi Kirana';
  const itemListText = bill.items
    .map((item) => `• ${item.item_name} x ${item.quantity} = ₹${item.total_price}`)
    .join('\n');

  const whatsappMessage =
`*${storeName} - Bill Receipt*
Bill No: ${bill.bill_no}
Date: ${new Date(bill.created_at).toLocaleDateString()} ${new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
Customer: ${bill.customer_name || 'Valued Customer'}
----------------------------
${itemListText}
----------------------------
*Total Payable: ₹${bill.total_amount}*
Payment Mode: ${bill.payment_mode.toUpperCase()}
Status: PAID

Thank you for your visit! / धन्यवाद!`;

  const cleanPhone = (bill.customer_phone || '').replace(/\D/g, '');
  const phoneParam = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const whatsappUrl = `https://wa.me/${phoneParam}?text=${encodeURIComponent(whatsappMessage)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* 1. Success Celebration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm space-y-3">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-xl font-black text-slate-900">
            {t.savedSuccess}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {t.savedDesc}
          </p>
        </div>

        {/* Bill Summary Strip */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs space-y-1.5 font-medium">
          <div className="flex justify-between">
            <span className="text-slate-500">{t.billNumber}:</span>
            <span className="font-bold text-slate-900 font-mono">{bill.bill_no}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-bold text-slate-900">{bill.customer_name || 'Walk-in'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Items:</span>
            <span className="font-bold text-slate-900">{bill.items.length} items</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-black text-slate-900">
            <span>{t.grandTotal}:</span>
            <span className="text-blue-700">₹{bill.total_amount}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
            <span>Sync Status:</span>
            <span className={`font-bold uppercase ${bill.sync_status === 'synced' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {bill.sync_status === 'synced' ? 'Synced to MySQL' : 'Saved Locally (Pending Sync)'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. ACTIONS: WHATSAPP SHARE, PRINT, NEW BILL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
        {/* WhatsApp Share Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow transition active:scale-95"
        >
          <Share2 className="w-5 h-5" />
          <span>{t.sendWhatsapp}</span>
        </a>

        {/* Print Receipt Action */}
        <button
          onClick={handlePrint}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95"
        >
          <Printer className="w-4 h-4 text-slate-600" />
          <span>{t.printReceipt}</span>
        </button>

        {/* Start Next Bill Primary Action */}
        <button
          onClick={onStartNewBill}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow transition active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span>{t.createNextBill}</span>
        </button>
      </div>
    </div>
  );
};
