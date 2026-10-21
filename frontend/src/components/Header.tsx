import React from 'react';
import { Store, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';
import type { HealthCheckResult } from '../services/apiClient';

interface HeaderProps {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  health: HealthCheckResult;
  pendingCount: number;
  isSyncing: boolean;
  onManualSync: () => void;
  isDemoData?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  health,
  pendingCount,
  isSyncing,
  onManualSync,
  isDemoData = false,
}) => {
  const t = getT(lang);

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo and Shopkeeper Branding */}
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-xl flex items-center justify-center shadow-sm">
            <Store className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
                {t.appName}
              </h1>
              {isDemoData && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Status Pills, Language, and Sync Control */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Online/Offline Status */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              health.isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={health.isOnline ? `MySQL 9.1 Connected` : `Working Offline with local IndexedDB`}
          >
            {health.isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
            <span className="hidden md:inline">
              {health.isOnline ? t.online : t.offline}
            </span>
            <span className="md:hidden">
              {health.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Pending Sync Trigger */}
          {pendingCount > 0 && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95 shadow-sm"
              title="Click to push offline changes to MySQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{pendingCount} {t.pendingSync}</span>
            </button>
          )}

          {/* Language Selector: English, Hindi, Hinglish */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setLang('hi')}
              className={`px-2 py-1 text-xs font-bold rounded-md transition ${
                lang === 'hi'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              हिन्दी
            </button>
            <button
              onClick={() => setLang('hinglish')}
              className={`px-2 py-1 text-xs font-bold rounded-md transition ${
                lang === 'hinglish'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hinglish
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-1 text-xs font-bold rounded-md transition ${
                lang === 'en'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
