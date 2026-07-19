'use client';

import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import { Debt } from '../types';
import {
  Calculator,
  Percent,
  Calendar,
  Layers,
  Banknote,
  Sparkles,
  ArrowRight,
  TrendingUp,
  HelpCircle,
  TrendingDown
} from 'lucide-react';

export const SimulationsView: React.FC = () => {
  const { debts } = useAppState();
  const activeDebts = debts.filter((d) => d.status !== 'paid');

  // Simulator Type tabs: 'extra' or 'portability'
  const [activeSubTab, setActiveSubTab] = useState<'extra' | 'portability'>('extra');

  // 1. Extra income state
  const [extraAmount, setExtraAmount] = useState('');
  const [selectedDebtId, setSelectedDebtId] = useState('');
  const [amortizationType, setAmortizationType] = useState<'time' | 'value'>('time');
  const [extraType, setExtraType] = useState('Décimo Terceiro');

  // 2. Portability state
  const [portDebtId, setPortDebtId] = useState('');
  const [newRate, setNewRate] = useState('');

  // Results
  const [calculated, setCalculated] = useState(false);
  const [result, setResult] = useState<{
    originalBalance: number;
    amountInjected: number;
    interestSaved: number;
    newBalance: number;
    originalRemaining: number;
    newRemaining: number;
    timeSaved: number;
    newInstallmentValue: number;
  } | null>(null);

  const [portResult, setPortResult] = useState<{
    originalRate: number;
    newRate: number;
    monthlySavings: number;
    totalSavings: number;
  } | null>(null);

  const handleSimulateExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(extraAmount);
    const debt = activeDebts.find((d) => d.id === selectedDebtId);
    if (!amount || !debt) return;

    const originalRemaining = debt.remainingInstallments;
    const originalBalance = debt.currentBalance;
    const newBalance = Math.max(0, originalBalance - amount);
    
    let interestSaved = 0;
    let newRemaining = originalRemaining;
    let newInstallmentValue = debt.installmentValue;
    let timeSaved = 0;

    const monthlyRate = debt.interestRate / 100;

    if (amortizationType === 'time') {
      const installmentsSaved = Math.round(amount / debt.installmentValue);
      newRemaining = Math.max(1, originalRemaining - installmentsSaved);
      timeSaved = originalRemaining - newRemaining;
      // High savings calculation because of compound interest cancellation
      interestSaved = Math.round(amount * monthlyRate * installmentsSaved * 1.5);
    } else {
      // Reduction in installment amount, keeping the remaining time
      newInstallmentValue = Math.round(newBalance / originalRemaining * (1 + monthlyRate));
      interestSaved = Math.round(amount * monthlyRate * originalRemaining * 0.45);
    }

    setResult({
      originalBalance,
      amountInjected: amount,
      interestSaved,
      newBalance,
      originalRemaining,
      newRemaining,
      timeSaved,
      newInstallmentValue
    });
    setCalculated(true);
  };

  const handleSimulatePortability = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRate = Number(newRate);
    const debt = activeDebts.find((d) => d.id === portDebtId);
    if (!targetRate || !debt) return;

    const originalRate = debt.interestRate;
    const rateDiff = (originalRate - targetRate) / 100;
    
    // Heuristic: Monthly savings = currentBalance * rateDiff
    const monthlySavings = Math.max(0, Math.round(debt.currentBalance * rateDiff));
    const totalSavings = Math.round(monthlySavings * debt.remainingInstallments);

    setPortResult({
      originalRate,
      newRate: targetRate,
      monthlySavings,
      totalSavings
    });
  };

  const extraTypes = [
    'Décimo Terceiro',
    'Restituição IR',
    'FGTS Amortização',
    'Bônus / PLR',
    'Economias / Outros'
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Simulador Financeiro</h2>
          <p className="text-slate-400 text-xs mt-1">
            Planeje o impacto de aportes extras de FGTS, 13º e compare portabilidade de juros.
          </p>
        </div>
      </div>

      {/* Selector Subtabs */}
      <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/80 w-fit">
        <button
          onClick={() => {
            setActiveSubTab('extra');
            setCalculated(false);
            setResult(null);
          }}
          className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            activeSubTab === 'extra'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Amortização com Renda Extra
        </button>
        <button
          onClick={() => {
            setActiveSubTab('portability');
            setCalculated(false);
            setPortResult(null);
          }}
          className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            activeSubTab === 'portability'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Portabilidade de Dívida
        </button>
      </div>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Form panel */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md h-fit">
          {activeSubTab === 'extra' ? (
            <form onSubmit={handleSimulateExtra} className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-2">
                <Calculator className="h-4.5 w-4.5" />
                <span>Simular Amortização</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Origem do Dinheiro</label>
                  <select
                    value={extraType}
                    onChange={(e) => setExtraType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-250 focus:outline-none cursor-pointer"
                  >
                    {extraTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Valor Injetado (R$)</label>
                  <input
                    type="number"
                    required
                    min="10"
                    placeholder="Ex: 5000"
                    value={extraAmount}
                    onChange={(e) => setExtraAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Destinar para Dívida</label>
                <select
                  value={selectedDebtId}
                  onChange={(e) => setSelectedDebtId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-250 focus:outline-none cursor-pointer"
                >
                  <option value="">Selecione um contrato ativo...</option>
                  {activeDebts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.bank}) • Juros: {d.interestRate}% a.m.
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Estratégia</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAmortizationType('time')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      amortizationType === 'time'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    <Layers className="h-4.5 w-4.5" />
                    <span>Amortizar Prazo</span>
                    <span className="text-[8.5px] text-slate-500 font-normal">Tirar parcelas no final</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmortizationType('value')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      amortizationType === 'value'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    <Banknote className="h-4.5 w-4.5" />
                    <span>Reduzir Parcela</span>
                    <span className="text-[8.5px] text-slate-500 font-normal">Reduzir valor mensal</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                Calcular Economia
              </button>
            </form>
          ) : (
            <form onSubmit={handleSimulatePortability} className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-2">
                <Calculator className="h-4.5 w-4.5" />
                <span>Simular Portabilidade</span>
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Dívida para Transferir</label>
                <select
                  value={portDebtId}
                  onChange={(e) => setPortDebtId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-250 focus:outline-none cursor-pointer"
                >
                  <option value="">Selecione um contrato ativo...</option>
                  {activeDebts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.bank}) • Atual: {d.interestRate}% a.m.
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Nova Taxa Proposta (% a.m.)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ex: 2.5"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-2xl text-[10.5px] text-slate-400 leading-relaxed">
                ℹ️ **O que é Portabilidade?** O banco parceiro compra sua dívida à vista do banco original, criando um novo contrato sob juros menores.
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                Comparar Proposta
              </button>
            </form>
          )}
        </div>

        {/* Results panel */}
        <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 shadow-md flex flex-col justify-center min-h-[300px]">
          {activeSubTab === 'extra' ? (
            !calculated || !result ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Insira as informações do aporte ao lado para calcular o retorno.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="bg-emerald-950/30 border border-emerald-900/50 p-5 rounded-3xl text-center">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-extrabold block">Economia Estimada em Juros</span>
                  <h4 className="text-2xl font-black text-emerald-400 mt-2">
                    R$ {result.interestSaved.toLocaleString('pt-BR')}
                  </h4>
                  <span className="text-[9.5px] text-slate-400 block mt-1">
                    dinheiro poupado que não será pago ao banco
                  </span>
                </div>

                <div className="space-y-2.5 text-xs bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Saldo Devedor Atualizado:</span>
                    <span className="font-bold text-white">R$ {result.newBalance.toLocaleString('pt-BR')}</span>
                  </div>

                  {amortizationType === 'time' ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Parcelas Eliminadas:</span>
                        <span className="font-bold text-emerald-400 font-semibold">{result.timeSaved} meses</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Novo Prazo de Quitação:</span>
                        <span className="font-bold text-white">{result.newRemaining} parcelas</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Nova Parcela Mensal:</span>
                        <span className="font-bold text-emerald-400">
                          R$ {result.newInstallmentValue.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Redução de Gasto Mensal:</span>
                        <span className="font-bold text-white">
                          R$ {(result.originalBalance / result.originalRemaining * 1.02 - result.newInstallmentValue).toFixed(0)}/mês
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          ) : (
            !portResult ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Selecione uma dívida e insira a taxa para simular portabilidade.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="bg-emerald-950/30 border border-emerald-900/50 p-5 rounded-3xl text-center">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-extrabold block">Economia Total da Portabilidade</span>
                  <h4 className="text-2xl font-black text-emerald-400 mt-2">
                    R$ {portResult.totalSavings.toLocaleString('pt-BR')}
                  </h4>
                  <span className="text-[9.5px] text-slate-400 block mt-1">
                    Redução de juros composto ao longo do contrato
                  </span>
                </div>

                <div className="space-y-2.5 text-xs bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Taxa Original:</span>
                    <span className="font-bold text-red-400">{portResult.originalRate}% a.m.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nova Taxa Sugerida:</span>
                    <span className="font-bold text-emerald-400">{portResult.newRate}% a.m.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Alívio Financeiro Mensal:</span>
                    <span className="font-bold text-white">~ R$ {portResult.monthlySavings.toLocaleString('pt-BR')}/mês</span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

      </div>

    </div>
  );
};
