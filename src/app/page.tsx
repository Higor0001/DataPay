'use client';

import React, { useState } from 'react';
import { StateProvider, useAppState } from '../context/StateContext';
import { Sidebar } from '../components/Sidebar';
import { BottomNav } from '../components/BottomNav';
import { DashboardView } from '../components/DashboardView';
import { DebtsView } from '../components/DebtsView';
import { ReserveView } from '../components/ReserveView';
import { CalendarView } from '../components/CalendarView';
import { PaymentsView } from '../components/PaymentsView';
import { AIView } from '../components/AIView';
import { SimulationsView } from '../components/SimulationsView';
import { GoalsView } from '../components/GoalsView';
import { ReportsView } from '../components/ReportsView';
import { SettingsView } from '../components/SettingsView';
import { Bell, QrCode } from 'lucide-react';

function InnerPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { notifications, clearNotification } = useAppState();

  const unreadNotifications = notifications.filter((n) => !n.read);
  const notificationsCount = unreadNotifications.length;

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'debts':
        return <DebtsView />;
      case 'reserve':
        return <ReserveView />;
      case 'calendar':
        return <CalendarView />;
      case 'payments':
        return <PaymentsView />;
      case 'ai':
        return <AIView />;
      case 'simulations':
        return <SimulationsView />;
      case 'goals':
        return <GoalsView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-1 h-screen overflow-hidden bg-slate-950 font-sans">
      
      {/* Desktop Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notificationsCount={notificationsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Mobile Header Bar */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800/80 z-20">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg flex items-center justify-center">
              <QrCode className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className="font-extrabold text-sm text-white tracking-tight">DataPay</h1>
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className="relative p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer"
          >
            <Bell className="h-4.5 w-4.5" />
            {notificationsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                {notificationsCount}
              </span>
            )}
          </button>
        </header>

        {/* View Layout Renderer */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderActiveView()}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notificationsCount={notificationsCount}
        />

      </div>

      {/* Hidden button anchors for cross-module programatic redirection triggers */}
      <div className="hidden">
        <button id="ai" onClick={() => setActiveTab('ai')}>AI</button>
        <button id="reserve" onClick={() => setActiveTab('reserve')}>Reserve</button>
      </div>

    </div>
  );
}

export default function Home() {
  return (
    <StateProvider>
      <InnerPage />
    </StateProvider>
  );
}
