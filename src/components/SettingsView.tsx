'use client';

import React, { useState } from 'react';
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

export const SettingsView: React.FC = () => {
  const {
    debts,
    payInstallment,
    addReserveDeposit,
    withdrawReserve,
    supabaseConfig,
    saveSupabaseConfig,
    syncWithMongoDB,
    resetData,
    addNotification
  } = useAppState();

  const [activeSettingsTab, setActiveSettingsTab] = useState<'integrations' | 'supabase' | 'security' | 'pix'>('integrations');

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

  // Supabase input states
  const [sbUrl, setSbUrl] = useState(supabaseConfig?.url || '');
  const [sbKey, setSbKey] = useState(supabaseConfig?.anonKey || '');
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

  const handleSaveSb = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(sbUrl, sbKey);
  };

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
            Gerencie conexões bancárias Open Finance, sincronizações do banco de dados Supabase e alertas do PWA.
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
          onClick={() => setActiveSettingsTab('supabase')}
          className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === 'supabase'
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
          
          {/* Tab 1: OFX Statement Import */}
          {activeSettingsTab === 'integrations' && (
            <div className="space-y-6">
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

          {/* Tab 2: Supabase connection */}
          {/* Tab 2: MongoDB connection */}
          {activeSettingsTab === 'supabase' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Sincronização em Nuvem (MongoDB)</h3>
                  <p className="text-[10px] text-slate-400">Salve seus dados na nuvem com segurança e acesse de qualquer dispositivo.</p>
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
                  <span className="text-slate-400 font-medium">ID de Usuário Sincronizado:</span>
                  <span className="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                    {typeof window !== 'undefined' ? localStorage.getItem('datapay_user_id') || 'default_user' : 'default_user'}
                  </span>
                </div>

                <p className="text-[9.5px] text-slate-500 leading-relaxed pt-3 border-t border-slate-850">
                  **Como funciona:** O DataPay sincroniza automaticamente em segundo plano. Em caso de limpeza do cache local ou troca de dispositivo, seus dados de Dívidas, Pagamentos, Reservas e Metas serão totalmente recuperados utilizando este identificador exclusivo.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSyncClick}
                  disabled={isSyncing}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-xs font-bold px-5 py-3.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
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
              <div className="border-t border-slate-850 pt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Autenticação Biométrica e PIN</h3>
                    <p className="text-[10px] text-slate-400">Configure camadas extras de proteção para uso móvel no PWA.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200">Senha PIN de Acesso</h4>
                      <p className="text-[9.5px] text-slate-500 mt-0.5">PIN numérico de 4 dígitos</p>
                    </div>
                    <span className="text-[9.5px] font-bold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded-md">Ativo</span>
                  </div>

                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200">FaceID / TouchID</h4>
                      <p className="text-[9.5px] text-slate-500 mt-0.5">Validação biométrica celular</p>
                    </div>
                    <span className="text-[9.5px] font-bold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded-md">Configurado</span>
                  </div>
                </div>
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
