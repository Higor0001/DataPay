'use client';

import React, { useState, useEffect } from 'react';
import {
  PierreAccount,
  PierreBalanceData,
  PierreTransaction,
  PierreBillSummary
} from '../types/pierre';
import {
  PierreFinanceService,
  getStoredPierreApiKey,
  setStoredPierreApiKey
} from '../services/pierreService';
import {
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Info,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export const PierreFinanceView: React.FC = () => {
  const [apiKey, setApiKeyInput] = useState<string>('');
  const [isKeySaved, setIsKeySaved] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  // Data states
  const [balanceData, setBalanceData] = useState<PierreBalanceData | null>(null);
  const [accounts, setAccounts] = useState<PierreAccount[]>([]);
  const [transactions, setTransactions] = useState<PierreTransaction[]>([]);
  const [billSummaries, setBillSummaries] = useState<PierreBillSummary[]>([]);
  
  // Loading & Sync states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const savedKey = getStoredPierreApiKey();
    setApiKeyInput(savedKey);
    setIsKeySaved(!!savedKey);
    loadPierreData(savedKey);
  }, []);

  const loadPierreData = async (currentKey?: string) => {
    setIsLoading(true);
    try {
      const [balRes, accRes, txRes, billRes] = await Promise.all([
        PierreFinanceService.getBalance(currentKey),
        PierreFinanceService.getAccounts(currentKey),
        PierreFinanceService.getTransactions({}, currentKey),
        PierreFinanceService.getBillSummary({}, currentKey)
      ]);

      if (balRes.data) setBalanceData(balRes.data);
      if (accRes.data) setAccounts(accRes.data);
      if (txRes.data) {
        setTransactions(Array.isArray(txRes.data) ? txRes.data : (txRes.data.transactions || []));
      }
      if (billRes.data) setBillSummaries(billRes.data);
    } catch (err: any) {
      console.error('[Pierre Data Load Error]:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredPierreApiKey(apiKey);
    setIsKeySaved(!!apiKey.trim());
    setShowKeyModal(false);
    loadPierreData(apiKey);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await PierreFinanceService.manualUpdate(apiKey);
      setSyncMessage(res.message);
      await loadPierreData(apiKey);
    } catch (err: any) {
      setSyncMessage(`Erro ao sincronizar: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await PierreFinanceService.getTransactions(
        {
          clientMessage: searchQuery || undefined,
          categories: categoryFilter !== 'all' ? categoryFilter : undefined,
          accountType: accountTypeFilter !== 'all' ? (accountTypeFilter as any) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        },
        apiKey
      );

      if (res.data) {
        setTransactions(Array.isArray(res.data) ? res.data : (res.data.transactions || []));
      }
    } catch (err: any) {
      console.error('[Pierre Search Error]:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const categoriesList = Array.from(new Set(transactions.map(t => t.category).filter(Boolean)));

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Pierre Open Finance
            </h2>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> API Ativa
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Visualização consolidada de saldos bancários, contas e extrato inteligente via Pierre Open Finance API.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKeyModal(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-2xl border border-slate-800 transition-all cursor-pointer"
          >
            <Key className="h-4 w-4 text-indigo-400" />
            <span>{isKeySaved ? 'API Key Configurada' : 'Configurar API Key'}</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Bancos'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Alert */}
      {syncMessage && (
        <div className="bg-slate-900/90 border border-indigo-500/30 p-4 rounded-2xl flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <button onClick={() => setSyncMessage('')} className="text-slate-400 hover:text-white cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400">
                  <Key className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-sm">Configuração da API Key</h3>
              </div>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              Cole sua API Key do Pierre Finance para autenticar as requisições de saldo, faturas e extrato em tempo real.
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5">
                  Chave de API (starts with sk-)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-your-api-key-here"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Não tem uma chave ainda?</span>
                <a
                  href="https://pierre.finance/api-key"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Obter API Key no Pierre <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Salvar e Atualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Total Balance & Account Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Balance Card */}
        <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-500/10 blur-3xl rounded-full" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Saldo Total Consolidado</span>
              <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-black text-white tracking-tight">
              {balanceData ? formatBRL(balanceData.totalBalance) : formatBRL(0)}
            </h3>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Contas Conectadas: <strong className="text-white">{accounts.length}</strong></span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" /> Sincronizado
            </span>
          </div>
        </div>

        {/* Individual Account Cards */}
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-slate-900/80 border border-slate-800/80 p-5 rounded-3xl shadow-lg flex flex-col justify-between hover:border-slate-750 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2.5 rounded-2xl text-indigo-400 border border-slate-700">
                  {acc.type === 'CREDIT' ? <CreditCard className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{acc.name}</h4>
                  <span className="text-[11px] text-slate-400">{acc.brandName || acc.institution || 'Open Finance'}</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                acc.type === 'CREDIT' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              }`}>
                {acc.subtype || acc.type}
              </span>
            </div>

            <div className="mt-4">
              <span className="text-[10px] text-slate-400 font-medium block">Saldo Atual</span>
              <span className={`text-xl font-bold tracking-tight ${acc.balance >= 0 ? 'text-white' : 'text-amber-400'}`}>
                {formatBRL(acc.balance)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Credit Card Bill Summaries Section */}
      {billSummaries.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Faturas de Cartão de Crédito</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {billSummaries.map((bill, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">{bill.accountName || 'Cartão de Crédito'}</span>
                  {bill.dueDate && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                      Vence dia {bill.dueDate}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Fatura Atual</span>
                  <span className="text-lg font-extrabold text-amber-400">{formatBRL(bill.currentBillAmount)}</span>
                </div>

                <div className="space-y-1 text-[11px] border-t border-slate-850 pt-2 text-slate-400">
                  <div className="flex justify-between">
                    <span>Limite Total:</span>
                    <span className="text-white font-medium">{formatBRL(bill.totalLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Limite Disponível:</span>
                    <span className="text-emerald-400 font-medium">{formatBRL(bill.availableLimit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bank Statement (Extrato Inteligente) Section */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-6">
        
        {/* Extrato Header & Search Form */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Extrato Bancário Inteligente
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Filtre suas transações usando linguagem natural via inteligência do Pierre Finance.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-1 max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: 'gastos com alimentação acima de 100 reais'..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0"
            >
              Filtrar
            </button>
          </form>
        </div>

        {/* Filtering Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros rápidos:</span>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="all">Todas as Categoria</option>
            {categoriesList.map((cat, i) => (
              <option key={i} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="all">Todos os Tipos</option>
            <option value="BANK">Conta Bancária</option>
            <option value="CREDIT">Cartão de Crédito</option>
            <option value="INVESTMENT">Investimento</option>
          </select>
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Carregando extrato do Pierre Finance...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <Info className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-xs font-semibold">Nenhuma transação encontrada com os filtros atuais.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {transactions.map((tx) => {
              const isCredit = tx.type === 'CREDIT' || tx.amount > 0;
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-850/40 px-2 rounded-xl transition-all">
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-2xl ${
                      isCredit ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>

                    <div>
                      <h5 className="font-bold text-white text-xs">{tx.description}</h5>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                        <span>•</span>
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-medium text-[10px]">
                          {tx.category || 'Geral'}
                        </span>
                        {tx.paymentMethod && (
                          <>
                            <span>•</span>
                            <span>{tx.paymentMethod}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-extrabold block ${isCredit ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {isCredit ? `+ ${formatBRL(Math.abs(tx.amount))}` : `- ${formatBRL(Math.abs(tx.amount))}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {tx.accountName || 'Conta Bancária'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
