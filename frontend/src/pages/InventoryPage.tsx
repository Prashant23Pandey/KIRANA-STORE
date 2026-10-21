import React, { useState } from 'react';
import {
  Boxes,
  Search,
  PlusCircle,
  Camera,
  AlertTriangle,
  ArrowDownToLine,
  SlidersHorizontal,
  XCircle
} from 'lucide-react';
import type { Product, LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';

interface InventoryPageProps {
  lang: LanguageCode;
  products: Product[];
  onAddProduct: (newProduct: Partial<Product>) => Promise<void>;
  onReceiveStock: (productId: number, addQty: number) => Promise<void>;
  onAdjustStock: (productId: number, exactQty: number) => Promise<void>;
  onOpenScanner: () => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  lang,
  products,
  onAddProduct,
  onReceiveStock,
  onAdjustStock,
  onOpenScanner,
}) => {
  const t = getT(lang);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalMode, setStockModalMode] = useState<'receive' | 'adjust'>('receive');
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [stockInputQty, setStockInputQty] = useState('');

  // Add Product form state
  const [addNameEn, setAddNameEn] = useState('');
  const [addNameHi, setAddNameHi] = useState('');
  const [addCategory, setAddCategory] = useState('Groceries');
  const [addBarcode, setAddBarcode] = useState('');
  const [addUnit, setAddUnit] = useState<'pc' | 'kg' | 'packet' | 'ltr'>('packet');
  const [addPrice, setAddPrice] = useState('');
  const [addCostPrice, setAddCostPrice] = useState('');
  const [addStockQty, setAddStockQty] = useState('');
  const [addThreshold, setAddThreshold] = useState('5');

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.name_hi && p.name_hi.includes(searchTerm)) ||
      (p.barcode && p.barcode.includes(searchTerm)) ||
      p.sku_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleOpenReceiveModal = (p: Product) => {
    setTargetProduct(p);
    setStockModalMode('receive');
    setStockInputQty('10');
    setShowStockModal(true);
  };

  const handleOpenAdjustModal = (p: Product) => {
    setTargetProduct(p);
    setStockModalMode('adjust');
    setStockInputQty(p.stock_qty.toString());
    setShowStockModal(true);
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;
    const qty = parseFloat(stockInputQty);
    if (isNaN(qty)) return;

    if (stockModalMode === 'receive') {
      await onReceiveStock(targetProduct.id, qty);
    } else {
      await onAdjustStock(targetProduct.id, qty);
    }

    setShowStockModal(false);
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(addPrice);
    if (!addNameEn.trim() || isNaN(priceNum) || priceNum <= 0) {
      alert('Please provide valid product name and price.');
      return;
    }

    const newProd: Partial<Product> = {
      sku_code: 'SKU-' + Date.now().toString().slice(-6),
      barcode: addBarcode.trim() || null,
      name_en: addNameEn.trim(),
      name_hi: addNameHi.trim() || null,
      category: addCategory,
      unit: addUnit,
      price: priceNum,
      cost_price: parseFloat(addCostPrice) || (priceNum * 0.85),
      stock_qty: parseFloat(addStockQty) || 0,
      low_stock_threshold: parseFloat(addThreshold) || 5,
    };

    await onAddProduct(newProd);
    setShowAddModal(false);

    // Reset
    setAddNameEn('');
    setAddNameHi('');
    setAddBarcode('');
    setAddPrice('');
    setAddCostPrice('');
    setAddStockQty('');
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-500" />
            <span>{t.inventoryTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {products.length} products registered in store catalog
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenScanner}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <Camera className="w-4 h-4 text-indigo-600" />
            <span>Scan Barcode</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.addProduct}</span>
          </button>
        </div>
      </div>

      {/* 2. SEARCH & CATEGORY FILTER */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchInventory}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. PRODUCT ROWS / TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Item & Code</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Stock Level</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = Number(p.stock_qty) <= Number(p.low_stock_threshold);
                  const isOut = Number(p.stock_qty) <= 0;
                  const displayName = lang === 'hi' && p.name_hi ? p.name_hi : p.name_en;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">{displayName}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-mono">{p.sku_code}</span>
                          {p.barcode && <span>• {p.barcode}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {p.category}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                        ₹{p.price}
                        <span className="text-[10px] text-slate-400 block font-normal">/{p.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-800 text-sm">
                        {p.stock_qty}{' '}
                        <span className="text-[10px] font-normal text-slate-500">{p.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isOut ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {t.outOfStock}
                          </span>
                        ) : isLow ? (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{t.lowStock}</span>
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {t.inStock}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Receive Stock Action */}
                          <button
                            onClick={() => handleOpenReceiveModal(p)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 active:scale-95 transition"
                            title={t.receiveStock}
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5 text-amber-700" />
                            <span className="hidden sm:inline">Receive</span>
                          </button>

                          {/* Adjust Stock Action */}
                          <button
                            onClick={() => handleOpenAdjustModal(p)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 active:scale-95 transition"
                            title={t.adjustStock}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                            <span className="hidden sm:inline">Adjust</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD PRODUCT FORM */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <span>{t.addProduct}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Name (English) *</label>
                <input
                  type="text"
                  required
                  value={addNameEn}
                  onChange={(e) => setAddNameEn(e.target.value)}
                  placeholder="e.g. Tata Tea Gold 250g"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Name (Hindi / हिन्दी)</label>
                <input
                  type="text"
                  value={addNameHi}
                  onChange={(e) => setAddNameHi(e.target.value)}
                  placeholder="उदा. टाटा टी गोल्ड २५० ग्राम"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Biscuits">Biscuits</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Household">Household</option>
                    <option value="Personal Care">Personal Care</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                  <select
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option value="packet">packet (पैकेट)</option>
                    <option value="pc">pc (नग)</option>
                    <option value="kg">kg (किलो)</option>
                    <option value="ltr">ltr (लीटर)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={addCostPrice}
                    onChange={(e) => setAddCostPrice(e.target.value)}
                    placeholder="e.g. 132"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    value={addStockQty}
                    onChange={(e) => setAddStockQty(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    value={addThreshold}
                    onChange={(e) => setAddThreshold(e.target.value)}
                    placeholder="5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Barcode (EAN-13)</label>
                <input
                  type="text"
                  value={addBarcode}
                  onChange={(e) => setAddBarcode(e.target.value)}
                  placeholder="e.g. 8901052002130"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow"
                >
                  {t.saveProduct}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVE / ADJUST STOCK MODAL */}
      {showStockModal && targetProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                {stockModalMode === 'receive' ? (
                  <>
                    <ArrowDownToLine className="w-5 h-5 text-amber-500" />
                    <span>{t.receiveStock}</span>
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                    <span>{t.adjustStock}</span>
                  </>
                )}
              </h3>
              <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border mb-3 text-xs">
              <p className="font-bold text-slate-900">{targetProduct.name_en}</p>
              <div className="flex justify-between text-slate-500 mt-1">
                <span>Current Stock:</span>
                <span className="font-bold text-slate-800">{targetProduct.stock_qty} {targetProduct.unit}</span>
              </div>
            </div>

            <form onSubmit={handleStockSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {stockModalMode === 'receive' ? 'Quantity Received (+)' : 'New Corrected Total Stock'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={stockInputQty}
                  onChange={(e) => setStockInputQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-base font-bold text-slate-900 text-center"
                />
              </div>

              {/* Quick Adder Chips for Receive Mode */}
              {stockModalMode === 'receive' && (
                <div className="flex gap-2 justify-center">
                  {[5, 10, 25, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setStockInputQty(num.toString())}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-xs"
                    >
                      +{num}
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl font-bold text-white shadow ${
                    stockModalMode === 'receive'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
