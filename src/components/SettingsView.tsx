'use client';

import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { BankIntegration } from '../types';
import { parseOFX, OfxTransaction } from '../utils/ofxParser';
import {
  Settings,
  Database,
  Key,
  ShieldCheck,
  Bell,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Link,
  LockKeyhole,
  Check,
  X,
  UploadCloud,
  FileCode,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';

import { getStoredPierreApiKey, setStoredPierreApiKey } from '../services/pierreService';
import {
  isBiometricsSupported,
  isBiometricsEnabled,
  setBiometricsEnabled,
  registerBiometrics,
  getBackupPin,
  setBackupPin
} from '../utils/webauthn';

export const SettingsView: React.FC = () => {
  const {
    debts,
    payInstallment,
    addReserveDeposit,
    withdrawReserve,
    syncWithMongoDB,
    resetData,
    addNotification,
    syncEmail,
    connectSyncEmail
  } = useAppState();

  const [activeSettingsTab, setActiveSettingsTab] = useState<'integrations' | 'mongodb' | 'security' | 'pix'>('integrations');
  const [emailInput, setEmailInput] = useState(syncEmail);

  // Biometrics & Security states
  const [bioEnabled, setBioEnabled] = useState<boolean>(false);
  const [pinValue, setPinValue] = useState<string>('');
  const [showPinInputModal, setShowPinInputModal] = useState<boolean>(false);

  useEffect(() => {
    setEmailInput(syncEmail);
    setBioEnabled(isBiometricsEnabled());
    setPinValue(getBackupPin());
  }, [syncEmail]);

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (enabled) {
      const res = await registerBiometrics();
      if (res.success) {
        setBioEnabled(true);
        addNotification('Segurança Biométrica Ativada', res.message, 'success');
      } else {
        if (getBackupPin()) {
          setBiometricsEnabled(true);
          setBioEnabled(true);
          addNotification('Bloqueio por PIN Ativado', 'O bloqueio do aplicativo usando PIN foi ativado com sucesso!', 'success');
        } else {
          setShowPinInputModal(true);
        }
      }
    } else {
      setBiometricsEnabled(false);
      setBioEnabled(false);
      addNotification('Bloqueio Desativado', 'O bloqueio biométrico do aplicativo foi desativado.', 'info');
    }
  };

  const handleSaveBackupPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValue || pinValue.trim().length < 4) {
      addNotification('PIN Inválido', 'O PIN deve ter no mínimo 4 dígitos numéricos.', 'error');
      return;
    }
    setBackupPin(pinValue.trim());
    setBiometricsEnabled(true);
    setBioEnabled(true);
    setShowPinInputModal(false);
    addNotification('PIN Salvo e Bloqueio Ativado', 'Seu PIN de segurança foi configurado e o bloqueio do app foi ativado!', 'success');
  };

  // Pix direct config states
  const [pixKey, setPixKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('datapay_pix_key') || '';
    }
    return '';
  });
  const [pixName, setPixName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('datapay_pix_name') || '';
    }
    return '';
  });
  const [pixCity, setPixCity] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('datapay_pix_city') || '';
    }
    return '';
  });

  const handleSavePixConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('datapay_pix_key', pixKey);
    localStorage.setItem('datapay_pix_name', pixName);
    localStorage.setItem('datapay_pix_city', pixCity);
    addNotification('Configuração Pix Salva', 'Sua chave Pix e dados do titular foram salvos com sucesso!', 'success');
  };

  const [pierreApiKey, setPierreApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return getStoredPierreApiKey();
    }
    return '';
  });

  const handleSavePierreKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredPierreApiKey(pierreApiKey);
    addNotification('Chave Pierre API Salva', 'Sua API Key do Pierre Finance foi atualizada com sucesso!', 'success');
  };

  const [isSyncing, setIsSyncing] = useState(false);

  // OFX Import states
  const [ofxTransactions, setOfxTransactions] = useState<OfxTransaction[]>([]);
  const [ofxFileName, setOfxFileName] = useState<string>('');
  const [txActions, setTxActions] = useState<Record<string, string>>({});

  // Notification states
  const [notifPreferences, setNotifPreferences] = useState({
    sevenDays: true,
    threeDays: true,
    oneDay: true,
    dayOf: true,
    delay: true,
    reserveInsufficient: true,
    goalMet: true
  });

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await syncWithMongoDB();
    setIsSyncing(false);
  };

  const handleOfxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOfxFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseOFX(text);
        setOfxTransactions(parsed);
        
        // Inicializa as ações sugeridas por padrão como 'ignore'
        const initialActions: Record<string, string> = {};
        parsed.forEach(tx => {
          initialActions[tx.id] = 'ignore';
        });
        setTxActions(initialActions);

        addNotification(
          'Extrato Processado',
          `Extrato OFX de ${file.name} processado. ${parsed.length} transações identificadas!`,
          'success'
        );
      } catch (err) {
        addNotification('Erro de Leitura', 'Formato OFX inválido ou corrompido.', 'alert');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    let importedPayments = 0;
    let importedReserves = 0;

    ofxTransactions.forEach((tx) => {
      const action = txActions[tx.id];
      if (!action || action === 'ignore') return;

      const amount = Math.abs(tx.amount);

      if (action === 'reserve') {
        if (tx.type === 'CREDIT') {
          addReserveDeposit(amount, `Extrato: ${tx.description}`);
        } else {
          withdrawReserve(amount, `Extrato: ${tx.description}`);
        }
        importedReserves++;
      } else if (action.startsWith('debt:')) {
        const debtId = action.split(':')[1];
        payInstallment(debtId, amount, 'Boleto');
        importedPayments++;
      }
    });

    addNotification(
      'Importação Concluída',
      `Importado com sucesso: ${importedPayments} amortizações de dívidas e ${importedReserves} lançamentos de reserva.`,
      'success'
    );

    setOfxTransactions([]);
    setOfxFileName('');
    setTxActions({});
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Painel de Configurações</h2>
          <p className="text-slate-400 text-xs mt-1">
            Gerencie conexões bancárias Open Finance, sincronizações do banco de dados MongoDB e alertas do PWA.
          </p>
        </div>
      </div>

      {/* Sub tabs selectors */}
      <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-850 w-fit">
        <button
          onClick={() => setActiveSettingsTab('integrations')}
          className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === 'integrations'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Extrato Bancário (OFX)
        </button>
        <button
          onClick={() => setActiveSettingsTab('mongodb')}
          className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === 'mongodb'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Backup em Nuvem
        </button>
        <button
          onClick={() => setActiveSettingsTab('security')}
          className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === 'security'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Segurança & Alertas
        </button>
        <button
          onClick={() => setActiveSettingsTab('pix')}
          className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === 'pix'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pix Direto
        </button>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active tab contents (2 columns wide) */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md">
          
          {/* Tab 1: Pierre Open Finance & OFX Statement Import */}
          {activeSettingsTab === 'integrations' && (
            <div className="space-y-8">
              
              {/* Pierre Open Finance API Card */}
              <div className="bg-slate-950 border border-indigo-500/30 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-500/30">
                      <Key className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Pierre Open Finance API</h3>
                      <p className="text-[10px] text-slate-400">Integração em tempo real para saldo, extrato e faturas via Pierre Finance.</p>
                    </div>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Ativo
                  </span>
                </div>

                <form onSubmit={handleSavePierreKey} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                      API Key do Pierre Finance (sk-...)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={pierreApiKey}
                        onChange={(e) => setPierreApiKey(e.target.value)}
                        placeholder="sk-your-api-key-here"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer shrink-0"
                      >
                        Salvar Chave
                      </button>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Obtenha sua chave gratuita em <a href="https://pierre.finance/api-key" target="_blank" rel="noreferrer" className="text-indigo-400 underline">pierre.finance/api-key</a>.
                  </p>
                </form>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Importação de Extrato Bancário (OFX)</h3>
                  <p className="text-[10px] text-slate-400">Processamento 100% local, gratuito e privado dos dados de faturas e saldos.</p>
                </div>
              </div>

              {ofxTransactions.length === 0 ? (
                /* Drag-and-drop Upload Area */
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-600/60 rounded-3xl p-8 transition-all flex flex-col items-center justify-center text-center space-y-4 bg-slate-900/10">
                  <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                    <FileCode className="h-8 w-8 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Arraste ou selecione seu arquivo .OFX</p>
                    <p className="text-[10px] text-slate-450 mt-1 max-w-[280px] mx-auto leading-normal">
                      Exportado gratuitamente do app de qualquer banco brasileiro (Nubank, Itaú, BB, etc.).
                    </p>
                  </div>
                  <label className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold px-5 py-3 rounded-2xl cursor-pointer transition-all shadow-md shadow-indigo-600/10">
                    Selecionar Arquivo
                    <input
                      type="file"
                      accept=".ofx"
                      onChange={handleOfxUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                /* Transactions Table List */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                    <div>
                      <h4 className="font-bold text-xs text-white">Transações Encontradas ({ofxTransactions.length})</h4>
                      <p className="text-[9.5px] text-slate-400">Arquivo: {ofxFileName}</p>
                    </div>
                    <button
                      onClick={() => {
                        setOfxTransactions([]);
                        setOfxFileName('');
                        setTxActions({});
                      }}
                      className="text-[10px] font-bold text-red-405 hover:text-red-350 cursor-pointer flex items-center gap-1 bg-transparent border-0"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-2">
                    {ofxTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                            tx.type === 'CREDIT' 
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                              : 'bg-rose-950/40 text-rose-450 border border-rose-900/30'
                          }`}>
                            {tx.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          </span>
                          <div>
                            <span className="text-[11px] font-bold text-white block max-w-[200px] truncate">{tx.description}</span>
                            <span className="text-[9px] text-slate-500 block mt-0.5">
                              {new Date(tx.date).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className={`text-xs font-bold ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-slate-350'}`}>
                            {tx.type === 'CREDIT' ? '+' : '-'} R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>

                          <select
                            value={txActions[tx.id] || 'ignore'}
                            onChange={(e) => setTxActions({ ...txActions, [tx.id]: e.target.value })}
                            className="bg-slate-900 border border-slate-850 rounded-xl px-2 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-indigo-500 w-[160px]"
                          >
                            <option value="ignore">Ignorar</option>
                            <option value="reserve">Reserva Inteligente</option>
                            {tx.type === 'DEBIT' && debts.length > 0 && (
                              <optgroup label="Amortizar Dívida">
                                {debts.map((d) => (
                                  <option key={d.id} value={`debt:${d.id}`}>{d.name} ({d.bank})</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleConfirmImport}
                    className="w-full bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold py-3.5 rounded-2xl transition-all cursor-pointer shadow-md shadow-indigo-600/10 text-center"
                  >
                    Confirmar e Importar Transações Selecionadas
                  </button>
                </div>
              )}

              {/* Instructions details */}
              <div className="pt-4 border-t border-slate-850 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Info className="h-4 w-4" />
                  <span className="text-xs font-bold">Como baixar o arquivo OFX no seu banco:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-2xl space-y-1.5">
                    <span className="text-[10.5px] font-bold text-white">💜 Nubank</span>
                    <p className="text-[9.5px] text-slate-450 leading-relaxed">
                      Acesse o Saldo da Conta {" → "} Clique em "Histórico" {" → "} Selecione "Exportar extrato" {" → "} Escolha o formato **OFX**.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-2xl space-y-1.5">
                    <span className="text-[10.5px] font-bold text-white">🧡 Itaú</span>
                    <p className="text-[9.5px] text-slate-450 leading-relaxed">
                      No computador, vá em Extrato da Conta {" → "} Clique em "Salvar em outros formatos" {" → "} Escolha o formato **OFX**.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-2xl space-y-1.5">
                    <span className="text-[10.5px] font-bold text-white">💛 Banco do Brasil</span>
                    <p className="text-[9.5px] text-slate-450 leading-relaxed">
                      No app/web, vá na seção Extrato {" → "} Clique no botão de exportar/salvar {" → "} Selecione o formato **OFX**.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: MongoDB connection */}
          {activeSettingsTab === 'mongodb' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Sincronização em Nuvem (MongoDB)</h3>
                  <p className="text-[10px] text-slate-400">Guarde suas faturas e dívidas na nuvem e acesse de qualquer aparelho.</p>
                </div>
              </div>

              <div className="p-5 bg-slate-950/20 border border-slate-850 rounded-2xl text-xs space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Status da Conexão:</span>
                  <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                    <Check className="h-4 w-4" /> Conectado (MongoDB)
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">E-mail Vinculado:</span>
                  <span className="text-slate-200 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                    {syncEmail || 'Nenhum e-mail vinculado'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">ID do Banco de Dados:</span>
                  <span className="font-mono text-slate-350 text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                    {typeof window !== 'undefined' ? localStorage.getItem('datapay_user_id') || 'default_user' : 'default_user'}
                  </span>
                </div>
              </div>

              {/* Form para vincular e-mail de sincronização multi-plataforma */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!emailInput.trim()) return;
                setIsSyncing(true);
                await connectSyncEmail(emailInput);
                setIsSyncing(false);
              }} className="space-y-4 bg-slate-950/20 border border-slate-850 p-5 rounded-2xl">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-400 mb-1.5 block">Sincronizar Celular e Computador</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      required
                      placeholder="Ex: seu-email@dominio.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isSyncing}
                      className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98]"
                    >
                      Vincular Dispositivo
                    </button>
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
                    **Como funciona:** Insira o **mesmo e-mail** no seu computador e no seu celular. Ao fazer isso, ambos os aparelhos compartilharão instantaneamente o mesmo banco de dados na nuvem!
                  </p>
                </div>
              </form>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleSyncClick}
                  disabled={isSyncing}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-855 text-slate-200 text-xs font-bold px-5 py-3.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Security & Alerts */}
          {activeSettingsTab === 'security' && (
            <div className="space-y-6">
              
              {/* Alertas configs */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Alertas e Notificações de Vencimento</h3>
                    <p className="text-[10px] text-slate-400">Configure avisos automáticos via push-notification do PWA ou WhatsApp.</p>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-950/20 p-4 border border-slate-850 rounded-2xl text-xs text-slate-300">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPreferences.sevenDays}
                      onChange={(e) => setNotifPreferences({ ...notifPreferences, sevenDays: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                    />
                    <span>Notificar 7 dias antes do vencimento</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPreferences.threeDays}
                      onChange={(e) => setNotifPreferences({ ...notifPreferences, threeDays: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                    />
                    <span>Notificar 3 dias antes do vencimento</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPreferences.oneDay}
                      onChange={(e) => setNotifPreferences({ ...notifPreferences, oneDay: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                    />
                    <span>Notificar 1 dia antes do vencimento (Alerta prioritário)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPreferences.dayOf}
                      onChange={(e) => setNotifPreferences({ ...notifPreferences, dayOf: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                    />
                    <span>Avisar no dia do vencimento</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPreferences.delay}
                      onChange={(e) => setNotifPreferences({ ...notifPreferences, delay: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                    />
                    <span>Avisar em caso de parcelas vencidas (Juros corrente)</span>
                  </label>
                </div>
              </div>

              {/* Authentication options security */}
              <div className="border-t border-slate-850 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                      <LockKeyhole className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Autenticação Biométrica e PIN</h3>
                      <p className="text-[10px] text-slate-400">Exigir validação por Digital/Face ID ou PIN ao abrir o DataPay.</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bioEnabled}
                      onChange={(e) => handleToggleBiometrics(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* PIN Config Card */}
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200">Senha PIN de Backup</h4>
                      <p className="text-[9.5px] text-slate-500 mt-0.5">
                        {getBackupPin() ? 'PIN numérico configurado' : 'Nenhum PIN de backup cadastrado'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPinInputModal(true)}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      {getBackupPin() ? 'Alterar PIN' : 'Cadastrar PIN'}
                    </button>
                  </div>

                  {/* Biometric Status Card */}
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200">Leitor Biométrico (WebAuthn)</h4>
                      <p className="text-[9.5px] text-slate-500 mt-0.5">
                        {isBiometricsSupported() ? 'Dispositivo Suportado (Fingerprint / Face ID)' : 'Não suportado no navegador atual'}
                      </p>
                    </div>
                    <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md ${
                      bioEnabled ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-500/20' : 'text-slate-500 bg-slate-950'
                    }`}>
                      {bioEnabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                {/* PIN Modal dialog */}
                {showPinInputModal && (
                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h4 className="font-bold text-white text-sm">Cadastrar PIN de Segurança</h4>
                        <button onClick={() => setShowPinInputModal(false)} className="text-slate-400 hover:text-white">&times;</button>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        Digite uma senha numérica de 4 a 6 dígitos para ser utilizada como contingência se a leitura biométrica falhar.
                      </p>

                      <form onSubmit={handleSaveBackupPin} className="space-y-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 block mb-1">PIN Numérico (4 a 6 números)</label>
                          <input
                            type="password"
                            maxLength={6}
                            required
                            pattern="[0-9]*"
                            inputMode="numeric"
                            value={pinValue}
                            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                            placeholder="Ex: 1234"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg font-bold tracking-widest text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowPinInputModal(false)}
                            className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer"
                          >
                            Salvar PIN
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {activeSettingsTab === 'pix' && (
            <form onSubmit={handleSavePixConfig} className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Configuração de Pix Direto (Sem Intermediários)</h3>
                  <p className="text-[10px] text-slate-400">Insira sua chave Pix pessoal. O sistema gerará QR Codes scannáveis que transferem diretamente para você.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-400 mb-1.5">Chave Pix Recebedora</label>
                  <input
                    type="text"
                    required
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Chave Aleatória, CPF, CNPJ, E-mail ou Telefone"
                  />
                  <p className="text-[9px] text-slate-505 mt-1">Exemplo: sua chave aleatória ou CPF (digite apenas números e letras).</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 mb-1.5">Nome do Titular da Conta</label>
                    <input
                      type="text"
                      required
                      value={pixName}
                      onChange={(e) => setPixName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Nome Completo do Titular"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 mb-1.5">Cidade do Recebedor</label>
                    <input
                      type="text"
                      required
                      value={pixCity}
                      onChange={(e) => setPixCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Cidade do Recebedor (ex: Sao Paulo)"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/10"
              >
                Salvar Configurações Pix
              </button>
            </form>
          )}

        </div>

        {/* System controls card (1 column wide) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md flex flex-col justify-between h-fit">
          <div className="space-y-4">
            <h3 className="font-bold text-white text-sm">Gestão de Sistema</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Controle o tema de interface visual e restaure o banco de simulação local a qualquer momento.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 font-medium">Tema Visual:</span>
                <span className="font-extrabold text-white bg-slate-950 border border-slate-850 px-3 py-1 rounded-xl">
                  Modo Escuro (Digital)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 font-medium">Sincronização:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="h-4 w-4" /> Automático
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (confirm('Deseja realmente limpar todos os seus dados locais e recomeçar a simulação?')) {
                resetData();
                window.location.reload();
              }
            }}
            className="w-full bg-red-950/30 border border-red-900/40 hover:bg-red-950/60 text-red-400 text-xs font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 mt-8 cursor-pointer"
          >
            <Trash2 className="h-4.5 w-4.5" />
            <span>Resetar Banco de Dados</span>
          </button>
        </div>

      </div>



    </div>
  );
};
