import React, { useState } from 'react';
import { Camera, XCircle, AlertCircle } from 'lucide-react';
import type { Product, LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';

interface BarcodeScannerModalProps {
  lang: LanguageCode;
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onProductScanned: (product: Product) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  lang,
  products,
  isOpen,
  onClose,
  onProductScanned,
}) => {
  const t = getT(lang);
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLookup = (code: string) => {
    setErrorMsg('');
    const trimmed = code.trim();
    if (!trimmed) return;

    const found = products.find((p) => p.barcode === trimmed || p.sku_code === trimmed);
    if (found) {
      onProductScanned(found);
      setManualCode('');
      onClose();
    } else {
      setErrorMsg(`Barcode "${trimmed}" not found in store catalog.`);
    }
  };

  const sampleBarcodes = [
    { label: 'Tata Salt', code: '8901030383701' },
    { label: 'Maggi Noodles', code: '8901058852333' },
    { label: 'Parle-G', code: '8901719101014' },
    { label: 'Amul Milk', code: '8901262010052' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <span>{t.barcodeScanner}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Simulation Frame */}
        <div className="relative bg-slate-950 rounded-xl h-44 flex flex-col items-center justify-center text-slate-400 overflow-hidden border-2 border-indigo-500">
          <div className="absolute inset-8 border border-white/40 rounded-lg pointer-events-none flex items-center justify-center">
            <div className="w-full h-0.5 bg-rose-500/80 animate-bounce" />
          </div>
          <Camera className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-[11px] text-slate-300 font-medium">Align barcode inside red line</p>
          <span className="text-[9px] text-slate-500 mt-0.5">Continuous auto-scan active</span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Manual Barcode Entry Fallback Form */}
        <div className="space-y-1.5 text-xs">
          <label className="font-semibold text-slate-700 block">
            Manual Barcode Entry (मैन्युअल बारकोड दर्ज करें):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup(manualCode)}
              placeholder="e.g. 8901030383701"
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => handleLookup(manualCode)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition"
            >
              Lookup
            </button>
          </div>
        </div>

        {/* Quick Test Barcode Buttons */}
        <div className="border-t pt-2.5">
          <span className="text-[10px] text-slate-400 font-semibold block mb-1.5">
            Quick Test Barcodes:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sampleBarcodes.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => handleLookup(item.code)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 rounded text-[10px] font-bold transition"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
