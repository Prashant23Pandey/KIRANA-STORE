import React from 'react';
import { Home, PlusCircle, Boxes, Clock, Settings } from 'lucide-react';
import type { ScreenId, LanguageCode } from '../types/models';
import { getT } from '../utils/i18n';

interface BottomNavProps {
  activeScreen: ScreenId;
  setActiveScreen: (screen: ScreenId) => void;
  lang: LanguageCode;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeScreen,
  setActiveScreen,
  lang,
}) => {
  const t = getT(lang);

  const tabs: { id: ScreenId; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { id: 'home', icon: Home, label: t.navHome },
    { id: 'new_bill', icon: PlusCircle, label: t.navNewBill },
    { id: 'inventory', icon: Boxes, label: t.navInventory },
    { id: 'bill_history', icon: Clock, label: t.navHistory },
    { id: 'settings', icon: Settings, label: t.navSettings },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 py-2 px-3 shadow-lg z-30 flex items-center justify-around max-w-6xl mx-auto">
      {tabs.map((tab) => {
        const isActive = activeScreen === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveScreen(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 sm:px-5 rounded-xl transition active:scale-95 ${
              isActive
                ? 'text-blue-600 font-bold bg-blue-50'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="text-[11px] sm:text-xs leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
