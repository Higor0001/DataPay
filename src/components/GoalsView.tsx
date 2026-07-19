'use client';

import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import { Goal } from '../types';
import {
  Target,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  X,
  AlertCircle
} from 'lucide-react';

export const GoalsView: React.FC = () => {
  const { goals, addGoal, deleteGoal, updateGoalProgress } = useAppState();
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [type, setType] = useState<Goal['type']>('quitar_cartao');
  const [deadline, setDeadline] = useState('2026-12-31');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetValue) return;

    addGoal({
      name,
      targetValue: Number(targetValue),
      type,
      deadline
    });

    setName('');
    setTargetValue('');
    setType('quitar_cartao');
    setDeadline('2026-12-31');
    setShowAddModal(false);
  };

  const getGoalTypeLabel = (type: Goal['type']) => {
    switch (type) {
      case 'quitar_cartao':
        return 'Quitar Cartão';
      case 'quitar_emprestimo':
        return 'Quitar Empréstimo';
      case 'eliminar_dividas':
        return 'Eliminar Todas as Dívidas';
      case 'criar_reserva':
        return 'Criar Reserva';
      case 'fundo_emergencia':
        return 'Fundo de Emergência';
      default:
        return 'Metas';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Metas de Quitação</h2>
          <p className="text-slate-400 text-xs mt-1">
            Defina e monitore alvos estratégicos para acelerar sua desalavancagem e organizar seu caixa.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-3 rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Nova Meta</span>
        </button>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map((goal) => {
          const progressPercent = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) || 0;
          const remainingAmount = Math.max(0, goal.targetValue - goal.currentValue);
          
          const today = new Date('2026-07-19');
          const targetDate = new Date(goal.deadline);
          const diffTime = targetDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const monthsRemaining = Math.max(0, Math.round(diffDays / 30));

          return (
            <div
              key={goal.id}
              className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-400/90 bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-900/40">
                      {getGoalTypeLabel(goal.type)}
                    </span>
                    <h3 className="font-bold text-white text-sm mt-2">{goal.name}</h3>
                  </div>

                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 my-6">
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Progresso</span>
                      <span className="font-bold text-white">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-850">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-indigo-650 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Goal stats */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Acumulado</span>
                      <span className="font-extrabold text-slate-200">
                        R$ {goal.currentValue.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Alvo Global</span>
                      <span className="font-extrabold text-slate-200">
                        R$ {goal.targetValue.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-850 pt-4 flex items-center justify-between text-[11px] text-slate-450 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Prazo: {monthsRemaining} meses rest.
                </span>

                <span className="text-emerald-400 font-bold">
                  Economia Acumulada: R$ {goal.accumulatedSavings.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <h3 className="font-bold text-white text-base">Adicionar Nova Meta</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Nome da Meta</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Eliminar Fatura Santander"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Tipo de Alvo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Goal['type'])}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="quitar_cartao">Quitar Cartão</option>
                    <option value="quitar_emprestimo">Quitar Empréstimo</option>
                    <option value="eliminar_dividas">Quitar Todas as Dívidas</option>
                    <option value="criar_reserva">Criar Reserva</option>
                    <option value="fundo_emergencia">Fundo Emergência</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Valor Alvo (R$)</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 5000"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Data Limite (Prazo)</label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  Criar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
