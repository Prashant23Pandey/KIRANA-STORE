import React from 'react';
import {
  Smartphone,
  RefreshCw,
  QrCode
} from 'lucide-react';
import type { LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';
import type { HealthCheckResult } from '../services/apiClient';

interface DeviceSyncPageProps {
  lang: LanguageCode;
  health: HealthCheckResult;
  pendingCount: number;
  isSyncing: boolean;
  onManualSync: () => Promise<void>;
}

export const DeviceSyncPage: React.FC<DeviceSyncPageProps> = ({
  lang,
  pendingCount,
  isSyncing,
  onManualSync,
}) => {
  const t = getT(lang);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 1. Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-center sm:text-left">
          <div className="bg-emerald-100 text-emerald-700 p-3 rounded-2xl shrink-0">
            <Smartphone className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {t.syncTitle}
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mt-0.5">
              {t.syncSubtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onManualSync}
          disabled={isSyncing}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? t.syncing : t.syncNow}</span>
        </button>
      </div>

      {/* 2. Device Status Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b pb-2">
          {t.pairedDevices}
        </h3>

        <div className="space-y-2.5">
          {/* This Device */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <div>
                <p className="font-bold text-xs text-slate-900">
                  Counter 1 (This Phone / Main Billing)
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  Device ID: counter_01 • Role: Primary POS
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-blue-200 text-blue-900 font-black px-2 py-0.5 rounded">
              CURRENT
            </span>
          </div>

          {/* Counter 2 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div>
                <p className="font-bold text-xs text-slate-900">
                  Counter 2 (Assistant Cashier Phone)
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  Device ID: counter_02 • IP: 192.168.1.104
                </span>
              </div>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
              ONLINE
            </span>
          </div>

          {/* Godown Tablet */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <div>
                <p className="font-bold text-xs text-slate-900">
                  Godown Tablet (Stock Inward Entry)
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  Device ID: godown_tab • Last Sync: 25 mins ago
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-600 font-bold bg-slate-200 px-2 py-0.5 rounded">
              STANDBY
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sync Status & Pending Operations Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 border-b pb-2">
          {t.pendingOperations}
        </h3>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border text-xs">
          <div>
            <span className="font-bold text-slate-900">{pendingCount} operations waiting in queue</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Operations are safely stored in IndexedDB and automatically pushed when MySQL connects.
            </p>
          </div>
          <span className={`text-sm font-black ${pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {pendingCount > 0 ? `${pendingCount} PENDING` : 'ALL SYNCED'}
          </span>
        </div>

        {/* Pairing QR Code Container */}
        <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-2">
          <QrCode className="w-12 h-12 text-slate-400 mx-auto" />
          <h4 className="font-bold text-xs text-slate-800">
            {t.connectPeer}
          </h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Scan this QR code from another phone on the same Wi-Fi / Hotspot to coordinate billing without internet.
          </p>
        </div>
      </div>
    </div>
  );
};
