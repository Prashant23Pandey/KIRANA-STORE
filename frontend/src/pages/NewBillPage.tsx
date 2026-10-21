import React, { useState } from 'react';
import {
  Mic,
  Camera,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  XCircle,
  PlusCircle,
  User,
  Phone,
  Tag,
  AlertCircle
} from 'lucide-react';
import type { Product, BillItem, LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';

interface NewBillPageProps {
  lang: LanguageCode;
  products: Product[];
  currentBillItems: BillItem[];
  setCurrentBillItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  paymentMode: 'cash' | 'upi' | 'credit' | 'card';
  setPaymentMode: (mode: 'cash' | 'upi' | 'credit' | 'card') => void;
  onProceedToReview: () => void;
  onOpenScanner: () => void;
}

export const NewBillPage: React.FC<NewBillPageProps> = ({
  lang,
  products,
  currentBillItems,
  setCurrentBillItems,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  paymentMode,
  setPaymentMode,
  onProceedToReview,
  onOpenScanner,
}) => {
  const t = getT(lang);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);

  // Manual item state
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('pc');

  // Categories extraction
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.name_hi && p.name_hi.includes(searchTerm)) ||
      (p.barcode && p.barcode.includes(searchTerm)) ||
      p.sku_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart operations
  const addItem = (product: Product) => {
    const displayName =
      lang === 'hi' && product.name_hi
        ? product.name_hi
        : product.name_en;

    const existingIndex = currentBillItems.findIndex((i) => i.product_id === product.id);
    if (existingIndex >= 0) {
      const updated = [...currentBillItems];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].total_price = Number((newQty * updated[existingIndex].unit_price).toFixed(2));
      setCurrentBillItems(updated);
    } else {
      const newItem: BillItem = {
        product_id: product.id,
        item_name: displayName,
        unit: product.unit,
        quantity: 1,
        unit_price: Number(product.price),
        total_price: Number(product.price),
      };
      setCurrentBillItems([...currentBillItems, newItem]);
    }
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeItem(index);
    } else {
      const updated = [...currentBillItems];
      updated[index].quantity = newQty;
      updated[index].total_price = Number((newQty * updated[index].unit_price).toFixed(2));
      setCurrentBillItems(updated);
    }
  };

  const removeItem = (index: number) => {
    setCurrentBillItems(currentBillItems.filter((_, idx) => idx !== index));
  };

  const handleClearDraft = () => {
    if (currentBillItems.length === 0) return;
    if (window.confirm(t.confirmClearDraft)) {
      setCurrentBillItems([]);
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(manualPrice);
    const qtyNum = parseFloat(manualQty);
    if (!manualName.trim() || isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter valid item name and price.');
      return;
    }

    const newItem: BillItem = {
      product_id: null, // Custom item
      item_name: manualName.trim(),
      unit: manualUnit,
      quantity: isNaN(qtyNum) || qtyNum <= 0 ? 1 : qtyNum,
      unit_price: priceNum,
      total_price: Number(((isNaN(qtyNum) ? 1 : qtyNum) * priceNum).toFixed(2)),
    };

    setCurrentBillItems([...currentBillItems, newItem]);
    setManualName('');
    setManualPrice('');
    setManualQty('1');
    setShowManualModal(false);
  };

  // Voice recognition simulation fallback
  const handleSimulateVoice = () => {
    // Find sample products to add
    const salt = products.find((p) => p.sku_code === 'SKU-001') || products[0];
    const maggi = products.find((p) => p.sku_code === 'SKU-004') || products[1];

    if (salt) addItem(salt);
    if (maggi) {
      addItem(maggi);
      // add second qty
      setTimeout(() => {
        addItem(maggi);
      }, 50);
    }
    setShowVoiceModal(false);
  };

  const subtotal = currentBillItems.reduce((sum, item) => sum + item.total_price, 0);
  const totalAmount = subtotal;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 1. LEFT COLUMN: SEARCH, VOICE, CATEGORIES & CATALOG (7 cols) */}
      <div className="lg:col-span-7 space-y-3">
        {/* Search & Action Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Voice Input Trigger */}
          <button
            onClick={() => setShowVoiceModal(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
            title={t.voiceInput}
          >
            <Mic className="w-4 h-4 text-emerald-700" />
            <span className="hidden sm:inline">Voice</span>
          </button>

          {/* Barcode Scanner Trigger */}
          <button
            onClick={onOpenScanner}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
            title={t.barcodeScanner}
          >
            <Camera className="w-4 h-4 text-indigo-700" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* Manual Custom Item Entry Trigger */}
          <button
            onClick={() => setShowManualModal(true)}
            className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
            title="Add Custom Item"
          >
            <PlusCircle className="w-4 h-4 text-blue-700" />
            <span className="hidden sm:inline">+ Item</span>
          </button>
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {cat === 'All' ? t.allCategories : cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="bg-slate-50/50 p-1 rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 text-xs">
                No matching products found. Use "+ Item" to add a custom product!
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isLow = Number(p.stock_qty) <= Number(p.low_stock_threshold);
                const title = lang === 'hi' && p.name_hi ? p.name_hi : p.name_en;

                return (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="bg-white hover:border-blue-500 hover:shadow-md p-3 rounded-xl border border-slate-200 text-left transition shadow-sm active:scale-95 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="uppercase font-semibold truncate max-w-[90px]">{p.category}</span>
                        {isLow && (
                          <span className="text-amber-600 font-bold bg-amber-50 px-1 rounded">Low</span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-tight">
                        {title}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-black text-sm text-blue-700">₹{p.price}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        /{p.unit}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2. RIGHT COLUMN: LIVE BILL CART & CHECKOUT (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
        <div>
          {/* Live Bill Header */}
          <div className="flex items-center justify-between border-b pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">
                {t.liveBillTitle}
              </h3>
              <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                {currentBillItems.length} {t.itemsCount}
              </span>
            </div>

            {currentBillItems.length > 0 && (
              <button
                onClick={handleClearDraft}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                title={t.clearDraft}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{t.clearDraft}</span>
              </button>
            )}
          </div>

          {/* Items Table / List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto mb-3 pr-1">
            {currentBillItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
                <Tag className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                <p>{t.emptyCartNotice}</p>
              </div>
            ) : (
              currentBillItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-bold text-slate-900 truncate">{item.item_name}</p>
                    <span className="text-slate-500 text-[11px]">
                      ₹{item.unit_price} / {item.unit}
                    </span>
                  </div>

                  {/* Quantity Stepper: - QTY + */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => updateQuantity(idx, item.quantity - 1)}
                      className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-bold flex items-center justify-center active:scale-95"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-black w-6 text-center text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(idx, item.quantity + 1)}
                      className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-bold flex items-center justify-center active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <span className="font-black text-slate-900 ml-3 w-14 text-right">
                    ₹{item.total_price}
                  </span>

                  {/* Delete Item */}
                  <button
                    onClick={() => removeItem(idx)}
                    className="ml-2 text-slate-400 hover:text-rose-600 p-1 transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Customer Metadata & Payment Mode */}
          <div className="border-t pt-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t.customerName}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.customerPhone}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Payment Mode Pills */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: 'cash', label: t.cash },
                { id: 'upi', label: t.upi },
                { id: 'credit', label: t.credit },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMode(m.id as any)}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                    paymentMode === m.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bill Total & Proceed Button */}
        <div className="border-t pt-3 mt-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-600">
              {t.grandTotal}
            </span>
            <span className="text-2xl font-black text-slate-900">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>

          <button
            disabled={currentBillItems.length === 0}
            onClick={onProceedToReview}
            className={`w-full py-3.5 rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition ${
              currentBillItems.length > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{t.proceedToReview}</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: ADD CUSTOM MANUAL ITEM */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900">
                Add Custom Item (मैन्युअल सामान जोड़ें)
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualItem} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Loose Chana Dal"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="e.g. 90"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                  <select
                    value={manualUnit}
                    onChange={(e) => setManualUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option value="pc">pc (नग)</option>
                    <option value="kg">kg (किलो)</option>
                    <option value="packet">packet (पैकेट)</option>
                    <option value="ltr">ltr (लीटर)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.5"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-bold shadow hover:bg-blue-700"
                >
                  Add to Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VOICE ENTRY SIMULATOR */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in duration-150">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center mb-3">
              <Mic className="w-7 h-7 animate-pulse text-emerald-600" />
            </div>

            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t.voiceInput}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t.voiceListening}
            </p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 text-left mb-4 space-y-1">
              <div className="flex items-center gap-1 font-semibold text-emerald-900">
                <AlertCircle className="w-4 h-4" />
                <span>Microphone status: Active</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Recognizes item names, quantities, and Hindi units automatically.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSimulateVoice}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow active:scale-95 transition"
              >
                {t.voiceSimulate}
              </button>

              <button
                onClick={() => setShowVoiceModal(false)}
                className="w-full py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
