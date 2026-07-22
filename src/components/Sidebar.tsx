'use client';

import React from 'react';
import {
  LayoutDashboard,
  PiggyBank,
  CreditCard,
  Calendar,
  DollarSign,
  MessageSquareCode,
  Calculator,
  Target,
  FileText,
  Settings,
  Database,
  QrCode
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notificationsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, notificationsCount }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'debts', label: 'Dívidas', icon: CreditCard },
    { id: 'reserve', label: 'Reserva Inteligente', icon: PiggyBank },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
    { id: 'payments', label: 'Pagamentos', icon: DollarSign },
    { id: 'ai', label: 'Assistente IA', icon: MessageSquareCode },
    { id: 'simulations', label: 'Simulador', icon: Calculator },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'settings', label: 'Configurações', icon: Settings }
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-200 h-screen sticky top-0">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800/60">
        <div className="bg-gradient-to-tr from-emerald-400 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center">
          <QrCode className="h-6 w-6 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="font-extrabold text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
            DataPay PWA
          </h1>
          <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400/80 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
            Inteligente
          </span>
        </div>
      </div>

      {/* Menu Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-5 w-5 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.id === 'settings' && notificationsCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                  {notificationsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sync Footer status */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800/40">
          <Database className="h-4 w-4 text-emerald-400" />
          <div className="text-left">
            <p className="text-[11px] font-medium text-slate-300">Banco de Dados</p>
            <p className="text-[9px] text-emerald-400/90 font-semibold">Local e MongoDB</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
