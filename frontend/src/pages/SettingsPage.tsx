import React, { useState } from 'react';
import {
  Settings,
  Store,
  Globe,
  Database,
  RefreshCw,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import type { LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';
import type { HealthCheckResult } from '../services/apiClient';

interface SettingsPageProps {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  health: HealthCheckResult;
  onRetestConnection: () => Promise<void>;
  onLoadDemoData: () => Promise<void>;
  isDemoData: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  lang,
  setLang,
  health,
  onRetestConnection,
  onLoadDemoData,
  isDemoData,
}) => {
  const t = getT(lang);

  const [storeName, setStoreName] = useState('DukaanSaathi Kirana Store');
  const [storeAddress, setStoreAddress] = useState('Shop No. 4, Main Bazaar Road');
  const [storePhone, setStorePhone] = useState('+91 98765 43210');
  const [storeUpi, setStoreUpi] = useState('kirana@upi');
  const [whatsappNote, setWhatsappNote] = useState('धन्यवाद! आपकी यात्रा शुभ हो। / Thank you!');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isRetesting, setIsRetesting] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRetest = async () => {
    setIsRetesting(true);
    await onRetestConnection();
    setIsRetesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          <span>{t.settingsTitle}</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure language, shop receipt details, and database connectivity
        </p>
      </div>

      {/* 2. Language Selector (Hindi, English, Hinglish) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <span>{t.languageLabel}</span>
        </h3>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: 'hi', label: 'हिन्दी', desc: 'पूरी तरह हिन्दी में' },
            { id: 'hinglish', label: 'Hinglish', desc: 'Bolchal Ki Bhasha' },
            { id: 'en', label: 'English', desc: 'Standard English' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setLang(item.id as LanguageCode)}
              className={`p-3 rounded-xl border-2 text-left transition active:scale-95 flex flex-col justify-between ${
                lang === item.id
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`font-black text-sm ${lang === item.id ? 'text-blue-700' : 'text-slate-800'}`}>
                {item.label}
              </span>
              <span className="text-[10px] text-slate-400 mt-1">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Store Profile & WhatsApp Note Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-2">
          <Store className="w-4 h-4 text-blue-600" />
          <span>Shop & Receipt Information</span>
        </h3>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">{t.storeName}</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">{t.storeAddress}</label>
          <input
            type="text"
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">{t.storePhone}</label>
            <input
              type="text"
              value={storePhone}
              onChange={(e) => setStorePhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">{t.storeUpi}</label>
            <input
              type="text"
              value={storeUpi}
              onChange={(e) => setStoreUpi(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">{t.whatsappTemplate}</label>
          <textarea
            rows={2}
            value={whatsappNote}
            onChange={(e) => setWhatsappNote(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
          />
        </div>

        <div className="pt-2 flex items-center justify-between">
          {savedSuccess && (
            <span className="text-emerald-700 font-bold flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings saved!</span>
            </span>
          )}
          <button
            type="submit"
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow active:scale-95 transition"
          >
            Save Store Profile
          </button>
        </div>
      </form>

      {/* 4. MySQL Server Connectivity & Diagnostics */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <span>{t.serverConnection}</span>
        </h3>

        <div className="bg-slate-50 border rounded-xl p-3.5 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">MySQL Connection:</span>
            <span className={`font-bold ${health.isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
              {health.isOnline ? 'CONNECTED (Port 3306)' : 'UNREACHABLE'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">MySQL Server Version:</span>
            <span className="text-slate-900 font-bold">{health.dbVersion || '9.1.0'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">PHP API Runtime:</span>
            <span className="text-slate-900">{health.phpVersion || '8.2.26'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Database Name:</span>
            <span className="text-slate-900">dukaansaathi_db</span>
          </div>
        </div>

        <button
          onClick={handleRetest}
          disabled={isRetesting}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetesting ? 'animate-spin' : ''}`} />
          <span>{isRetesting ? 'Testing...' : t.checkConnection}</span>
        </button>
      </div>

      {/* 5. Safe Demo Data Action */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>{t.loadDemoData}</span>
        </div>
        <p className="text-xs text-amber-800">
          {t.demoNotice}
        </p>
        <button
          onClick={onLoadDemoData}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow active:scale-95 transition"
        >
          {isDemoData ? 'Re-load Demo Data' : t.loadDemoData}
        </button>
      </div>
    </div>
  );
};
