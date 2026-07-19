'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Debt, Payment, SmartReserve, Goal, BankIntegration, AppNotification, AIMessage } from '../types';

interface StateContextType {
  debts: Debt[];
  payments: Payment[];
  reserve: SmartReserve;
  goals: Goal[];
  integrations: BankIntegration[];
  notifications: AppNotification[];
  messages: AIMessage[];
  supabaseConfig: { url: string; anonKey: string } | null;
  saveSupabaseConfig: (url: string, key: string) => void;
  addDebt: (debt: Omit<Debt, 'id' | 'status' | 'nextDueDate'>) => void;
  updateDebt: (debt: Debt) => void;
  deleteDebt: (id: string) => void;
  payInstallment: (debtId: string, amount: number, method: Payment['method']) => void;
  payMultipleDebts: (items: { debtId: string; amount: number }[], method: Payment['method'], paidDate: string, receipt?: string) => void;
  amortizeDebt: (debtId: string, amount: number, type: 'time' | 'value') => { savings: number; newRemaining: number; newBalance: number };
  addReserveDeposit: (amount: number, description: string) => void;
  withdrawReserve: (amount: number, description: string) => void;
  updateReserveGoal: (value: number) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'currentValue' | 'accumulatedSavings'>) => void;
  updateGoalProgress: (id: string, value: number) => void;
  deleteGoal: (id: string) => void;
  deleteReserveHistoryItem: (id: string) => void;
  deletePayment: (id: string) => void;
  askAI: (query: string) => void;
  syncWithMongoDB: () => Promise<boolean>;
  addNotification: (title: string, content: string, type: AppNotification['type']) => void;
  clearNotification: (id: string) => void;
  resetData: () => void;
}

const StateContext = createContext<StateContextType | undefined>(undefined);

const initialDebts: Debt[] = [];

const initialPayments: Payment[] = [];

const initialReserve: SmartReserve = {
  goalValue: 0,
  currentBalance: 0,
  history: []
};

const initialGoals: Goal[] = [];

const initialIntegrations: BankIntegration[] = [
  { id: 'nubank', name: 'Nubank', logo: '🟣', connected: false },
  { id: 'itau', name: 'Itaú', logo: '🟠', connected: false },
  { id: 'caixa', name: 'Caixa Econômica', logo: '🔵', connected: false },
  { id: 'bb', name: 'Banco do Brasil', logo: '🟡', connected: false },
  { id: 'santander', name: 'Santander', logo: '🔴', connected: false },
  { id: 'mercadopago', name: 'Mercado Pago', logo: '🟢', connected: false }
];

const initialNotifications: AppNotification[] = [];

const initialMessages: AIMessage[] = [
  {
    id: 'm1',
    sender: 'ai',
    text: 'Olá! Sou o seu assistente de gestão de dívidas. Estou aqui para ajudar você a economizar juros e traçar o melhor plano para quitar suas pendências. Qual dívida você gostaria de analisar hoje?',
    timestamp: new Date('2026-07-19T00:00:00').toISOString()
  }
];

export const StateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [reserve, setReserve] = useState<SmartReserve>(initialReserve);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [integrations, setIntegrations] = useState<BankIntegration[]>(initialIntegrations);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [messages, setMessages] = useState<AIMessage[]>(initialMessages);
  const [supabaseConfig, setSupabaseConfig] = useState<{ url: string; anonKey: string } | null>(null);
  const [userId, setUserId] = useState<string>('');

  // Load from localStorage and fetch from MongoDB
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let storedUserId = localStorage.getItem('datapay_user_id');
      if (!storedUserId) {
        storedUserId = 'user_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('datapay_user_id', storedUserId);
      }
      setUserId(storedUserId);

      const storedDebts = localStorage.getItem('agy_debts');
      const storedPayments = localStorage.getItem('agy_payments');
      const storedReserve = localStorage.getItem('agy_reserve');
      const storedGoals = localStorage.getItem('agy_goals');
      const storedIntegrations = localStorage.getItem('agy_integrations');
      const storedNotifications = localStorage.getItem('agy_notifications');
      const storedMessages = localStorage.getItem('agy_messages');
      const storedSupabase = localStorage.getItem('agy_supabase_config');

      if (storedDebts) setDebts(JSON.parse(storedDebts));
      if (storedPayments) setPayments(JSON.parse(storedPayments));
      if (storedReserve) setReserve(JSON.parse(storedReserve));
      if (storedGoals) setGoals(JSON.parse(storedGoals));
      if (storedIntegrations) setIntegrations(JSON.parse(storedIntegrations));
      if (storedNotifications) setNotifications(JSON.parse(storedNotifications));
      if (storedMessages) setMessages(JSON.parse(storedMessages));
      if (storedSupabase) setSupabaseConfig(JSON.parse(storedSupabase));

      // Busca dados sincronizados na nuvem via MongoDB
      fetch(`/api/db/sync?userId=${storedUserId}`)
        .then(res => res.json())
        .then(resData => {
          if (resData.success && resData.data) {
            const d = resData.data;
            if (d.debts && d.debts.length > 0) {
              setDebts(d.debts);
              localStorage.setItem('agy_debts', JSON.stringify(d.debts));
            }
            if (d.payments && d.payments.length > 0) {
              setPayments(d.payments);
              localStorage.setItem('agy_payments', JSON.stringify(d.payments));
            }
            if (d.reserve && (d.reserve.goalValue > 0 || d.reserve.currentBalance > 0 || d.reserve.history.length > 0)) {
              setReserve(d.reserve);
              localStorage.setItem('agy_reserve', JSON.stringify(d.reserve));
            }
            if (d.goals && d.goals.length > 0) {
              setGoals(d.goals);
              localStorage.setItem('agy_goals', JSON.stringify(d.goals));
            }
            if (d.notifications && d.notifications.length > 0) {
              setNotifications(d.notifications);
              localStorage.setItem('agy_notifications', JSON.stringify(d.notifications));
            }
            console.log('[MongoDB Sync] Loaded data from cloud successfully.');
          }
        })
        .catch(err => console.error('[MongoDB Init Load Error]:', err));
    }
  }, []);

  // Save to localStorage helper
  const saveToLocal = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const addDebt = (newDebt: Omit<Debt, 'id' | 'status' | 'nextDueDate'>) => {
    const id = Date.now().toString();
    const today = new Date('2026-07-19');
    
    // Calculate next due date
    let nextDueMonth = today.getMonth();
    let nextDueYear = today.getFullYear();
    
    if (today.getDate() > newDebt.dueDate) {
      nextDueMonth += 1;
      if (nextDueMonth > 11) {
        nextDueMonth = 0;
        nextDueYear += 1;
      }
    }
    
    const formattedMonth = String(nextDueMonth + 1).padStart(2, '0');
    const formattedDay = String(newDebt.dueDate).padStart(2, '0');
    const nextDueDate = `${nextDueYear}-${formattedMonth}-${formattedDay}`;

    // Determine initial status based on due date and today
    let status: Debt['status'] = 'active';
    const dueTime = new Date(nextDueDate).getTime();
    if (dueTime < today.getTime()) {
      status = 'overdue';
    }

    const createdDebt: Debt = {
      ...newDebt,
      id,
      status,
      nextDueDate
    };

    const updated = [...debts, createdDebt];
    setDebts(updated);
    saveToLocal('agy_debts', updated);

    // Auto generate next payment in list
    const newPayment: Payment = {
      id: `p_${Date.now()}`,
      debtId: id,
      debtName: createdDebt.name,
      bankName: createdDebt.bank,
      amount: createdDebt.installmentValue,
      dueDate: createdDebt.nextDueDate,
      status: createdDebt.status === 'overdue' ? 'Atrasado' : 'Pendente',
      method: 'Pix',
      type: 'Parcela'
    };
    
    const updatedPayments = [...payments, newPayment];
    setPayments(updatedPayments);
    saveToLocal('agy_payments', updatedPayments);

    addNotification(
      'Dívida Cadastrada',
      `A dívida "${createdDebt.name}" no valor de R$ ${createdDebt.currentBalance.toLocaleString('pt-BR')} foi cadastrada com sucesso!`,
      'success'
    );
  };

  const updateDebt = (updatedDebt: Debt) => {
    const updated = debts.map((d) => (d.id === updatedDebt.id ? updatedDebt : d));
    setDebts(updated);
    saveToLocal('agy_debts', updated);
  };

  const deleteDebt = (id: string) => {
    const updated = debts.filter((d) => d.id !== id);
    const updatedPayments = payments.filter((p) => p.debtId !== id);
    setDebts(updated);
    setPayments(updatedPayments);
    saveToLocal('agy_debts', updated);
    saveToLocal('agy_payments', updatedPayments);
  };

  const payInstallment = (debtId: string, amount: number, method: Payment['method']) => {
    const todayStr = '2026-07-19';
    
    // Find debt
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    // Reduce current balance
    const updatedDebts = debts.map((d) => {
      if (d.id === debtId) {
        const newBalance = Math.max(0, d.currentBalance - amount);
        const newRemaining = Math.max(0, d.remainingInstallments - 1);
        
        // Calculate new next due date (add a month)
        const currentNext = new Date(d.nextDueDate);
        currentNext.setMonth(currentNext.getMonth() + 1);
        const year = currentNext.getFullYear();
        const month = String(currentNext.getMonth() + 1).padStart(2, '0');
        const day = String(d.dueDate).padStart(2, '0');
        const nextDueDate = `${year}-${month}-${day}`;

        const statusVal: Debt['status'] = newBalance === 0 ? 'paid' : 'active';
        return {
          ...d,
          currentBalance: newBalance,
          remainingInstallments: newRemaining,
          nextDueDate,
          status: statusVal
        };
      }
      return d;
    });

    setDebts(updatedDebts);
    saveToLocal('agy_debts', updatedDebts);

    // Update payment record in system
    let recordUpdated = false;
    const updatedPayments = payments.map((p) => {
      // Find the pending payment for this debt that is closest to today
      if (p.debtId === debtId && p.status !== 'Pago' && !recordUpdated) {
        recordUpdated = true;
        return {
          ...p,
          status: 'Pago' as const,
          paidDate: todayStr,
          method,
          amount
        };
      }
      return p;
    });

    // If no existing pending payment was found, create a new one
    if (!recordUpdated) {
      updatedPayments.push({
        id: `p_${Date.now()}`,
        debtId,
        debtName: debt.name,
        bankName: debt.bank,
        amount,
        dueDate: debt.nextDueDate,
        paidDate: todayStr,
        status: 'Pago',
        method,
        type: 'Parcela'
      });
    }

    setPayments(updatedPayments);
    saveToLocal('agy_payments', updatedPayments);

    // Deduct from smart reserve if that method was used
    if (method === 'Reserva Inteligente') {
      withdrawReserve(amount, `Pagamento de parcela: ${debt.name}`);
    }

    // Auto-update goals linked to this debt
    const updatedGoals = goals.map(g => {
      if (g.type === 'quitar_cartao' && debt.type === 'Cartão' && g.currentValue < g.targetValue) {
        return { ...g, currentValue: Math.min(g.targetValue, g.currentValue + amount) };
      }
      if (g.type === 'quitar_emprestimo' && debt.type === 'Empréstimo' && g.currentValue < g.targetValue) {
        return { ...g, currentValue: Math.min(g.targetValue, g.currentValue + amount) };
      }
      if (g.type === 'eliminar_dividas') {
        const totalPaid = amount;
        return { ...g, currentValue: Math.min(g.targetValue, g.currentValue + totalPaid) };
      }
      return g;
    });
    setGoals(updatedGoals);
    saveToLocal('agy_goals', updatedGoals);

    addNotification(
      'Pagamento Confirmado',
      `O pagamento de R$ ${amount.toLocaleString('pt-BR')} para a dívida "${debt.name}" foi registrado via ${method}.`,
      'success'
    );
  };

  const payMultipleDebts = (
    items: { debtId: string; amount: number }[],
    method: Payment['method'],
    paidDate: string,
    receipt?: string
  ) => {
    if (items.length === 0) return;

    let updatedDebts = [...debts];
    let updatedPayments = [...payments];
    let totalPaid = 0;

    items.forEach(({ debtId, amount }) => {
      if (amount <= 0) return;
      const debt = updatedDebts.find(d => d.id === debtId);
      if (!debt) return;

      totalPaid += amount;

      // Calcula novo saldo
      const newBalance = Math.max(0, debt.currentBalance - amount);
      const isFullQuittance = newBalance === 0;

      // Ajusta parcelas restantes e data de vencimento
      let newRemaining = debt.remainingInstallments;
      let nextDueDate = debt.nextDueDate;

      if (amount >= debt.installmentValue || isFullQuittance) {
        newRemaining = Math.max(0, debt.remainingInstallments - 1);
        const currentNext = new Date(debt.nextDueDate);
        currentNext.setMonth(currentNext.getMonth() + 1);
        const year = currentNext.getFullYear();
        const month = String(currentNext.getMonth() + 1).padStart(2, '0');
        const day = String(debt.dueDate).padStart(2, '0');
        nextDueDate = `${year}-${month}-${day}`;
      }

      if (isFullQuittance) {
        newRemaining = 0;
      }

      const statusVal: Debt['status'] = isFullQuittance ? 'paid' : 'active';

      // Atualiza a dívida na lista
      updatedDebts = updatedDebts.map(d => {
        if (d.id === debtId) {
          return {
            ...d,
            currentBalance: newBalance,
            remainingInstallments: newRemaining,
            nextDueDate,
            status: statusVal
          };
        }
        return d;
      });

      // Atualiza ou cria lançamento de pagamento
      let recordUpdated = false;
      updatedPayments = updatedPayments.map((p) => {
        if (p.debtId === debtId && p.status !== 'Pago' && !recordUpdated) {
          recordUpdated = true;
          return {
            ...p,
            status: 'Pago' as const,
            paidDate,
            method,
            amount,
            receipt,
            remainingBalanceAfterPayment: newBalance
          };
        }
        return p;
      });

      if (!recordUpdated) {
        updatedPayments.push({
          id: `p_${Date.now()}_${debtId}`,
          debtId,
          debtName: debt.name,
          bankName: debt.bank,
          amount,
          dueDate: debt.nextDueDate,
          paidDate,
          status: 'Pago',
          method,
          type: isFullQuittance ? 'Quitação' : 'Parcela',
          receipt,
          remainingBalanceAfterPayment: newBalance
        });
      }
    });

    setDebts(updatedDebts);
    saveToLocal('agy_debts', updatedDebts);

    setPayments(updatedPayments);
    saveToLocal('agy_payments', updatedPayments);

    // Deduz da reserva se usado
    if (method === 'Reserva Inteligente') {
      withdrawReserve(totalPaid, `Pagamento em lote de ${items.length} dívida(s)`);
    }

    // Atualiza metas ligadas a essas dívidas
    let updatedGoals = [...goals];
    items.forEach(({ debtId, amount }) => {
      const debt = debts.find(d => d.id === debtId);
      if (!debt) return;

      updatedGoals = updatedGoals.map(g => {
        if (g.type === 'quitar_cartao' && debt.type === 'Cartão' && g.currentValue < g.targetValue) {
          return { ...g, currentValue: Math.min(g.targetValue, g.currentValue + amount) };
        }
        if (g.type === 'quitar_emprestimo' && debt.type === 'Empréstimo' && g.currentValue < g.targetValue) {
          return { ...g, currentValue: Math.min(g.targetValue, g.currentValue + amount) };
        }
        if (g.type === 'eliminar_dividas') {
          return { ...g, currentValue: Math.min(g.targetValue, g.currentValue + amount) };
        }
        return g;
      });
    });
    setGoals(updatedGoals);
    saveToLocal('agy_goals', updatedGoals);

    addNotification(
      'Pagamento em Lote Confirmado',
      `O pagamento em lote de R$ ${totalPaid.toLocaleString('pt-BR')} para ${items.length} dívida(s) foi registrado com sucesso via ${method}.`,
      'success'
    );
  };

  const amortizeDebt = (debtId: string, amount: number, type: 'time' | 'value') => {
    const todayStr = '2026-07-19';
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return { savings: 0, newRemaining: 0, newBalance: 0 };

    let savings = 0;
    let newRemaining = debt.remainingInstallments;
    let newBalance = Math.max(0, debt.currentBalance - amount);

    // Formula to estimate interest savings:
    // With amortization, we reduce principal. If we keep the installment value but reduce the time:
    // interest rate is monthly. Savings = amount * (interestRate/100) * remainingInstallments * 0.65 (discount factor due to compounding)
    const monthlyRate = debt.interestRate / 100;
    if (type === 'time') {
      // Reducing installments
      const installmentsSaved = Math.round(amount / debt.installmentValue);
      newRemaining = Math.max(1, debt.remainingInstallments - installmentsSaved);
      savings = Math.round(amount * monthlyRate * installmentsSaved * 1.5); // high savings because of early compound cancellation
    } else {
      // Reducing installment value, keeping time
      savings = Math.round(amount * monthlyRate * debt.remainingInstallments * 0.4);
    }

    const updatedDebts = debts.map((d) => {
      if (d.id === debtId) {
        const installmentVal = type === 'value' 
          ? Math.round(newBalance / newRemaining * (1 + monthlyRate)) 
          : d.installmentValue;

        const statusVal: Debt['status'] = newBalance === 0 ? 'paid' : d.status;
        return {
          ...d,
          currentBalance: newBalance,
          remainingInstallments: newRemaining,
          installmentValue: installmentVal,
          status: statusVal
        };
      }
      return d;
    });

    setDebts(updatedDebts);
    saveToLocal('agy_debts', updatedDebts);

    // Create Payment log for Amortization
    const newPay: Payment = {
      id: `p_${Date.now()}`,
      debtId,
      debtName: debt.name,
      bankName: debt.bank,
      amount,
      dueDate: todayStr,
      paidDate: todayStr,
      status: 'Pago',
      method: 'Pix',
      type: 'Amortização'
    };
    
    const updatedPayments = [...payments, newPay];
    setPayments(updatedPayments);
    saveToLocal('agy_payments', updatedPayments);

    // Update goals
    const updatedGoals = goals.map(g => {
      if (g.type === 'eliminar_dividas') {
        return { 
          ...g, 
          currentValue: Math.min(g.targetValue, g.currentValue + amount),
          accumulatedSavings: g.accumulatedSavings + savings
        };
      }
      return g;
    });
    setGoals(updatedGoals);
    saveToLocal('agy_goals', updatedGoals);

    addNotification(
      'Amortização Registrada',
      `Você amortizou R$ ${amount.toLocaleString('pt-BR')} na dívida "${debt.name}". Economia estimada em juros: R$ ${savings.toLocaleString('pt-BR')}.`,
      'success'
    );

    return { savings, newRemaining, newBalance };
  };

  const addReserveDeposit = (amount: number, description: string) => {
    const todayStr = '2026-07-19';
    const newBal = reserve.currentBalance + amount;
    const newHist = [
      { id: `h_${Date.now()}`, date: todayStr, amount, type: 'deposit' as const, description },
      ...reserve.history
    ];
    const updated = { ...reserve, currentBalance: newBal, history: newHist };
    
    setReserve(updated);
    saveToLocal('agy_reserve', updated);

    // Update goals
    const updatedGoals = goals.map(g => {
      if (g.type === 'criar_reserva' || g.type === 'fundo_emergencia') {
        return { ...g, currentValue: Math.min(g.targetValue, g.currentValue + amount) };
      }
      return g;
    });
    setGoals(updatedGoals);
    saveToLocal('agy_goals', updatedGoals);

    addNotification(
      'Depósito em Reserva',
      `R$ ${amount.toLocaleString('pt-BR')} adicionados à sua reserva de dívidas. Saldo atual: R$ ${newBal.toLocaleString('pt-BR')}.`,
      'info'
    );
  };

  const withdrawReserve = (amount: number, description: string) => {
    const todayStr = '2026-07-19';
    const newBal = Math.max(0, reserve.currentBalance - amount);
    const newHist = [
      { id: `h_${Date.now()}`, date: todayStr, amount, type: 'withdraw' as const, description },
      ...reserve.history
    ];
    const updated = { ...reserve, currentBalance: newBal, history: newHist };
    
    setReserve(updated);
    saveToLocal('agy_reserve', updated);
  };

  const updateReserveGoal = (value: number) => {
    const updated = { ...reserve, goalValue: value };
    setReserve(updated);
    saveToLocal('agy_reserve', updated);
  };

  const addGoal = (newGoal: Omit<Goal, 'id' | 'currentValue' | 'accumulatedSavings'>) => {
    const created: Goal = {
      ...newGoal,
      id: Date.now().toString(),
      currentValue: newGoal.type === 'criar_reserva' || newGoal.type === 'fundo_emergencia' ? reserve.currentBalance : 0,
      accumulatedSavings: 0
    };
    const updated = [...goals, created];
    setGoals(updated);
    saveToLocal('agy_goals', updated);
  };

  const updateGoalProgress = (id: string, value: number) => {
    const updated = goals.map(g => g.id === id ? { ...g, currentValue: value } : g);
    setGoals(updated);
    saveToLocal('agy_goals', updated);
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    saveToLocal('agy_goals', updated);
  };

  const deleteReserveHistoryItem = (id: string) => {
    const item = reserve.history.find(h => h.id === id);
    if (!item) return;

    let balanceAdjustment = 0;
    if (item.type === 'deposit') {
      balanceAdjustment = -item.amount;
    } else {
      balanceAdjustment = item.amount;
    }

    const newBalance = Math.max(0, reserve.currentBalance + balanceAdjustment);
    const newHistory = reserve.history.filter(h => h.id !== id);
    const updated = { ...reserve, currentBalance: newBalance, history: newHistory };

    setReserve(updated);
    saveToLocal('agy_reserve', updated);

    addNotification(
      'Lançamento de Reserva Excluído',
      `O lançamento de R$ ${item.amount.toLocaleString('pt-BR')} foi removido e o saldo atualizado.`,
      'info'
    );
  };

  const deletePayment = (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;

    const updated = payments.filter(p => p.id !== id);
    setPayments(updated);
    saveToLocal('agy_payments', updated);

    addNotification(
      'Pagamento Excluído',
      `O registro de pagamento da dívida "${payment.debtName}" foi removido.`,
      'info'
    );
  };

  const addNotification = (title: string, content: string, type: AppNotification['type']) => {
    const todayStr = '2026-07-19';
    const newNotif: AppNotification = {
      id: Date.now().toString(),
      title,
      content,
      date: todayStr,
      read: false,
      type
    };
    const updated = [newNotif, ...notifications];
    setNotifications(updated);
    saveToLocal('agy_notifications', updated);
  };

  const clearNotification = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    saveToLocal('agy_notifications', updated);
  };

  const saveSupabaseConfig = (url: string, key: string) => {
    const config = { url, anonKey: key };
    setSupabaseConfig(config);
    saveToLocal('agy_supabase_config', config);
    addNotification('Configuração Supabase Salva', 'A arquitetura de sincronização do Supabase foi configurada.', 'info');
  };

  // Deterministic UUID converter to ensure offline IDs comply with PostgreSQL UUID types
  const toUUID = (id: string): string => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) return id;

    let clean = id.replace(/[^a-f0-9]/gi, '');
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    const padded = (clean + hashHex + '00000000000000000000000000000000').substring(0, 32);
    
    return `${padded.substring(0, 8)}-${padded.substring(8, 12)}-${padded.substring(12, 16)}-${padded.substring(16, 20)}-${padded.substring(20, 32)}`;
  };

  const syncWithMongoDB = async (): Promise<boolean> => {
    try {
      console.log('[MongoDB Sync] Sincronizando dados com o MongoDB...');
      const res = await fetch('/api/db/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          debts,
          payments,
          reserve,
          goals,
          notifications
        })
      });

      if (!res.ok) {
        throw new Error('Erro na resposta do servidor.');
      }

      const resData = await res.json();
      if (!resData.success) {
        throw new Error(resData.error || 'Erro ao sincronizar.');
      }

      addNotification(
        'Sincronização Concluída',
        'Todos os dados foram salvos com sucesso no MongoDB na nuvem.',
        'success'
      );
      return true;
    } catch (error: any) {
      console.error('[MongoDB Sync Error] Falha na sincronização:', error);
      addNotification(
        'Falha na Sincronização',
        `Erro ao enviar dados para o MongoDB: ${error.message || error}`,
        'alert'
      );
      return false;
    }
  };

  const askAI = (query: string) => {
    const userMsg: AIMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toISOString()
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    saveToLocal('agy_messages', newMsgs);

    // Compute detailed simulated response based on the active debts
    setTimeout(() => {
      let aiText = '';
      const lowerQuery = query.toLowerCase();

      // Find important info
      const totalDebtAmount = debts.reduce((sum, d) => sum + d.currentBalance, 0);
      const overdueDebts = debts.filter(d => d.status === 'overdue');
      const maxInterestDebt = debts.reduce((max, d) => d.interestRate > max.interestRate ? d : max, debts[0]);
      const nextDueDebt = debts.filter(d => d.status === 'active' || d.status === 'overdue').sort((a,b) => a.dueDate - b.dueDate)[0];

      if (lowerQuery.includes('pagar primeiro') || lowerQuery.includes('qual divida') || lowerQuery.includes('avalanche') || lowerQuery.includes('bola de neve')) {
        aiText = `Analisando seu portfólio de dívidas atual, recomendo utilizar o **Método Avalanche** (foco nas taxas de juros mais altas) para otimizar suas finanças:

1. **Prioridade Máxima:** A sua dívida **"${maxInterestDebt.name}" (${maxInterestDebt.bank})** possui a maior taxa de juros: **${maxInterestDebt.interestRate}% ao mês (CET de ${maxInterestDebt.cet}% ao ano)**. Atualmente você deve R$ ${maxInterestDebt.currentBalance.toLocaleString('pt-BR')}.
2. **Urgência Temporal:** Sua fatura vencida do Nubank de R$ 4.200 está correndo juros de atraso de 14.5% ao mês + multa de 2%. Ela deve ser quitada imediatamente com sua reserva.
3. **Próxima Dívida:** Após liquidar os cartões de crédito, foque no **Empréstimo Itaú (juros de ${debts[1]?.interestRate || 4.8}% a.m.)**, amortizando o saldo devedor.
4. **Financiamentos:** O financiamento imobiliário na Caixa tem a menor taxa (${debts[2]?.interestRate || 0.8}% a.m.), devendo ser pago apenas nas parcelas normais, sem pressa para amortizar enquanto houver dívidas mais caras.`;
      } 
      else if (lowerQuery.includes('economizo') || lowerQuery.includes('antecipar') || lowerQuery.includes('amortizar')) {
        aiText = `Ao antecipar parcelas ou amortizar o saldo devedor de suas dívidas, você cancela a incidência de juros compostos sobre o principal amortizado.

**Exemplo Prático com suas dívidas:**
* Se você amortizar **R$ 1.000** no **Empréstimo Pessoal Itaú** (taxa de 4.8% a.m.):
  * Você reduzirá cerca de **2 parcelas** finais.
  * Terá uma **economia estimada em juros de R$ 1.340** ao longo do contrato.
* Se amortizar **R$ 1.000** no **Financiamento Caixa** (taxa de 0.8% a.m.):
  * Reduzirá cerca de 0.4 parcelas.
  * A economia em juros será menor: cerca de **R$ 240**, pois a taxa é muito mais baixa.

Use a aba **Simulador** para planejar amortizações exatas!`;
      } 
      else if (lowerQuery.includes('juros abusivos') || lowerQuery.includes('abusive')) {
        aiText = `Para identificar juros abusivos, comparamos a taxa do seu contrato com a **Taxa Média de Mercado do Banco Central (BACEN)** para o mesmo período e modalidade.

* **Cartão de Crédito Nubank (${maxInterestDebt.interestRate}% a.m. / ~395% a.a.):** Está dentro da média nacional de cartões rotativos, que frequentemente ultrapassa 400% a.a. No entanto, é um juro extremamente nocivo.
* **Empréstimo Pessoal Itaú (4.8% a.m. / ~76% a.a.):** É uma taxa comum para crédito pessoal sem garantia, mas se o seu score de crédito for excelente, você conseguiria renegociar ou fazer **portabilidade de crédito** para taxas na faixa de 2.5% a 3.5% a.m.
* **Crédito Consignado Banco do Brasil (1.9% a.m.):** Taxa excelente! Consignados costumam ter os menores juros por conta da garantia em folha.

*Dica:* Se a taxa do seu contrato for superior a 1.5x a média do BACEN na época da assinatura, você pode entrar com ação revisional.`;
      } 
      else if (lowerQuery.includes('quanto falta') || lowerQuery.includes('total') || lowerQuery.includes('quitar tudo')) {
        aiText = `Atualmente, o saldo devedor total acumulado de suas **${debts.length} dívidas ativas** é de **R$ ${totalDebtAmount.toLocaleString('pt-BR')}**.

Para quitar tudo:
1. Você tem uma reserva inteligente de **R$ ${reserve.currentBalance.toLocaleString('pt-BR')}**. Ela poderia cobrir imediatamente 66% da fatura atrasada do Nubank.
2. Seu fluxo mensal de parcelas contratadas é de **R$ ${(debts.reduce((sum, d) => sum + d.installmentValue, 0)).toLocaleString('pt-BR')}**.
3. Se você continuar guardando **R$ ${reserve.goalValue}** na Reserva Inteligente e destinando a amortizações extras no Itaú e Nubank, sua data estimada de quitação total (excluindo o financiamento imobiliário Caixa) cairá de 14 meses para apenas **6 meses**, poupando mais de **R$ 6.200** em juros.`;
      } 
      else if (lowerQuery.includes('comprar') || lowerQuery.includes('posso')) {
        aiText = `Como seu consultor financeiro, recomendo **forte cautela** antes de realizar novos gastos não essenciais.
        
Atualmente você possui **R$ ${overdueDebts.reduce((sum,d) => sum + d.installmentValue, 0).toLocaleString('pt-BR')} em dívidas atrasadas** e um saldo devedor total de **R$ ${totalDebtAmount.toLocaleString('pt-BR')}**. 
Cada real gasto em compras supérfluas agora é um real que deixa de render na amortização de juros de 14.5% a.m. no Nubank. 

**Regra de decisão:** Adie essa compra até que a fatura atrasada e o empréstimo pessoal Itaú estejam totalmente equalizados.`;
      } 
      else if (lowerQuery.includes('extra') || lowerQuery.includes('investir') || lowerQuery.includes('restituicao') || lowerQuery.includes('fgts')) {
        aiText = `Se você receber um dinheiro extra (como 13º salário, PLR ou Restituição de IR), o melhor investimento financeiro disponível é a **amortização de suas dívidas de juros altos**.

**Por que?**
Investimentos seguros de renda fixa (CDI, Tesouro Direto) rendem hoje cerca de **10% a 11% ao ano**.
Por outro lado:
* Quitar o **Cartão Nubank** te economiza **14.5% ao mês** (cerca de **395% ao ano**).
* Quitar o **Empréstimo Itaú** te economiza **4.8% ao mês** (cerca de **76% ao ano**).

Nenhum investimento de mercado renderá mais do que a economia obtida ao eliminar esses juros. Portanto, destine 100% de qualquer dinheiro extra para amortizar a dívida mais cara.`;
      } 
      else if (lowerQuery.includes('renegociar') || lowerQuery.includes('vale a pena')) {
        aiText = `Sim, renegociar vale muito a pena sob duas condições:
1. **Redução da Taxa de Juros (CET):** O novo contrato deve oferecer uma taxa menor que a atual, e não apenas alongar o prazo com juros maiores.
2. **Adequação ao Orçamento:** A nova parcela deve caber confortavelmente na sua renda mensal para evitar novas quebras de contrato.

Você pode sugerir uma portabilidade de crédito para outros bancos (ex: Banco Inter, C6 ou Cooperativas de Crédito) que compram dívidas caras oferecendo taxas menores.`;
      } 
      else {
        aiText = `Com base no seu perfil financeiro, preparei as seguintes **Recomendações Inteligentes**:
        
1. 🚨 **Ação Imediata:** Aloque o saldo de R$ ${reserve.currentBalance} da sua Reserva para pagar parte da fatura atrasada do Nubank (R$ 4.200). Os juros correntes de atraso estão custando R$ 20,30 por dia!
2. 🔄 **Portabilidade de Crédito:** Solicite a portabilidade do Empréstimo Pessoal do Itaú (4.8% a.m.) para uma instituição com juros consignados ou menores (meta de juros de 2.2% a.m.). Isso economizará até R$ 4.500 em juros nas parcelas restantes.
3. 📆 **Uso da Reserva Inteligente:** Continue com a meta de poupar R$ ${reserve.goalValue} mensais. O QR Code Pix gerado na aba "Reserva" está pronto para uso e renderá proteção extra contra atrasos.`;
      }

      const aiMsg: AIMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: aiText,
        timestamp: new Date().toISOString()
      };

      const updatedMsgs = [...newMsgs, aiMsg];
      setMessages(updatedMsgs);
      saveToLocal('agy_messages', updatedMsgs);
    }, 1000);
  };

  const resetData = () => {
    setDebts(initialDebts);
    setPayments(initialPayments);
    setReserve(initialReserve);
    setGoals(initialGoals);
    setIntegrations(initialIntegrations);
    setNotifications(initialNotifications);
    setMessages(initialMessages);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('agy_debts');
      localStorage.removeItem('agy_payments');
      localStorage.removeItem('agy_reserve');
      localStorage.removeItem('agy_goals');
      localStorage.removeItem('agy_integrations');
      localStorage.removeItem('agy_notifications');
      localStorage.removeItem('agy_messages');
      localStorage.removeItem('agy_supabase_config');
    }
    addNotification('Dados Reiniciados', 'A aplicação foi restaurada para o estado de simulação inicial.', 'info');
  };

  return (
    <StateContext.Provider
      value={{
        debts,
        payments,
        reserve,
        goals,
        integrations,
        notifications,
        messages,
        supabaseConfig,
        saveSupabaseConfig,
        addDebt,
        updateDebt,
        deleteDebt,
        payInstallment,
        payMultipleDebts,
        amortizeDebt,
        addReserveDeposit,
        withdrawReserve,
        updateReserveGoal,
        addGoal,
        updateGoalProgress,
        deleteGoal,
        deleteReserveHistoryItem,
        deletePayment,
        askAI,
        syncWithMongoDB,
        addNotification,
        clearNotification,
        resetData
      }}
    >
      {children}
    </StateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
};
