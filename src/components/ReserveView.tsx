'use client';

import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import { generatePixQRCodeSVG, getPixCopyPasteCode, getStaticPixPayload } from '../utils/qrCode';
import {
  PiggyBank,
  QrCode,
  Copy,
  CheckCircle,
  HelpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Settings2,
  Lock,
  Wallet,
  Play,
  Trash2
} from 'lucide-react';

export const ReserveView: React.FC = () => {
  const { reserve, updateReserveGoal, addReserveDeposit, deleteReserveHistoryItem, addNotification } = useAppState();
  const [showQRModal, setShowQRModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>(reserve.goalValue.toString());
  const [copied, setCopied] = useState(false);
  const [pixSimulated, setPixSimulated] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalValue, setNewGoalValue] = useState(reserve.goalValue.toString());

  const [pixKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('datapay_pix_key') || '';
    }
    return '';
  });
  const [pixName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('datapay_pix_name') || '';
    }
    return '';
  });
  const [pixCity] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('datapay_pix_city') || '';
    }
    return '';
  });

  const isPixConfigured = pixKey.trim() !== '';

  const currentPixPayload = isPixConfigured
    ? getStaticPixPayload(
        Number(depositAmount) || reserve.goalValue,
        pixKey,
        pixName || 'DATAPAY',
        pixCity || 'SAO PAULO'
      )
    : getPixCopyPasteCode(Number(depositAmount) || reserve.goalValue, 'ReservaFinanceira');

  const copyPixCode = () => {
    navigator.clipboard.writeText(currentPixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePayment = () => {
    setPixSimulated(true);
    setTimeout(() => {
      addReserveDeposit(Number(depositAmount) || reserve.goalValue, 'Aporte via QR Code Pix Direto');
      setShowQRModal(false);
      setPixSimulated(false);
    }, 1500);
  };

  const handleSaveGoal = () => {
    const val = Number(newGoalValue);
    if (val > 0) {
      updateReserveGoal(val);
      setIsEditingGoal(false);
      addNotification('Meta de Reserva Atualizada', `Sua meta mensal foi configurada para R$ ${val.toLocaleString('pt-BR')}.`, 'info');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Reserva Inteligente</h2>
          <p className="text-slate-400 text-xs mt-1">
            Garante saldo dedicado para quitações automáticas e amortizações sem mexer no seu caixa diário.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Overview & Goal Setting */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-md flex flex-col justify-between h-fit lg:col-span-1">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-650/20 p-2.5 rounded-2xl border border-indigo-600/30">
                <PiggyBank className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Painel da Reserva</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Saldo carimbado para quitar dívidas</p>
              </div>
            </div>

            {/* Current Balance Display */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saldo Reservado</span>
              <h4 className="text-2xl font-black text-white tracking-tight mt-1.5">
                R$ {reserve.currentBalance.toLocaleString('pt-BR')}
              </h4>
              <span className="text-[9.5px] text-indigo-400/90 font-medium mt-1 inline-flex items-center gap-1">
                <Wallet className="h-3 w-3 inline text-indigo-400" /> Pix Direto Ativado
              </span>
            </div>

            {/* Goal Setting Section */}
            <div className="border-t border-slate-800/60 pt-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Meta Mensal:</span>
                {isEditingGoal ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newGoalValue}
                      onChange={(e) => setNewGoalValue(e.target.value)}
                      className="w-20 bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={handleSaveGoal}
                      className="bg-emerald-650 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg"
                    >
                      Salvar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">R$ {reserve.goalValue.toLocaleString('pt-BR')}</span>
                    <button
                      onClick={() => setIsEditingGoal(true)}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold text-[11px] flex items-center gap-0.5 cursor-pointer"
                    >
                      <Settings2 className="h-3.5 w-3.5" /> Alterar
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Progresso Médio:</span>
                <span className="text-slate-200 font-semibold">100% (R$ {reserve.goalValue}/mês)</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/60 mt-6">
            <div className="flex flex-col gap-2">
              <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Aporte Rápido</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Valor em R$"
                />
                <button
                  onClick={() => setShowQRModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/10 flex items-center gap-1"
                >
                  <QrCode className="h-4.5 w-4.5" />
                  <span>Aportar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Explanations and transaction history */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Explanation flow widget */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 shadow-md">
            <h3 className="font-bold text-white text-sm mb-4">Como funciona a Reserva Financeira?</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              
              <div className="flex flex-col items-center text-center p-3 bg-slate-950/20 rounded-2xl border border-slate-800/50">
                <div className="h-8 w-8 bg-indigo-900/30 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs border border-indigo-850 mb-2">1</div>
                <h4 className="text-[11px] font-bold text-slate-200">Salário Recebido</h4>
                <p className="text-[9.5px] text-slate-400 mt-1 leading-relaxed">Você recebe sua renda mensal na conta do seu banco padrão.</p>
              </div>

              <div className="flex flex-col items-center text-center p-3 bg-slate-950/20 rounded-2xl border border-slate-800/50">
                <div className="h-8 w-8 bg-indigo-900/30 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs border border-indigo-850 mb-2">2</div>
                <h4 className="text-[11px] font-bold text-slate-200">Geração Pix</h4>
                <p className="text-[9.5px] text-slate-400 mt-1 leading-relaxed">O app gera o QR Code Pix com destino ao seu Mercado Pago.</p>
              </div>

              <div className="flex flex-col items-center text-center p-3 bg-slate-950/20 rounded-2xl border border-slate-800/50">
                <div className="h-8 w-8 bg-indigo-900/30 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs border border-indigo-850 mb-2">3</div>
                <h4 className="text-[11px] font-bold text-slate-200">Dinheiro Guardado</h4>
                <p className="text-[9.5px] text-slate-400 mt-1 leading-relaxed">Os fundos ficam seguros rendendo na sua conta exclusiva.</p>
              </div>

              <div className="flex flex-col items-center text-center p-3 bg-slate-950/20 rounded-2xl border border-slate-800/50">
                <div className="h-8 w-8 bg-indigo-900/30 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs border border-indigo-850 mb-2">4</div>
                <h4 className="text-[11px] font-bold text-slate-200">Pagamento Inteligente</h4>
                <p className="text-[9.5px] text-slate-400 mt-1 leading-relaxed">Na data de vencimento das dívidas, o app quita usando a reserva.</p>
              </div>

            </div>
            
            <div className="mt-4 flex items-center gap-2 bg-indigo-950/20 border border-indigo-900/40 p-3 rounded-2xl">
              <Lock className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <p className="text-[10px] text-slate-300">
                **Segurança Garantida:** O DataPay nunca movimenta ou transfere dinheiro diretamente. Toda operação é simulada e depende do seu consentimento ou envio via Pix manual.
              </p>
            </div>
          </div>

          {/* Transaction Ledger */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 shadow-md">
            <h3 className="font-bold text-white text-sm mb-4">Extrato da Reserva</h3>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {reserve.history.map((h) => {
                const isDeposit = h.type === 'deposit';
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl text-xs hover:border-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl flex items-center justify-center ${
                        isDeposit 
                          ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' 
                          : 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/30'
                      }`}>
                        {isDeposit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200">{h.description}</h4>
                        <span className="text-[9.5px] text-slate-500 block mt-0.5">
                          {new Date(h.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <span className={`font-bold text-sm ${isDeposit ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {isDeposit ? '+' : '-'} R$ {h.amount.toLocaleString('pt-BR')}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm('Deseja realmente excluir este lançamento da reserva?')) {
                            deleteReserveHistoryItem(h.id);
                          }
                        }}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg bg-slate-900/40 border border-slate-850 hover:border-red-900/30 hover:bg-red-950/10 transition-all cursor-pointer"
                        title="Excluir Lançamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Pix QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <div>
                <h3 className="font-bold text-white text-sm">Depositar na Reserva</h3>
                <p className="text-[9.5px] text-slate-400">Transferência via QR Code Pix Dinâmico</p>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-4">
              
              <div className="bg-indigo-950/40 border border-indigo-900/30 p-3 rounded-2xl text-[11px] text-indigo-300 font-semibold w-full">
                Destino: {isPixConfigured ? 'Pix Direto (Sua chave)' : 'Simulador Mercado Pago (Sandbox)'}
              </div>

              {/* Real QR Code Image Rendering */}
              <div className="bg-white p-4 rounded-3xl shadow-inner border border-slate-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(currentPixPayload)}`}
                  alt="QR Code Pix"
                  className="mx-auto w-[180px] h-[180px] rounded-lg"
                />
              </div>

              <div className="text-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Valor do Depósito</span>
                <span className="text-xl font-black text-white">R$ {(Number(depositAmount) || reserve.goalValue).toLocaleString('pt-BR')}</span>
              </div>

              <div className="flex flex-col gap-2 w-full pt-2">
                <button
                  onClick={copyPixCode}
                  className="w-full bg-slate-950 border border-slate-850 hover:bg-slate-850 text-slate-200 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Copy className="h-4 w-4 text-indigo-400" />
                  <span>{copied ? 'Código Copiado!' : 'Copiar Chave Copia e Cola'}</span>
                </button>

                <button
                  onClick={handleSimulatePayment}
                  disabled={pixSimulated}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Play className="h-4 w-4 text-white animate-pulse" />
                  <span>{pixSimulated ? 'Simulando Depósito...' : 'Simular Pagamento do Pix'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Standard X component for modal closing
const X: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
