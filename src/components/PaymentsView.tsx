'use client';

import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { Payment } from '../types';
import {
  DollarSign,
  QrCode,
  Copy,
  Calendar,
  FileText,
  Upload,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Camera,
  Layers,
  ArrowDownToLine,
  X,
  Trash2,
  RotateCcw
} from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const { payments, debts, payInstallment, payMultipleDebts, addReserveDeposit, deletePayment, addNotification, reloadFromCloud } = useAppState();
  const [search, setSearch] = useState('');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    bank: string;
    amount: number;
    dueDate: string;
    barcode: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'history' | 'scheduled'>('history');

  // Batch payment states
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [debtAmounts, setDebtAmounts] = useState<{ [id: string]: string }>({});
  const [paymentDate, setPaymentDate] = useState('2026-07-19');
  const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('Pix');
  const [receiptName, setReceiptName] = useState('');
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [pixCodeInput, setPixCodeInput] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [pixDestination, setPixDestination] = useState<'digital' | 'bank'>('digital');

  // Mercado Pago Pix Checkout Modal State
  const [pixModalData, setPixModalData] = useState<{
    id: string;
    amount: number;
    debtCount: number;
    qrCodeBase64: string;
    qrCodeCopyPaste: string;
    status: 'Pendente' | 'Pago' | 'Expirado' | 'Cancelado';
    timeLeft: number;
    debts: { debtId: string; amount: number }[];
    destination?: 'digital' | 'bank';
  } | null>(null);

  const activeDebts = debts.filter(d => d.status !== 'paid');

  const totalPaymentSum = selectedDebtIds.reduce((sum, id) => {
    const val = parseFloat(debtAmounts[id] || '0');
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const filteredPayments = (payments || []).filter((p) => {
    const debtName = p.debtName || 'Dívida';
    const bankName = p.bankName || 'Banco';
    const status = p.status || 'Pendente';
    const matchesSearch = debtName.toLowerCase().includes(search.toLowerCase()) || 
                          bankName.toLowerCase().includes(search.toLowerCase()) ||
                          status.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'history' ? status === 'Pago' : status !== 'Pago';
    return matchesSearch && matchesTab;
  });

  const handleSimulateOCR = () => {
    setOcrScanning(true);
    setOcrResult(null);
    setTimeout(() => {
      setOcrScanning(false);
      setOcrResult({
        bank: 'Nubank',
        amount: 4200.00,
        dueDate: '2026-07-25',
        barcode: '34191.79001 01043.513184 91020.150008 7 97880000420000'
      });
      addNotification('Boleto Escaneado', 'OCR identificou fatura Nubank de R$ 4.200,00.', 'success');
    }, 2000);
  };

  const handlePayScanned = () => {
    if (!ocrResult) return;
    
    // Attempt matching to existing debt (Nubank)
    const matchedDebt = debts.find((d) => d.bank === ocrResult.bank);
    if (matchedDebt) {
      payInstallment(matchedDebt.id, ocrResult.amount, 'Boleto');
    } else {
      addNotification('Pagamento Avulso', `Boleto de R$ ${ocrResult.amount} foi liquidado via Pix.`, 'success');
    }
    setOcrResult(null);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsReceiptLoading(true);
      setTimeout(() => {
        setReceiptName(file.name);
        setIsReceiptLoading(false);
        addNotification('Comprovante Carregado', `Arquivo ${file.name} anexado com sucesso.`, 'success');
      }, 800);
    }
  };

  // Hook de monitoramento do status da cobrança Pix em tempo real
  useEffect(() => {
    if (!pixModalData) return;
    if (pixModalData.status !== 'Pendente') return;

    // 1. Cronômetro de expiração de 10 minutos
    const timer = setInterval(() => {
      setPixModalData((prev) => {
        if (!prev) return null;
        if (prev.timeLeft <= 1) {
          clearInterval(timer);
          return { ...prev, timeLeft: 0, status: 'Expirado' };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    // 2. Polling contra o servidor a cada 3 segundos
    const poller = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/mercado-pago/status?id=${pixModalData.id}`);
        if (!res.ok) return;

        const result = await res.json();
        if (result.success && result.status !== 'Pendente') {
          // Atualiza o estado da modal com o novo status
          setPixModalData((prev) => (prev ? { ...prev, status: result.status } : null));

          if (result.status === 'Pago') {
            clearInterval(poller);
            clearInterval(timer);

            // Efetua a baixa real de todas as dívidas no app
            payMultipleDebts(
              result.debts,
              'Pix',
              new Date().toISOString().split('T')[0],
              `comprovante_mp_${result.id}.pdf`
            );

            // Adiciona o depósito equivalente na carteira de Reserva Inteligente se destino for digital
            if (pixModalData.destination === 'digital') {
              addReserveDeposit(
                result.amount,
                `Reserva Pix Mercado Pago (Lote #${result.id})`
              );
              addNotification(
                'Pagamento Confirmado',
                `O Pix de R$ ${result.amount.toLocaleString('pt-BR')} foi pago! O valor foi direcionado para a sua Reserva Inteligente.`,
                'success'
              );
            } else {
              addNotification(
                'Pagamento Confirmado',
                `O Pix de R$ ${result.amount.toLocaleString('pt-BR')} foi pago! Os fundos foram direcionados diretamente para a conta bancária do credor.`,
                'success'
              );
            }
          }
        }
      } catch (err) {
        console.error('[Polling Error] Falha ao verificar status do Pix:', err);
      }
    }, 1500);

    return () => {
      clearInterval(timer);
      clearInterval(poller);
    };
  }, [pixModalData]);

  const handleCancelPayment = async () => {
    if (!pixModalData) return;
    
    try {
      const res = await fetch('/api/payments/mercado-pago/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: pixModalData.id,
          status: 'Cancelado'
        })
      });
      
      if (res.ok) {
        setPixModalData((prev) => prev ? { ...prev, status: 'Cancelado' } : null);
        addNotification('Cobrança Cancelada', 'A cobrança Pix foi cancelada com sucesso.', 'info');
      } else {
        addNotification('Erro ao Cancelar', 'Não foi possível cancelar a cobrança no servidor.', 'alert');
      }
    } catch (err: any) {
      console.error('[Cancel Payment Error]:', err.message);
      addNotification('Erro ao Cancelar', 'Erro de conexão com o servidor.', 'alert');
    }
  };

  const handleRefund = async (paymentId: string) => {
    if (!confirm('Deseja realmente solicitar o reembolso/estorno deste pagamento? O valor correspondente será devolvido à dívida e o saldo atualizado no banco.')) {
      return;
    }

    try {
      addNotification('Processando Estorno', 'Solicitando estorno/reembolso ao servidor...', 'info');
      const res = await fetch('/api/payments/mercado-pago/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentId })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        addNotification('Estorno Realizado', 'O pagamento foi reembolsado com sucesso e os saldos foram reajustados.', 'success');
        // Recarrega os dados atualizados da nuvem no estado do app
        await reloadFromCloud();
      } else {
        addNotification('Falha no Estorno', result.error || 'Erro ao processar estorno.', 'alert');
      }
    } catch (err: any) {
      console.error('[Refund Request Error]:', err.message);
      addNotification('Erro de Conexão', 'Não foi possível se conectar ao servidor.', 'alert');
    }
  };

  const handleBatchPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDebtIds.length === 0) {
      addNotification('Erro no Pagamento', 'Nenhuma dívida foi selecionada para pagamento.', 'alert');
      return;
    }

    const items = selectedDebtIds.map(id => ({
      debtId: id,
      amount: parseFloat(debtAmounts[id] || '0')
    })).filter(item => item.amount > 0);

    if (items.length === 0) {
      addNotification('Erro no Pagamento', 'Os valores informados devem ser maiores que zero.', 'alert');
      return;
    }

    // Se o método escolhido for Pix, geramos a cobrança dinâmica via Mercado Pago/Sandbox
    if (paymentMethod === 'Pix') {
      setIsReceiptLoading(true);
      try {
        const res = await fetch('/api/payments/mercado-pago/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: totalPaymentSum,
            debts: items,
            email: payerEmail
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Erro ao gerar Pix no Mercado Pago.');
        }

        const result = await res.json();
        if (result.success && result.transaction) {
          const tx = result.transaction;
          setPixModalData({
            id: tx.id,
            amount: tx.amount,
            debtCount: tx.debts.length,
            qrCodeBase64: tx.qrCodeBase64,
            qrCodeCopyPaste: tx.qrCodeCopyPaste,
            status: tx.status,
            timeLeft: 600, // 10 minutos
            debts: tx.debts,
            destination: pixDestination
          });

          // Limpa seleção do formulário de checkout
          setSelectedDebtIds([]);
          setDebtAmounts({});
        }
      } catch (err: any) {
        console.error(err);
        addNotification('Falha no Pix', err.message || 'Erro ao comunicar com Mercado Pago.', 'alert');
      } finally {
        setIsReceiptLoading(false);
      }
      return;
    }

    payMultipleDebts(items, paymentMethod, paymentDate, receiptName || undefined);

    // Reset state
    setSelectedDebtIds([]);
    setDebtAmounts({});
    setReceiptName('');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Central de Pagamentos</h2>
          <p className="text-slate-400 text-xs mt-1">
            Importe boletos via OCR, gerencie Pix agendados e acompanhe o histórico de conciliação.
          </p>
        </div>
      </div>

      {/* Main Row: QR/OCR Import and Manual Pay form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* OCR / Boleto Scanner Box */}
        <div className="bg-gradient-to-br from-indigo-950/20 to-slate-900 border border-slate-850 p-6 rounded-3xl shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Leitor Inteligente OCR</h3>
              <p className="text-[10px] text-slate-400">Importação automática por imagem ou PDF</p>
            </div>
          </div>

          {!ocrResult ? (
            <div className="space-y-4">
              <div 
                onClick={handleSimulateOCR}
                className="border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                {ocrScanning ? (
                  <>
                    <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <span className="text-xs text-indigo-400 font-bold animate-pulse">Lendo PDF e rodando OCR...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-indigo-400 mb-3 animate-bounce" />
                    <span className="text-xs text-slate-200 font-bold">Importar boleto PDF / Foto do QR Code</span>
                    <span className="text-[9.5px] text-slate-500 mt-1">Nós extraímos dados de valor, vencimento e banco emissor</span>
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Copiar e colar código de barras ou Pix..."
                  value={pixCodeInput}
                  onChange={(e) => setPixCodeInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button 
                  onClick={() => {
                    if (pixCodeInput) {
                      addNotification('Código Importado', 'Código Pix decodificado com sucesso.', 'success');
                      setPixCodeInput('');
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between text-xs border-b border-slate-900 pb-3">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> OCR Concluído
                </span>
                <button 
                  onClick={() => setOcrResult(null)} 
                  className="text-slate-500 hover:text-slate-200 text-[10.5px] font-semibold"
                >
                  Descartar
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Credor Identificado:</span>
                  <span className="font-bold text-white">{ocrResult.bank}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vencimento:</span>
                  <span className="font-bold text-white">{new Date(ocrResult.dueDate).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor do Boleto:</span>
                  <span className="font-extrabold text-emerald-400 text-sm">R$ {ocrResult.amount.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-900 pt-2.5">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider font-bold">Código de Barras</span>
                  <span className="font-mono text-[9px] text-slate-300 bg-slate-950 p-2 rounded-lg break-all">
                    {ocrResult.barcode}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePayScanned}
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>Simular Pagamento do Boleto</span>
              </button>
            </div>
          )}

        </div>

        {/* Caixa de Pagamento em Lote (Multi-Dívidas) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <form onSubmit={handleBatchPaymentSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-650/20 p-2 rounded-xl text-indigo-400 border border-indigo-900/30">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Pagamento Inteligente</h3>
                  <p className="text-[10px] text-slate-400">Liquide múltiplas parcelas simultaneamente</p>
                </div>
              </div>
              <span className="text-[9px] text-emerald-400 font-bold uppercase bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">Multi-Baixa</span>
            </div>

            {/* Lista de dívidas ativas para seleção */}
            <div>
              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Selecionar Dívidas e Valores</label>
              {activeDebts.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 italic">Nenhuma dívida ativa pendente.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border border-slate-850 p-2 rounded-xl bg-slate-950/50">
                  {activeDebts.map((debt) => {
                    const isChecked = selectedDebtIds.includes(debt.id);
                    const amountVal = debtAmounts[debt.id] || '';
                    const parsedAmount = parseFloat(amountVal);
                    const remaining = isNaN(parsedAmount) ? debt.currentBalance : Math.max(0, debt.currentBalance - parsedAmount);

                    return (
                      <div key={debt.id} className={`p-2.5 rounded-lg border transition-all ${isChecked ? 'bg-indigo-950/15 border-indigo-900/40' : 'bg-slate-900/30 border-slate-850'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDebtIds([...selectedDebtIds, debt.id]);
                                  setDebtAmounts({ ...debtAmounts, [debt.id]: String(debt.installmentValue) });
                                } else {
                                  setSelectedDebtIds(selectedDebtIds.filter(id => id !== debt.id));
                                  const updatedAmounts = { ...debtAmounts };
                                  delete updatedAmounts[debt.id];
                                  setDebtAmounts(updatedAmounts);
                                }
                              }}
                              className="rounded border-slate-850 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-200 block">{debt.name}</span>
                              <span className="text-[9.5px] text-slate-500 block">{debt.bank} • Saldo: R$ {debt.currentBalance.toLocaleString('pt-BR')}</span>
                            </div>
                          </label>

                          {/* Campo de valor da parcela (exibido apenas se selecionado) */}
                          {isChecked && (
                            <div className="w-24">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Valor"
                                value={amountVal}
                                onChange={(e) => setDebtAmounts({ ...debtAmounts, [debt.id]: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-right text-xs font-bold text-indigo-400 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          )}
                        </div>

                        {/* Indicativo de saldo restante em tempo real */}
                        {isChecked && (
                          <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-indigo-950/20 text-[9px]">
                            <span className="text-slate-500">Saldo Restante pós baixa:</span>
                            <span className={`font-semibold ${remaining === 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                              {remaining === 0 ? 'Quitação Total' : `R$ ${remaining.toLocaleString('pt-BR')}`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Soma de pagamentos */}
            <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Soma Total Selecionada:</span>
              <span className="text-base font-extrabold text-indigo-400">R$ {totalPaymentSum.toLocaleString('pt-BR')}</span>
            </div>
            {/* Vencimento e Método */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-400 mb-1.5">Data de Pagamento</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-400 mb-1.5">Método de Pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Pix">Pix (Mercado Pago)</option>
                  <option value="Boleto">Boleto Bancário</option>
                  <option value="Reserva">Reserva Inteligente</option>
                  <option value="Debito">Débito Automático</option>
                </select>
              </div>
            </div>

            {/* E-mail e Destino para Pix */}
            {paymentMethod === 'Pix' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 mb-1.5">
                      Destino do Recebimento
                    </label>
                    <select
                      value={pixDestination}
                      onChange={(e) => setPixDestination(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="digital">Conta Digital (Reserva Inteligente)</option>
                      <option value="bank">Conta Bancária do Credor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 mb-1.5">
                      E-mail do Pagador (Mercado Pago Sandbox)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Ex: test_user_123456@testuser.com"
                      value={payerEmail}
                      onChange={(e) => setPayerEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <span className="text-[9.5px] text-slate-500 block leading-relaxed">
                  **Aviso:** Ao escolher **Conta Digital (Reserva Inteligente)**, os fundos do Pix são acumulados na sua reserva DataPay. Se escolher **Conta Bancária do Credor**, os fundos vão direto ao banco do credor. Use o e-mail do comprador de testes do painel Mercado Pago para sandbox.
                </span>
              </div>
            )}

            {/* Anexar Comprovante */}
            <div>
              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Anexar Comprovante (Opcional)</label>
              {isReceiptLoading ? (
                <div className="border border-slate-850 bg-slate-950 p-2.5 rounded-xl flex items-center justify-center gap-2">
                  <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-indigo-400 font-bold animate-pulse">Carregando comprovante...</span>
                </div>
              ) : receiptName ? (
                <div className="border border-indigo-950/40 bg-indigo-950/10 p-2.5 rounded-xl flex items-center justify-between">
                  <span className="text-[10px] text-indigo-400 font-semibold font-mono flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {receiptName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReceiptName('')}
                    className="text-slate-500 hover:text-red-400 text-[10px] font-bold"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <label className="border border-dashed border-slate-850 hover:border-indigo-600/30 bg-slate-950/20 hover:bg-slate-900/10 rounded-xl py-3 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5 text-indigo-400" /> Selecione o arquivo do comprovante
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={selectedDebtIds.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-750 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:cursor-not-allowed mt-1"
            >
              Confirmar Pagamento em Lote ({selectedDebtIds.length})
            </button>
          </form>
        </div>

      </div>

      {/* Ledger section */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-md">
        
        {/* Ledger navigation header */}
        <div className="flex justify-between items-center bg-slate-900/30 px-6 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-850">
            <button
              onClick={() => setActiveTab('history')}
              className={`text-[10.5px] px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`text-[10.5px] px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Próximos Agendamentos
            </button>
          </div>

          <div className="relative w-44 md:w-60">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar histórico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-[10.5px] text-white focus:outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Ledger Data Table */}
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-8 w-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-400 text-xs">Sem lançamentos para exibir.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/10 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Dívida / Banco</th>
                  <th className="py-3 px-6">Tipo</th>
                  <th className="py-3 px-6">Valor Pago</th>
                  <th className="py-3 px-6">Saldo Restante</th>
                  <th className="py-3 px-6">Vencimento Original</th>
                  {activeTab === 'history' ? (
                    <>
                      <th className="py-3 px-6">Data de Pagamento</th>
                      <th className="py-3 px-6">Comprovante</th>
                    </>
                  ) : null}
                  <th className="py-3 px-6 text-slate-450 font-bold">Canal</th>
                  <th className="py-3 px-6 text-center text-slate-400 font-bold">Status</th>
                  <th className="py-3 px-6 text-center text-slate-400 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs text-slate-350">
                {filteredPayments.map((p) => {
                  const isPaid = p.status === 'Pago';
                  const isOverdue = p.status === 'Atrasado';

                  return (
                    <tr key={p.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 px-6">
                        <span className="font-bold text-slate-200 block">{p.debtName}</span>
                        <span className="text-[9.5px] text-slate-500 block mt-0.5">{p.bankName}</span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="text-[10px] text-slate-300 font-medium">
                          {p.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-white">
                        R$ {p.amount.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-6 text-slate-400 font-medium">
                        {p.remainingBalanceAfterPayment !== undefined ? `R$ ${p.remainingBalanceAfterPayment.toLocaleString('pt-BR')}` : '-'}
                      </td>
                      <td className="py-3.5 px-6">
                        {new Date(p.dueDate).toLocaleDateString('pt-BR')}
                      </td>
                      {activeTab === 'history' ? (
                        <>
                          <td className="py-3.5 px-6 text-slate-350 font-medium">
                            {p.paidDate ? new Date(p.paidDate).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="py-3.5 px-6 font-mono text-[10px] text-slate-400">
                            {p.receipt ? (
                              <span className="flex items-center gap-1 text-indigo-400 font-semibold cursor-default" title={p.receipt}>
                                <FileText className="h-3 w-3" />
                                {p.receipt.length > 15 ? p.receipt.substring(0, 12) + '...' : p.receipt}
                              </span>
                            ) : '-'}
                          </td>
                        </>
                      ) : null}
                      <td className="py-3.5 px-6 text-slate-450 font-medium">
                        {p.method}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center justify-center">
                          <span className={`px-2 py-0.5 rounded-full border text-[9.5px] font-bold ${
                            isPaid 
                              ? 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400' 
                              : p.status === 'Reembolsado'
                              ? 'bg-purple-950/40 border-purple-900/40 text-purple-400'
                              : isOverdue
                              ? 'bg-red-950/40 border-red-900/40 text-red-400 animate-pulse'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPaid && (
                            <button
                              onClick={() => handleRefund(p.id)}
                              className="bg-slate-950 border border-slate-850 hover:border-indigo-900/40 hover:bg-indigo-950/10 text-indigo-400 p-2 rounded-xl transition-all cursor-pointer"
                              title="Solicitar Reembolso / Estorno"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm('Deseja realmente excluir este lançamento do histórico de pagamentos?')) {
                                deletePayment(p.id);
                              }
                            }}
                            className="bg-slate-950 border border-slate-850 hover:border-red-900/40 hover:bg-red-950/10 text-red-400 p-2 rounded-xl transition-all cursor-pointer"
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
 
      {/* Checkout Modal Mercado Pago Pix */}
      {pixModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center relative space-y-5 my-8">
            
            {/* Header / Close */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Reserva de Dívidas via Pix</h3>
              {pixModalData.status !== 'Pendente' && (
                <button
                  onClick={() => setPixModalData(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              )}
            </div>

            {/* Status Indicator */}
            <div className="flex flex-col items-center space-y-2">
              <div className={`px-3 py-1 rounded-full border text-[10px] font-extrabold flex items-center gap-1.5 ${
                pixModalData.status === 'Pago'
                  ? 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400'
                  : pixModalData.status === 'Pendente'
                  ? 'bg-amber-950/40 border-amber-900/40 text-amber-400 animate-pulse'
                  : 'bg-red-950/40 border-red-900/40 text-red-400'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  pixModalData.status === 'Pago' ? 'bg-emerald-400' : pixModalData.status === 'Pendente' ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                <span>Cobrança {pixModalData.status}</span>
              </div>
              <span className="text-2xl font-extrabold text-white">R$ {pixModalData.amount.toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-slate-400">{pixModalData.debtCount} dívida(s) vinculada(s) à carteira</span>
            </div>

            {/* QR Code visual representation */}
            <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4 relative overflow-hidden group">
              {pixModalData.status === 'Pago' ? (
                <div className="h-44 w-44 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 flex flex-col items-center justify-center space-y-2">
                  <div className="bg-emerald-600/20 text-emerald-400 p-3 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 animate-pulse">Pagamento Aprovado!</span>
                </div>
              ) : pixModalData.status === 'Pendente' ? (
                <>
                  {pixModalData.qrCodeBase64 && pixModalData.qrCodeBase64.length > 200 ? (
                    <img
                      src={`data:image/png;base64,${pixModalData.qrCodeBase64}`}
                      alt="Pix QR Code"
                      className="h-44 w-44 rounded-lg border border-slate-800 p-1.5 bg-white"
                    />
                  ) : (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(pixModalData.qrCodeCopyPaste)}`}
                      alt="Pix QR Code"
                      className="h-44 w-44 rounded-lg border border-slate-800 p-1.5 bg-white"
                    />
                  )}
                  
                  {/* Countdown Timer */}
                  <div className="text-[10.5px] text-slate-450 font-medium">
                    Expira em:{' '}
                    <span className="font-mono font-bold text-amber-500">
                      {Math.floor(pixModalData.timeLeft / 60).toString().padStart(2, '0')}:
                      {(pixModalData.timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </>
              ) : pixModalData.status === 'Cancelado' ? (
                <div className="h-44 w-44 rounded-2xl bg-slate-900/45 border border-slate-800/80 flex flex-col items-center justify-center space-y-2">
                  <div className="bg-slate-800/40 text-slate-400 p-3 rounded-full border border-slate-700/20">
                    <X className="h-8 w-8 text-slate-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-400">Cancelado</span>
                  <span className="text-[9.5px] text-slate-500">A cobrança foi cancelada</span>
                </div>
              ) : (
                <div className="h-44 w-44 rounded-2xl bg-red-950/20 border border-red-900/30 flex flex-col items-center justify-center space-y-2">
                  <span className="text-xs font-bold text-red-450">Tempo Esgotado</span>
                  <span className="text-[9.5px] text-slate-500">A cobrança expirou</span>
                </div>
              )}
            </div>

            {/* Pix Copy and Paste String input and buttons */}
            {pixModalData.status === 'Pendente' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixModalData.qrCodeCopyPaste}
                    className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-[10px] text-slate-400 font-mono focus:outline-none select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pixModalData.qrCodeCopyPaste);
                      addNotification('Pix Copiado', 'Código Pix Copia e Cola copiado para a área de transferência.', 'success');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 rounded-xl cursor-pointer transition-all"
                  >
                    Copiar
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      addNotification('Compartilhar QR Code', 'Link do QR Code compartilhado com sucesso.', 'info');
                    }}
                    className="flex-1 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-300 text-[10.5px] font-bold py-2.5 rounded-xl cursor-pointer"
                  >
                    Compartilhar QR Code
                  </button>
                  <button
                    onClick={handleCancelPayment}
                    className="flex-1 bg-red-950/25 border border-red-900/40 hover:bg-red-900/35 text-red-400 text-[10.5px] font-bold py-2.5 rounded-xl cursor-pointer transition-all"
                  >
                    Cancelar Cobrança
                  </button>
                </div>

                {/* SIMULADOR DE WEBHOOK DO MERCADO PAGO */}
                {pixModalData.id.startsWith('sandbox_mp_') && (
                  <div className="border-t border-slate-850 pt-3 mt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const wRes = await fetch('/api/payments/mercado-pago/webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              simulated: true,
                              id: pixModalData.id,
                              action: 'payment.updated'
                            })
                          });
                          if (wRes.ok) {
                            addNotification('Simulador Webhook', 'Evento de pagamento enviado ao servidor!', 'success');
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="w-full bg-emerald-650/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-900/30 text-[10.5px] font-extrabold py-3 rounded-xl cursor-pointer transition-all animate-pulse"
                    >
                      Simular Confirmação de Pagamento (Webhook)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Approved footer */}
            {pixModalData.status === 'Pago' && (
              <button
                onClick={() => setPixModalData(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3.5 rounded-xl cursor-pointer transition-all"
              >
                Concluir Checkout
              </button>
            )}

            {/* Cancelled / Expired footer */}
            {(pixModalData.status === 'Cancelado' || pixModalData.status === 'Expirado') && (
              <button
                onClick={() => setPixModalData(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3.5 rounded-xl cursor-pointer transition-all"
              >
                Fechar Checkout
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
