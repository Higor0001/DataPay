'use client';

import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import { Debt, Payment } from '../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PiggyBank,
  Plus
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  type: 'pago' | 'proximo' | 'atrasado' | 'reserva';
  title: string;
  amount: number;
  bank: string;
  time?: string;
}

export const CalendarView: React.FC = () => {
  const { debts, payments, reserve } = useAppState();
  const [currentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6); // 6 is July (0-indexed)
  const [selectedDay, setSelectedDay] = useState<number | null>(19); // Default to current day: 19

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Helper: Get days in month
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper: Get first day index of the month (0=Sunday, 6=Saturday)
  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear);

  // Generate calendar days grid
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null); // empty padding
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(i);
  }

  // Map events to days of July 2026
  const getEventsForDay = (day: number): CalendarEvent[] => {
    if (currentYear !== 2026 || currentMonth !== 6) return []; // Only July 2026 has mock events

    const events: CalendarEvent[] = [];

    // July 4: Renegociação Auto Paid
    if (day === 4) {
      events.push({
        id: 'ev_p2',
        type: 'pago',
        title: 'Pagamento: Renegociação Auto',
        amount: 1450,
        bank: 'Santander'
      });
    }

    // July 10: Reserve Deposit + Fatura Cartão (Overdue)
    if (day === 10) {
      events.push({
        id: 'ev_r1',
        type: 'reserva',
        title: 'Aporte Reserva Mensal',
        amount: 700,
        bank: 'Mercado Pago'
      });
      
      const nubankDebt = debts.find(d => d.id === '1');
      if (nubankDebt && nubankDebt.currentBalance > 0) {
        events.push({
          id: 'ev_d1',
          type: 'atrasado',
          title: 'Fatura Vencida Cartão Black',
          amount: nubankDebt.installmentValue,
          bank: 'Nubank'
        });
      }
    }

    // July 15: Empréstimo Pessoal (Paid)
    if (day === 15) {
      events.push({
        id: 'ev_p1',
        type: 'pago',
        title: 'Pagamento Parcela Empréstimo',
        amount: 1650,
        bank: 'Itaú'
      });
    }

    // July 20: Financiamento Minha Casa (Pendente / Proximo)
    if (day === 20) {
      const caixaDebt = debts.find(d => d.id === '3');
      if (caixaDebt && caixaDebt.currentBalance > 0) {
        events.push({
          id: 'ev_d3',
          type: 'proximo',
          title: 'Vencimento Financiamento Imob.',
          amount: caixaDebt.installmentValue,
          bank: 'Caixa'
        });
      }
    }

    // July 28: Crédito Consignado BB (Pendente)
    if (day === 28) {
      const bbDebt = debts.find(d => d.id === '4');
      if (bbDebt && bbDebt.currentBalance > 0) {
        events.push({
          id: 'ev_d4',
          type: 'proximo',
          title: 'Vencimento Crédito Consignado',
          amount: bbDebt.installmentValue,
          bank: 'Banco do Brasil'
        });
      }
    }

    return events;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      // stay or loop
    } else {
      setCurrentMonth(currentMonth - 1);
      setSelectedDay(null);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      // stay or loop
    } else {
      setCurrentMonth(currentMonth + 1);
      setSelectedDay(null);
    }
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Calendário Financeiro</h2>
          <p className="text-slate-400 text-xs mt-1">
            Planejamento de vencimentos, alertas de atraso e automações do Pix reserva.
          </p>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calendar Grid card */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-md">
          
          {/* Calendar Header Controls */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <CalendarIcon className="h-4.5 w-4.5 text-indigo-400" />
              <span>{months[currentMonth]} {currentYear}</span>
            </h3>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevMonth}
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 p-2 rounded-xl border border-slate-800/60 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 p-2 rounded-xl border border-slate-800/60 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-2.5">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-16 bg-transparent" />;
              }

              const events = getEventsForDay(day);
              const isSelected = selectedDay === day;
              
              // Color dot indications
              const hasOverdue = events.some(e => e.type === 'atrasado');
              const hasUpcoming = events.some(e => e.type === 'proximo');
              const hasPaid = events.some(e => e.type === 'pago');
              const hasReserve = events.some(e => e.type === 'reserva');

              const isCurrentDay = day === 19 && currentMonth === 6 && currentYear === 2026;

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day)}
                  className={`h-16 flex flex-col justify-between p-2 rounded-2xl border transition-all text-left relative cursor-pointer group ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-bold'
                      : isCurrentDay
                      ? 'bg-slate-800/80 border-slate-700 text-white shadow-md'
                      : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-xs font-semibold">{day}</span>

                  {/* Indicator Dot Badges */}
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {hasPaid && (
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" title="Pago" />
                    )}
                    {hasUpcoming && (
                      <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" title="Próximo ao Vencimento" />
                    )}
                    {hasOverdue && (
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" title="Atrasado" />
                    )}
                    {hasReserve && (
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" title="Reserva Criada" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Color Guides Legend */}
          <div className="flex flex-wrap gap-4 mt-6 pt-5 border-t border-slate-800/60 text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Pago
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              Próximo do vencimento
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Atrasado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              Reserva Criada
            </span>
          </div>

        </div>

        {/* Selected Day Events Drawer Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-md h-fit">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
            <span>Agenda do Dia {selectedDay ? `${selectedDay} de Julho` : ''}</span>
            <CalendarIcon className="h-4.5 w-4.5 text-slate-400" />
          </h3>

          {!selectedDay ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Selecione um dia no calendário para ver os agendamentos.
            </div>
          ) : selectedEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Nenhuma atividade financeira programada para este dia.
            </div>
          ) : (
            <div className="space-y-4">
              {selectedEvents.map((ev) => {
                let colorClass = '';
                let icon = <Info className="h-4.5 w-4.5" />;

                if (ev.type === 'pago') {
                  colorClass = 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400';
                  icon = <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />;
                } else if (ev.type === 'atrasado') {
                  colorClass = 'border-red-500/30 bg-red-950/20 text-red-400';
                  icon = <AlertTriangle className="h-4.5 w-4.5 text-red-400" />;
                } else if (ev.type === 'proximo') {
                  colorClass = 'border-yellow-500/30 bg-yellow-950/20 text-yellow-400';
                  icon = <Clock className="h-4.5 w-4.5 text-yellow-400" />;
                } else if (ev.type === 'reserva') {
                  colorClass = 'border-blue-500/30 bg-blue-950/20 text-blue-400';
                  icon = <PiggyBank className="h-4.5 w-4.5 text-blue-400" />;
                }

                return (
                  <div
                    key={ev.id}
                    className={`p-4 border rounded-2xl flex flex-col gap-2 ${colorClass}`}
                  >
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="font-bold text-xs">{ev.title}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className="text-slate-350">{ev.bank}</span>
                      <span className="font-extrabold text-white">R$ {ev.amount.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
