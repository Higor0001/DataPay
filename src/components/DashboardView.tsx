'use client';

import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  PiggyBank,
  CheckCircle,
  Clock,
  Calendar,
  CreditCard,
  Building2,
  Percent,
  Sparkles,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line
} from 'recharts';

export const DashboardView: React.FC = () => {
  const { debts, payments, reserve, payInstallment } = useAppState();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculations
  const activeDebts = debts.filter((d) => d.status !== 'paid');
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.currentBalance, 0);
  const totalCreditors = new Set(activeDebts.map((d) => d.bank)).size;
  const remainingInstallments = activeDebts.reduce((sum, d) => sum + d.remainingInstallments, 0);
  
  const overdueDebts = activeDebts.filter((d) => d.status === 'overdue');
  const totalOverdueAmount = overdueDebts.reduce((sum, d) => sum + d.currentBalance, 0);

  // Interest rate CET weighted average
  const totalWeight = activeDebts.reduce((sum, d) => sum + d.currentBalance, 0);
  const weightedInterestRate = totalWeight > 0
    ? activeDebts.reduce((sum, d) => sum + d.interestRate * d.currentBalance, 0) / totalWeight
    : 0;

  // Savings obtained - simulated total
  const savingsObtained = debts.reduce((sum, d) => {
    const originalCost = d.totalInstallments * d.installmentValue;
    const currentCost = d.remainingInstallments * d.installmentValue + (d.originalValue - d.currentBalance);
    const diff = originalCost - currentCost;
    return diff > 0 ? sum + diff : sum;
  }, 3450); // initial default mock savings

  // Projeção de data de quitação
  // Simple heuristic based on current payments speed
  const monthlyPaymentCapacity = debts.reduce((sum, d) => sum + d.installmentValue, 0);
  const monthsToPayoff = monthlyPaymentCapacity > 0 ? Math.ceil(totalDebt / (monthlyPaymentCapacity + reserve.goalValue)) : 0;
  
  const getPayoffDateStr = () => {
    if (monthsToPayoff === 0) return 'Quitada!';
    const today = new Date('2026-07-19');
    today.setMonth(today.getMonth() + monthsToPayoff);
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[today.getMonth()]} de ${today.getFullYear()}`;
  };

  // Upcoming bills (within next 10 days)
  const upcomingBills = activeDebts
    .filter((d) => {
      const today = new Date('2026-07-19');
      const due = new Date(d.nextDueDate);
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= -10 && diffDays <= 12; // active range
    })
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

  // Chart 1: Evolução da dívida (Mock historical projection)
  const debtEvolutionData = [
    { name: 'Jan', Divida: totalDebt * 1.25, Patrimonio: 4000 },
    { name: 'Fev', Divida: totalDebt * 1.18, Patrimonio: 6500 },
    { name: 'Mar', Divida: totalDebt * 1.12, Patrimonio: 8000 },
    { name: 'Abr', Divida: totalDebt * 1.08, Patrimonio: 11000 },
    { name: 'Mai', Divida: totalDebt * 1.05, Patrimonio: 14000 },
    { name: 'Jun', Divida: totalDebt * 1.02, Patrimonio: 16500 },
    { name: 'Jul', Divida: totalDebt, Patrimonio: 15000 + reserve.currentBalance } // Current month
  ];

  // Future projection data
  const projectionData = Array.from({ length: 6 }).map((_, index) => {
    const monthIndex = (new Date('2026-07-19').getMonth() + index) % 12;
    const year = new Date('2026-07-19').getFullYear() + Math.floor((new Date('2026-07-19').getMonth() + index) / 12);
    const monthsName = ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    
    // Simulate payoff slope
    const factor = Math.max(0, 1 - (index / monthsToPayoff));
    const projectedDebt = Math.round(totalDebt * factor);
    const projectedAssets = Math.round(17800 + (index * reserve.goalValue));

    return {
      name: monthsName[monthIndex],
      Divida: projectedDebt,
      Patrimonio: projectedAssets
    };
  });

  // Chart 2: Fluxo Mensal (Mock income vs payments)
  const monthlyFlowData = [
    { name: 'Mai', Receitas: 6500, Parcelas: 5800, Reserva: 700 },
    { name: 'Jun', Receitas: 6500, Parcelas: 4800, Reserva: 700 },
    { name: 'Jul', Receitas: 7200, Parcelas: 6070, Reserva: 700 }
  ];

  // Chart 3: Distribuição por Banco
  const COLORS = ['#6366f1', '#f97316', '#3b82f6', '#ffd700', '#ef4444', '#10b981'];
  
  const bankDistribution = activeDebts.reduce((acc: { name: string; value: number }[], debt) => {
    const existing = acc.find(item => item.name === debt.bank);
    if (existing) {
      existing.value += debt.currentBalance;
    } else {
      acc.push({ name: debt.bank, value: debt.currentBalance });
    }
    return acc;
  }, []);

  // Chart 4: Distribuição por Tipo de Dívida
  const typeDistribution = activeDebts.reduce((acc: { name: string; value: number }[], debt) => {
    const existing = acc.find(item => item.name === debt.type);
    if (existing) {
      existing.value += debt.currentBalance;
    } else {
      acc.push({ name: debt.type, value: debt.currentBalance });
    }
    return acc;
  }, []);

  const totalPaidSoFar = payments.filter(p => p.status === 'Pago').reduce((sum, p) => sum + p.amount, 0);
  const totalValueInitial = totalDebt + totalPaidSoFar;
  const percentPaid = totalValueInitial > 0 ? Math.round((totalPaidSoFar / totalValueInitial) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Welcome & Quick Status Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Olá, Higor <span className="wave">👋</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Aqui está o diagnóstico consolidado da sua saúde financeira.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-2xl">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Proteção Antigravity</span>
            <span className="text-xs font-semibold text-slate-200">Ambiente 100% Criptografado</span>
          </div>
        </div>
      </div>

      {/* Alert Overdue Banner */}
      {overdueDebts.length > 0 && (
        <div className="bg-gradient-to-r from-red-900/40 via-red-950/20 to-slate-900 border border-red-500/40 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-red-950/10">
          <div className="flex items-start gap-4">
            <div className="bg-red-500/20 text-red-400 p-3 rounded-2xl border border-red-500/30 flex items-center justify-center mt-1 md:mt-0 animate-pulse">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Alerta: Você possui dívidas em atraso!</h3>
              <p className="text-slate-300 text-xs mt-1 max-w-xl leading-relaxed">
                Existem **{overdueDebts.length} parcelas vencidas** totalizando **R$ {totalOverdueAmount.toLocaleString('pt-BR')}** correndo juros abusivos. Quitar estes atrasados é prioridade para estancar os juros de mora.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              const el = document.getElementById('ai');
              if (el) el.click();
            }}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-5 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-red-500/20 hover:scale-[1.02] cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>Consultar Solução IA</span>
          </button>
        </div>
      )}

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Divida Total */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-red-500/5 blur-3xl rounded-full" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Dívida Total</span>
            <TrendingDown className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-white tracking-tight">
              R$ {totalDebt.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] text-red-400/90 font-medium mt-1.5 flex items-center gap-1">
              <Percent className="h-3 w-3 inline" /> Méd. Juros: {weightedInterestRate.toFixed(1)}% a.m.
            </span>
          </div>
        </div>

        {/* Card 2: Valor Reservado */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/5 blur-3xl rounded-full" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Reserva Inteligente</span>
            <PiggyBank className="h-5 w-5 text-indigo-400 animate-bounce" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-white tracking-tight">
              R$ {reserve.currentBalance.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] text-indigo-300 font-medium mt-1.5 flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-400" /> Meta: R$ {reserve.goalValue}/mês
            </span>
          </div>
        </div>

        {/* Card 3: Credores e Parcelas */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/5 blur-3xl rounded-full" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Credores & Parcelas</span>
            <Clock className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-white tracking-tight">
              {totalCreditors} Bancos
            </span>
            <span className="text-[10px] text-slate-300 font-medium mt-1.5">
              {remainingInstallments} parcelas pendentes
            </span>
          </div>
        </div>

        {/* Card 4: Economia e Quitação */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-yellow-500/5 blur-3xl rounded-full" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Quitação Prevista</span>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-white tracking-tight">
              {getPayoffDateStr()}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
              Poupança Juros: R$ {savingsObtained.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Evolução da Dívida e Patrimônio Líquido */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-md">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-white text-sm">Curva de Desalavancagem</h3>
              <p className="text-slate-400 text-[11px] mt-0.5">Evolução do saldo devedor projetado x reserva acumulada</p>
            </div>
            <span className="text-[10.5px] bg-indigo-900/40 text-indigo-400 border border-indigo-800/60 px-2 py-0.5 rounded-full font-semibold">
              Projeção 6 Meses
            </span>
          </div>
          <div className="h-72 w-full">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDivida" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '16px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                  <Area name="Dívida Total (R$)" type="monotone" dataKey="Divida" stroke="#ef4444" fillOpacity={1} fill="url(#colorDivida)" strokeWidth={2} />
                  <Area name="Saldo Reserva (R$)" type="monotone" dataKey="Patrimonio" stroke="#6366f1" fillOpacity={1} fill="url(#colorPatrimonio)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {/* Chart 2: Pizza Distribution */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-md grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Bank Distribution */}
          <div>
            <h4 className="font-bold text-white text-xs mb-3 uppercase tracking-wider text-slate-400">Distribuição por Banco</h4>
            <div className="h-44 w-full flex items-center justify-center">
              {isMounted && bankDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bankDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {bankDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-slate-400 text-xs">Sem dívidas ativas</span>
              )}
            </div>
            <div className="space-y-1 mt-2">
              {bankDistribution.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    {item.name}
                  </span>
                  <span className="font-semibold text-white">
                    {((item.value / totalDebt) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Type Distribution */}
          <div className="border-t sm:border-t-0 sm:border-l border-slate-800/80 pt-4 sm:pt-0 sm:pl-4">
            <h4 className="font-bold text-white text-xs mb-3 uppercase tracking-wider text-slate-400">Distribuição por Tipo</h4>
            <div className="h-44 w-full flex items-center justify-center">
              {isMounted && typeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-slate-400 text-xs">Sem dívidas ativas</span>
              )}
            </div>
            <div className="space-y-1 mt-2">
              {typeDistribution.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[(idx + 3) % COLORS.length] }} />
                    {item.name}
                  </span>
                  <span className="font-semibold text-white">
                    {((item.value / totalDebt) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Grid Bottom: Next vencimentos & Reserve Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Next Vencimentos Card (2 columns wide on large screen) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-md lg:col-span-2">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-400" />
              <span>Agenda de Pagamentos Breves</span>
            </h3>
            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
              Próximos 12 dias
            </span>
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {upcomingBills.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Nenhum pagamento vencendo nos próximos 12 dias.
              </div>
            ) : (
              upcomingBills.map((bill) => {
                const isOverdue = bill.status === 'overdue';
                const today = new Date('2026-07-19');
                const due = new Date(bill.nextDueDate);
                const diffTime = due.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let daysLabel = '';
                let badgeColor = '';
                
                if (diffDays < 0) {
                  daysLabel = `Vencida há ${Math.abs(diffDays)} dia(s)`;
                  badgeColor = 'bg-red-500/10 border-red-500/30 text-red-400';
                } else if (diffDays === 0) {
                  daysLabel = 'Vence hoje!';
                  badgeColor = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-pulse';
                } else if (diffDays === 1) {
                  daysLabel = 'Vence amanhã';
                  badgeColor = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
                } else {
                  daysLabel = `Em ${diffDays} dias`;
                  badgeColor = 'bg-slate-800 border-slate-700 text-slate-300';
                }

                return (
                  <div
                    key={bill.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl hover:border-slate-700/60 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-base ${
                        bill.bank === 'Nubank' ? 'bg-purple-950/40 text-purple-400 border border-purple-800/40' :
                        bill.bank === 'Itaú' ? 'bg-orange-950/40 text-orange-400 border border-orange-850/40' :
                        bill.bank === 'Caixa' ? 'bg-blue-950/40 text-blue-400 border border-blue-800/40' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {bill.bank.substring(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 text-xs">{bill.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{bill.bank} • {bill.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right sm:text-right">
                        <p className="font-bold text-white text-xs">R$ {bill.installmentValue.toLocaleString('pt-BR')}</p>
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full border mt-1 ${badgeColor}`}>
                          {daysLabel}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const paymentMethod = reserve.currentBalance >= bill.installmentValue ? 'Reserva Inteligente' : 'Pix';
                          payInstallment(bill.id, bill.installmentValue, paymentMethod);
                        }}
                        className={`text-[10.5px] font-bold px-4 py-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                          isOverdue 
                            ? 'bg-red-500 border-red-400 text-white hover:bg-red-600 hover:border-red-500' 
                            : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 hover:border-indigo-600'
                        }`}
                      >
                        Pagar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Smart Reserve Quick Widget */}
        <div className="bg-gradient-to-b from-indigo-950/40 to-slate-900 border border-indigo-900/30 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-sm">Reserva Inteligente</h3>
              <PiggyBank className="h-5 w-5 text-indigo-400" />
            </div>
            
            <p className="text-slate-300 text-xs leading-relaxed mb-4">
              Dinheiro seguro guardado exclusivamente para pagamento ou amortização de dívidas.
            </p>
            
            <div className="bg-indigo-950/40 border border-indigo-900/50 p-4 rounded-2xl mb-4 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Saldo Disponível</span>
              <h4 className="text-xl font-black text-indigo-400 mt-1">
                R$ {reserve.currentBalance.toLocaleString('pt-BR')}
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Depósito mensal programado:</span>
                <span className="font-bold text-slate-200">R$ {reserve.goalValue}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Último aporte:</span>
                <span className="text-emerald-400 font-semibold">+ R$ 700,00</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const el = document.getElementById('reserve');
              if (el) el.click();
            }}
            className="w-full bg-slate-900 border border-indigo-850 hover:bg-slate-800 text-slate-200 text-xs font-bold py-3 px-4 rounded-2xl mt-6 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Gerenciar Aportes</span>
            <ArrowUpRight className="h-4 w-4 text-indigo-400" />
          </button>
        </div>

      </div>

    </div>
  );
};
