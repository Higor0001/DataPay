'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  PiggyBank,
  CreditCard,
  MessageSquareCode,
  Menu,
  Calendar,
  DollarSign,
  Calculator,
  Target,
  FileText,
  Settings,
  X
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notificationsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, notificationsCount }) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'debts', label: 'Dívidas', icon: CreditCard },
    { id: 'reserve', label: 'Reserva', icon: PiggyBank },
    { id: 'ai', label: 'IA Chat', icon: MessageSquareCode }
  ];

  const moreTabs = [
    { id: 'calendar', label: 'Calendário', icon: Calendar },
    { id: 'payments', label: 'Pagamentos', icon: DollarSign },
    { id: 'simulations', label: 'Simulador', icon: Calculator },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'settings', label: 'Ajustes', icon: Settings }
  ];

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    setShowMoreMenu(false);
  };

  const isMoreActive = moreTabs.some((tab) => tab.id === activeTab);

  return (
    <>
      {/* Mobile Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 pb-safe-bottom">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id && !showMoreMenu;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
                }`}
              >
                <Icon className={`h-5.5 w-5.5 ${isActive ? 'scale-110 text-indigo-400' : ''}`} />
                <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 relative ${
              showMoreMenu || isMoreActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {notificationsCount > 0 && !showMoreMenu && (
              <span className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-bold h-2.5 w-2.5 rounded-full" />
            )}
            {showMoreMenu ? (
              <X className="h-5.5 w-5.5 scale-110 text-indigo-400" />
            ) : (
              <Menu className={`h-5.5 w-5.5 ${isMoreActive ? 'text-indigo-400' : ''}`} />
            )}
            <span className="text-[10px] mt-1 tracking-tight">Mais</span>
          </button>
        </div>
      </div>

      {/* Drawer Menu for "More" options */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute bottom-20 left-4 right-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase">Outros Módulos</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {moreTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400'
                        : 'bg-slate-800/40 border-slate-800/80 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`h-5.5 w-5.5 mb-1.5 ${isActive ? 'text-indigo-400' : 'text-slate-300'}`} />
                    <span className="text-[10.5px] font-medium tracking-tight text-center truncate w-full">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
