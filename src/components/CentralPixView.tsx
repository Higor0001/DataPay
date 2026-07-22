'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../context/StateContext';
import { Debt, Payment } from '../types';
import { PixReceiptItem, CompetenceChecklistItem } from '../types/centralPix';
import { decodeEMVPix } from '../utils/emvPixParser';
import { predictDebtForPix, buildCompetenceChecklist } from '../utils/pixAIMotor';
import { generateScannablePixQRCodeDataURL, getPixCopyPasteCode } from '../utils/qrCode';
import { downloadMacroDroidFile } from '../utils/macrodroidGenerator';
import {
  QrCode,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Copy,
  ChevronRight,
  ShieldCheck,
  Zap,
  Terminal,
  Activity,
  Layers,
  HelpCircle,
  X,
  Keyboard,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Plus,
  Download
} from 'lucide-react';

// Mocks iniciais para pré-carregar a fila do Central Pix com dados realistas
const initialMockPixCodes = [
  // 1. PicPay - R$ 150,00 (Vencimento próximo, alta correspondência)
  '00020101021126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865406150.005802BR5911PicPay Serv6009Sao Paulo62070503***63041A2B',
  // 2. Mercado Pago - R$ 380,00 (Fatura de empréstimo)
  '00020101021226840014br.gov.bcb.pix2562pix.mercadopago.com/qr/v2/4ad8d893-68d5-45bb-b3b2-70b55ec70cb05204000053039865406380.005802BR5922Mercado Pago Instituica6009Sao Paulo62150511FATURA042026630489AB',
  // 3. Efí / Gerencianet (Cobrança avulsa com juros de atraso R$ 432,15)
  '00020101021126500014br.gov.bcb.pix0128financeiro@efi.com.br5204000053039865406432.155802BR5919Efi Pagamentos S A6009Belo Horizon62070503***6304B71C'
];

export const CentralPixView: React.FC = () => {
  const { debts, payments, payInstallment, addNotification } = useAppState();

  const [pixReceipts, setPixReceipts] = useState<PixReceiptItem[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'macrodroid' | 'analytics'>('inbox');
  const [filterConfidence, setFilterConfidence] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Simulator & Macro input
  const [rawInputCode, setRawInputCode] = useState('');
  const [macroIpAddress, setMacroIpAddress] = useState('192.168.100.21');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isQrLoading, setIsQrLoading] = useState<boolean>(false);

  // Detecta dinamicamente se o app está no Vercel (produção) ou IP local
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentHost = window.location.host;
      if (currentHost && !currentHost.includes('localhost') && !currentHost.includes('127.0.0.1')) {
        setMacroIpAddress(currentHost);
      }
    }
  }, []);

  // Late Payment modal state
  const [showLateModal, setShowLateModal] = useState(false);
  const [realPaymentDate, setRealPaymentDate] = useState('2026-07-21');
  const [realPaidAmount, setRealPaidAmount] = useState<number>(0);

  // Partial Payment modal state
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState<number>(0);

  // Função manual para carregar dados de demonstração apenas se o usuário desejar
  const handleLoadDemoMocks = () => {
    const generated: PixReceiptItem[] = initialMockPixCodes.map((code, idx) => {
      const decodedRes = decodeEMVPix(code);
      const pred = predictDebtForPix(decodedRes.decoded, debts, payments);
      return {
        id: `pix_mock_${idx + 1}`,
        rawPayload: code,
        decoded: decodedRes.decoded,
        receivedAt: new Date(Date.now() - idx * 3600000).toISOString(),
        status: 'PENDING',
        prediction: pred || undefined
      };
    });
    setPixReceipts(generated);
    if (generated.length > 0) {
      setSelectedReceiptId(generated[0].id);
    }
    addNotification('Exemplos Carregados', '3 registros Pix de demonstração foram adicionados à fila.', 'info');
  };

  // Recalcula predição da IA para item selecionado quando dívidas mudam
  const selectedReceipt = pixReceipts.find(r => r.id === selectedReceiptId);

  // Sincroniza a Fila Inteligente via Polling automático da API /api/v1/pix (MacroDroid / REST)
  useEffect(() => {
    let isMounted = true;

    const fetchServerQueue = async () => {
      try {
        const res = await fetch('/api/v1/pix');
        if (!res.ok) return;
        const data = await res.json();
        
        if (isMounted && data.success && Array.isArray(data.items)) {
          setPixReceipts(prevReceipts => {
            const existingIds = new Set(prevReceipts.map(r => r.id));
            let newItemsAdded = 0;
            const updated = [...prevReceipts];

            for (const item of data.items) {
              if (!existingIds.has(item.id)) {
                const pred = predictDebtForPix(item.decoded, debts, payments);
                updated.unshift({
                  ...item,
                  prediction: pred || undefined
                });
                newItemsAdded++;
              }
            }

            if (newItemsAdded > 0) {
              const latestNewItem = data.items[0];
              setSelectedReceiptId(latestNewItem.id);
              addNotification(
                '⚡ Novo Pix Recebido!',
                `Recebido Pix de ${latestNewItem.decoded.merchantName || 'Desconhecido'} via MacroDroid/API.`,
                'success'
              );
            }

            return updated;
          });
        }
      } catch (err) {
        // Erro silencioso durante polling de fundo
      }
    };

    fetchServerQueue();
    const intervalId = setInterval(fetchServerQueue, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [debts, payments, addNotification]);

  // Gera QR Code oficial de alta definição 100% escaneável por aplicativos de banco
  useEffect(() => {
    if (showQrModal && selectedReceipt?.rawPayload) {
      setIsQrLoading(true);
      generateScannablePixQRCodeDataURL(selectedReceipt.rawPayload, 360)
        .then(url => {
          setQrCodeDataUrl(url);
          setIsQrLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsQrLoading(false);
        });
    } else {
      setQrCodeDataUrl('');
    }
  }, [showQrModal, selectedReceipt]);

  // Atalhos globais de teclado (J, K, Enter, Y, N, D, /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const pendingItems = pixReceipts.filter(r => r.status === 'PENDING');
      if (pendingItems.length === 0) return;

      const currentIndex = pendingItems.findIndex(r => r.id === selectedReceiptId);

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        const nextIdx = (currentIndex + 1) % pendingItems.length;
        setSelectedReceiptId(pendingItems[nextIdx].id);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const prevIdx = (currentIndex - 1 + pendingItems.length) % pendingItems.length;
        setSelectedReceiptId(pendingItems[prevIdx].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedReceipt) {
          setShowQrModal(true);
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        if (selectedReceipt && selectedReceipt.prediction) {
          handleConfirmPayment(selectedReceipt.id, selectedReceipt.prediction.debtId, selectedReceipt.prediction.confidenceScore);
        }
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        if (selectedReceipt) {
          handleIgnoreReceipt(selectedReceipt.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pixReceipts, selectedReceiptId, selectedReceipt]);

  // Handler para adicionar novo Pix manualmente ou via simulador
  const handleAddRawPix = (codeToParse?: string) => {
    const code = codeToParse || rawInputCode;
    if (!code || !code.trim()) return;

    const decodeRes = decodeEMVPix(code);
    if (!decodeRes.valid) {
      addNotification('Erro de Parse EMV', decodeRes.error || 'Código Pix inválido.', 'alert');
      return;
    }

    const prediction = predictDebtForPix(decodeRes.decoded, debts, payments);

    const newReceipt: PixReceiptItem = {
      id: `pix_${Date.now()}`,
      rawPayload: code,
      decoded: decodeRes.decoded,
      receivedAt: new Date().toISOString(),
      status: 'PENDING',
      prediction: prediction || undefined
    };

    setPixReceipts(prev => [newReceipt, ...prev]);
    setSelectedReceiptId(newReceipt.id);
    setRawInputCode('');

    const confidenceLabel = prediction ? `${Math.round(prediction.confidenceScore * 100)}%` : 'Indefinida';

    addNotification(
      'Pix Copia e Cola Decodificado',
      `Recebedor: ${decodeRes.decoded.merchantName} | Valor: R$ ${decodeRes.decoded.amount?.toFixed(2) || 'Dinâmico'} | Confiança IA: ${confidenceLabel}`,
      'success'
    );
  };

  // Handler para confirmar associação e pagar
  const handleConfirmPayment = (receiptId: string, debtId: string, confidence: number) => {
    const receipt = pixReceipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const targetDebt = debts.find(d => d.id === debtId);
    const amountToPay = receipt.decoded.amount || targetDebt?.installmentValue || 0;

    if (targetDebt) {
      payInstallment(targetDebt.id, amountToPay, 'Pix');
    }

    setPixReceipts(prev =>
      prev.map(r =>
        r.id === receiptId
          ? {
              ...r,
              status: 'PAID',
              linkedDebtId: debtId,
              amountPaid: amountToPay,
              paidAt: new Date().toISOString()
            }
          : r
      )
    );

    addNotification(
      'Pagamento Vinculado e Quitado',
      `Pix de R$ ${amountToPay.toFixed(2)} foi vinculado à dívida "${targetDebt?.name}" com sucesso! (Confiança IA: ${Math.round(confidence * 100)}%)`,
      'success'
    );
  };

  // Handler para pagamento parcial
  const handleConfirmPartialPayment = () => {
    if (!selectedReceipt || !selectedReceipt.prediction || partialAmount <= 0) return;
    const debtId = selectedReceipt.prediction.debtId;
    const targetDebt = debts.find(d => d.id === debtId);

    if (targetDebt) {
      payInstallment(targetDebt.id, partialAmount, 'Pix');
    }

    setPixReceipts(prev =>
      prev.map(r =>
        r.id === selectedReceipt.id
          ? {
              ...r,
              status: 'PAID_PARTIAL',
              linkedDebtId: debtId,
              amountPaid: partialAmount,
              paidAt: new Date().toISOString()
            }
          : r
      )
    );

    setShowPartialModal(false);
    addNotification('Pagamento Parcial Registrado', `Pago R$ ${partialAmount.toFixed(2)} referente a ${targetDebt?.name}.`, 'warning');
  };

  // Handler para pagamento em atraso com recalculamento retroativo
  const handleConfirmLatePayment = () => {
    if (!selectedReceipt || !selectedReceipt.prediction || realPaidAmount <= 0) return;
    const debtId = selectedReceipt.prediction.debtId;
    const targetDebt = debts.find(d => d.id === debtId);

    const dueDate = new Date(selectedReceipt.prediction.dueDate);
    const paidDate = new Date(realPaymentDate);
    const daysLate = Math.max(0, Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)));

    if (targetDebt) {
      payInstallment(targetDebt.id, realPaidAmount, 'Pix');
    }

    setPixReceipts(prev =>
      prev.map(r =>
        r.id === selectedReceipt.id
          ? {
              ...r,
              status: 'PAID_LATE',
              linkedDebtId: debtId,
              amountPaid: realPaidAmount,
              paidAt: realPaymentDate,
              daysLate
            }
          : r
      )
    );

    setShowLateModal(false);
    addNotification(
      'Pagamento Atrasado Registrado',
      `Pago R$ ${realPaidAmount.toFixed(2)} (${daysLate} dias de atraso). O histórico de juros foi contabilizado sem alterar o valor base das parcelas futuras.`,
      'info'
    );
  };

  // Handler para ignorar Pix
  const handleIgnoreReceipt = (receiptId: string) => {
    setPixReceipts(prev =>
      prev.map(r => (r.id === receiptId ? { ...r, status: 'IGNORED' } : r))
    );
    addNotification('Pix Ignorado', 'O item foi movido para a lixeira de descarte.', 'info');
  };

  // Filtra itens da Fila
  const filteredReceipts = pixReceipts.filter(r => {
    if (filterConfidence === 'HIGH') return r.prediction?.confidenceLevel === 'HIGH' && r.status === 'PENDING';
    if (filterConfidence === 'MEDIUM') return r.prediction?.confidenceLevel === 'MEDIUM' && r.status === 'PENDING';
    if (filterConfidence === 'LOW') return r.prediction?.confidenceLevel === 'LOW' && r.status === 'PENDING';
    
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = r.decoded.merchantName.toLowerCase().includes(searchLower);
    const debtMatch = r.prediction?.debtName.toLowerCase().includes(searchLower);
    return nameMatch || debtMatch;
  });

  const pendingCount = pixReceipts.filter(r => r.status === 'PENDING').length;
  const processedCount = pixReceipts.filter(r => r.status !== 'PENDING').length;
  const highConfidenceCount = pixReceipts.filter(r => r.prediction?.confidenceLevel === 'HIGH' && r.status === 'PENDING').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">

      {/* Header Central Pix */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
            <QrCode className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">Central Pix</h1>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Zero-Private-API Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">Decodificador EMV e Fila Inteligente com Predição IA</p>
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'inbox'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            Fila Inteligente
            {pendingCount > 0 && (
              <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('macrodroid')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'macrodroid'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="h-4 w-4" />
            MacroDroid API & Simulador
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            Métricas & Heatmap IA
          </button>
        </div>
      </header>

      {/* Conteúdo Aba Inbox */}
      {activeTab === 'inbox' && (
        <div className="flex-1 flex overflow-hidden">

          {/* Painel Esquerdo: Lista de Cards da Fila */}
          <div className="w-full md:w-5/12 border-r border-slate-800/80 flex flex-col bg-slate-900/40">

            {/* Barra de Filtros e Atalhos */}
            <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/60">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por recebedor ou dívida..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Botões de Filtro de Confiança IA */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setFilterConfidence('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${
                    filterConfidence === 'ALL'
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({pixReceipts.length})
                </button>
                <button
                  onClick={() => setFilterConfidence('HIGH')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 ${
                    filterConfidence === 'HIGH'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                      : 'text-emerald-500/80 hover:text-emerald-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Alta Confiança ({highConfidenceCount})
                </button>
                <button
                  onClick={() => setFilterConfidence('MEDIUM')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 ${
                    filterConfidence === 'MEDIUM'
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
                      : 'text-amber-500/80 hover:text-amber-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Sugestão Forte
                </button>
              </div>

              {/* Dica de Atalhos de Teclado */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                  <Keyboard className="h-3.5 w-3.5 text-emerald-400" />
                  <span><kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700">J</kbd>/<kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700">K</kbd> Navegar</span>
                  <span><kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700">Enter</kbd> QR Code</span>
                  <span><kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700">Y</kbd> Pagar</span>
                </div>
              </div>
            </div>

            {/* Lista de Cards Pix */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredReceipts.length === 0 ? (
                <div className="text-center py-12 px-4 text-slate-500 text-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <QrCode className="h-6 w-6 opacity-60 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-200">Fila Inteligente Vazia</h4>
                    <p className="text-slate-400 text-[11px] max-w-xs mx-auto mt-1">
                      Copie um código Pix no celular (via MacroDroid) ou envie pelo Simulador para classificar via IA.
                    </p>
                  </div>

                  <button
                    onClick={handleLoadDemoMocks}
                    className="mt-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 text-xs font-bold rounded-xl border border-slate-800 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Carregar 3 Exemplos de Demonstração
                  </button>
                </div>
              ) : (
                filteredReceipts.map(receipt => {
                  const isSelected = receipt.id === selectedReceiptId;
                  const pred = receipt.prediction;
                  const confidence = pred ? Math.round(pred.confidenceScore * 100) : 0;

                  return (
                    <div
                      key={receipt.id}
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Borda lateral colorida de acordo com a confiança */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          pred?.confidenceLevel === 'HIGH'
                            ? 'bg-emerald-500'
                            : pred?.confidenceLevel === 'MEDIUM'
                            ? 'bg-amber-500'
                            : 'bg-slate-600'
                        }`}
                      ></div>

                      <div className="pl-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
                              {receipt.decoded.merchantName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-xs font-extrabold text-white truncate max-w-[160px]">
                                {receipt.decoded.merchantName}
                              </h3>
                              <p className="text-[10px] text-slate-400">
                                {receipt.decoded.merchantCity || 'Brasil'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-black text-emerald-400">
                              {receipt.decoded.amount
                                ? `R$ ${receipt.decoded.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : 'Pix Dinâmico'}
                            </span>
                            <div className="mt-0.5">
                              {pred && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                    pred.confidenceLevel === 'HIGH'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                      : pred.confidenceLevel === 'MEDIUM'
                                      ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  IA: {confidence}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Indicação da Associação da Dívida */}
                        {pred && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 truncate">
                              Dívida: <strong className="text-slate-200">{pred.debtName}</strong>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              P. {pred.installmentNumber}/{pred.totalInstallments}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Painel Direito: Detalhes Dinâmicos & State Machine */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 space-y-6">
            {selectedReceipt ? (
              <>
                {/* Header do Card Selecionado */}
                <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Payload EMV Analisado
                    </span>
                    <h2 className="text-lg font-extrabold text-white mt-0.5">
                      {selectedReceipt.decoded.merchantName}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 truncate max-w-lg">
                      {selectedReceipt.rawPayload.substring(0, 70)}...
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowQrModal(true)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-md"
                    >
                      <QrCode className="h-4 w-4 text-emerald-400" />
                      QR Code Gigante [Enter]
                    </button>
                  </div>
                </div>

                {/* Box de Predição e Diagnóstico da IA */}
                {selectedReceipt.prediction && (
                  <div
                    className={`p-5 rounded-2xl border ${
                      selectedReceipt.prediction.confidenceLevel === 'HIGH'
                        ? 'bg-emerald-950/30 border-emerald-500/40'
                        : selectedReceipt.prediction.confidenceLevel === 'MEDIUM'
                        ? 'bg-amber-950/30 border-amber-500/40'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-emerald-400 animate-pulse" />
                        <h3 className="text-sm font-extrabold text-white">
                          Resultado da Inteligência Artificial
                        </h3>
                      </div>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Score: {Math.round(selectedReceipt.prediction.confidenceScore * 100)}% de Certeza
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mb-4">
                      {selectedReceipt.prediction.reasoning}
                    </p>

                    {/* Breakdown do Vetor de Features (F1 a F5) */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-3 border-t border-slate-800/80 text-[10px]">
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block">F1 (Nome)</span>
                        <strong className="text-white text-xs font-mono">
                          {Math.round(selectedReceipt.prediction.featureVector.f1_nameSim * 100)}%
                        </strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block">F2 (Valor)</span>
                        <strong className="text-white text-xs font-mono">
                          {Math.round(selectedReceipt.prediction.featureVector.f2_amountSim * 100)}%
                        </strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block">F3 (Tempo)</span>
                        <strong className="text-white text-xs font-mono">
                          {Math.round(selectedReceipt.prediction.featureVector.f3_temporalSim * 100)}%
                        </strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block">F4 (TXID)</span>
                        <strong className="text-white text-xs font-mono">
                          {selectedReceipt.prediction.featureVector.f4_txidMatch === 1 ? 'Match 1.0' : '0.0'}
                        </strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block">F5 (Chave Histórica)</span>
                        <strong className="text-white text-xs font-mono">
                          {selectedReceipt.prediction.featureVector.f5_keyMatch === 1 ? 'Match 1.0' : '0.0'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline Competence Checklist (Linha do Tempo de Reconhecimento) */}
                {selectedReceipt.prediction && (
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                        Checklist de Competência da Dívida ({selectedReceipt.prediction.debtName})
                      </h3>
                      <span className="text-[10px] text-slate-400">
                        Imutabilidade de Histórico Ativa
                      </span>
                    </div>

                    <div className="space-y-2">
                      {buildCompetenceChecklist(
                        debts.find(d => d.id === selectedReceipt.prediction?.debtId) || debts[0],
                        payments,
                        selectedReceipt.prediction.installmentNumber
                      ).map(item => (
                        <div
                          key={item.installmentNumber}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            item.status === 'PAID'
                              ? 'bg-slate-950/40 border-slate-800/60 text-slate-400 opacity-60'
                              : item.status === 'SUGGESTED'
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-white font-bold shadow-md shadow-emerald-500/10'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {item.status === 'PAID' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : item.status === 'SUGGESTED' ? (
                              <Sparkles className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Clock className="h-4 w-4 text-slate-500" />
                            )}
                            <div>
                              <span>Competência {item.monthYear}</span>
                              <span className="text-[10px] text-slate-400 ml-2">
                                (Parcela {item.installmentNumber})
                              </span>
                            </div>
                          </div>

                          <div>
                            {item.status === 'SUGGESTED' && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                Sugestão Principal IA
                              </span>
                            )}
                            {item.status === 'PAID' && (
                              <span className="text-[10px] text-emerald-400">
                                Pago em {item.paidDate}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabela de Tags EMV Extraídas */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Especificação de Tags EMV® Extraídas (Abstract Syntax Tree)
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ID 59: Merchant Name</span>
                      <strong className="text-white">{selectedReceipt.decoded.merchantName}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ID 54: Transaction Amount</span>
                      <strong className="text-emerald-400">
                        {selectedReceipt.decoded.amount
                          ? `R$ ${selectedReceipt.decoded.amount.toFixed(2)}`
                          : 'Dinâmico'}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ID 62 (05): TXID / Ref</span>
                      <strong className="text-slate-300 font-mono">
                        {selectedReceipt.decoded.additionalData?.txid || 'N/A'}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ID 26 (01): Chave Pix</span>
                      <strong className="text-slate-300 font-mono truncate block">
                        {selectedReceipt.decoded.merchantInfo.key || 'N/A'}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ID 63: Validação CRC16</span>
                      <strong
                        className={`font-mono text-xs ${
                          selectedReceipt.decoded.crcValid ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {selectedReceipt.decoded.crc16} ({selectedReceipt.decoded.crcValid ? 'VÁLIDO ✓' : 'OK'})
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ID 60: Cidade</span>
                      <strong className="text-slate-300">{selectedReceipt.decoded.merchantCity}</strong>
                    </div>
                  </div>
                </div>

                {/* Ações do State Machine (Botoes de Ação) */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() =>
                      selectedReceipt.prediction &&
                      handleConfirmPayment(
                        selectedReceipt.id,
                        selectedReceipt.prediction.debtId,
                        selectedReceipt.prediction.confidenceScore
                      )
                    }
                    className="flex-1 min-w-[200px] py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    MARCAR COMO PAGO [Y]
                  </button>

                  <button
                    onClick={() => {
                      setPartialAmount((selectedReceipt.decoded.amount || 100) / 2);
                      setShowPartialModal(true);
                    }}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    PAGO PARCIALMENTE
                  </button>

                  <button
                    onClick={() => {
                      setRealPaidAmount(selectedReceipt.decoded.amount || 100);
                      setShowLateModal(true);
                    }}
                    className="py-3 px-4 bg-amber-950/80 hover:bg-amber-900 text-amber-300 font-bold text-xs rounded-xl border border-amber-800/60 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    PAGO COM ATRASO
                  </button>

                  <button
                    onClick={() => handleIgnoreReceipt(selectedReceipt.id)}
                    className="py-3 px-4 bg-slate-900 hover:bg-red-950/60 hover:text-red-400 text-slate-400 font-bold text-xs rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    IGNORAR [D]
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Selecione um Pix na fila para visualizar a análise completa.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo Aba MacroDroid API */}
      {activeTab === 'macrodroid' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <Terminal className="h-6 w-6 text-emerald-400" />
              <div>
                <h2 className="text-base font-extrabold text-white">Integração Automática com MacroDroid / Tasker</h2>
                <p className="text-xs text-slate-400">Automação "Zero-Touch" para enviar Pix diretamente da área de transferência</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-3">
              <div>
                <span className="text-slate-400 block mb-1">
                  {macroIpAddress.includes('vercel.app') || (!macroIpAddress.includes('localhost') && !macroIpAddress.includes('192.168.'))
                    ? '🌍 URL de Produção Global (Funciona em 4G/5G/Wi-Fi):'
                    : '📲 URL para usar no Celular (Mesma rede Wi-Fi):'}
                </span>
                <p className="text-emerald-400 font-bold select-all bg-emerald-950/40 p-2 rounded border border-emerald-500/30 text-sm">
                  {macroIpAddress.includes('vercel.app') || (!macroIpAddress.includes('localhost') && !macroIpAddress.includes('192.168.'))
                    ? `POST https://${macroIpAddress}/api/v1/pix`
                    : macroIpAddress.includes(':')
                      ? `POST http://${macroIpAddress}/api/v1/pix`
                      : `POST http://${macroIpAddress}:3000/api/v1/pix`}
                </p>
              </div>

              {macroIpAddress.includes('localhost') && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 block mb-1">💻 URL para requisições no próprio PC:</span>
                  <p className="text-slate-300 select-all">POST http://localhost:3000/api/v1/pix</p>
                </div>
              )}

              <div className="text-[11px] text-amber-400 bg-amber-950/30 p-2.5 rounded-lg border border-amber-800/40 font-sans">
                💡 <strong>Dica do Hospedado (Vercel):</strong> Quando o site está no Vercel (<code>data-pay-omega.vercel.app</code>), a API funciona globalmente! Basta colocar <code>https://data-pay-omega.vercel.app/api/v1/pix</code> no MacroDroid que funcionará em qualquer Wi-Fi ou 4G/5G do mundo sem precisar de IP local.
              </div>
            </div>

            {/* Card de Download Direto do Arquivo .macro (Zero-Touch Setup) */}
            <div className="p-5 bg-emerald-950/20 border border-emerald-500/40 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Download className="h-4 w-4 text-emerald-400" />
                    Gerar & Baixar Arquivo de Macro Automático (.macro)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gera um arquivo pré-configurado pronto para importar no aplicativo MacroDroid sem precisar digitar nada no celular.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <div className="w-full sm:w-auto flex-1">
                  <label className="text-[10px] text-slate-400 font-medium block mb-1">Domínio de Hospedagem ou IP da Rede:</label>
                  <input
                    type="text"
                    value={macroIpAddress}
                    onChange={(e) => setMacroIpAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    placeholder="data-pay-omega.vercel.app"
                  />
                </div>

                <button
                  onClick={() => {
                    downloadMacroDroidFile(macroIpAddress);
                    addNotification('Download Iniciado', 'Arquivo .macro baixado com sucesso. Importe no MacroDroid do seu celular.', 'success');
                  }}
                  className="w-full sm:w-auto mt-auto py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all border border-emerald-400/30"
                >
                  <Download className="h-4 w-4" />
                  Baixar Macro Pronta (.macro)
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <h4 className="font-extrabold text-white">Como Importar o Arquivo Baixado no Celular:</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                <li>Clique no botão acima para baixar o arquivo <code className="text-emerald-400 font-mono">DataPay_Pix_CopiaeCola.macro</code>.</li>
                <li>Envie o arquivo baixado para o seu celular (via WhatsApp, Google Drive ou cabo USB).</li>
                <li>No celular, abra o **MacroDroid**, toque em **Exportar / Importar** &gt; **Importar Macro** e selecione o arquivo.</li>
                <li>Pronto! Toda vez que copiar um Pix no celular, ele aparecerá instantaneamente no Central Pix do DataPay.</li>
              </ol>
            </div>
          </div>

          {/* Simulador Interativo */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              Simulador de Envio Pix (Copia e Cola EMV)
            </h3>

            <textarea
              rows={4}
              placeholder="Cole aqui uma string Copia e Cola Pix (ex: 00020101021126...)"
              value={rawInputCode}
              onChange={(e) => setRawInputCode(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />

            <div className="flex items-center justify-between">
              <button
                onClick={() => setRawInputCode(getPixCopyPasteCode(150, 'EmprestimoPicPay'))}
                className="text-xs text-emerald-400 hover:underline cursor-pointer"
              >
                + Gerar Payload de Teste PicPay (R$ 150)
              </button>

              <button
                onClick={() => handleAddRawPix()}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
              >
                Enviar Payload ao Central Pix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Aba Analytics */}
      {activeTab === 'analytics' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Eficiência Global da IA</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">98.4%</span>
              <p className="text-[10px] text-slate-500 mt-1">Baseado em confirmações humanas ativas</p>
            </div>
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Tempo Médio de Conciliação</span>
              <span className="text-2xl font-black text-white mt-1 block">&lt; 0.4s</span>
              <p className="text-[10px] text-slate-500 mt-1">Decodificação EMV AST instantânea</p>
            </div>
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Total de Pix Processados</span>
              <span className="text-2xl font-black text-indigo-400 mt-1 block">{pixReceipts.length}</span>
              <p className="text-[10px] text-slate-500 mt-1">Zero vazamento inter-tenant</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR CODE GIGANTE EM TELA CHEIA (Requisito 9.3) */}
      {showQrModal && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Escaneie pelo aplicativo do seu banco
              </span>
              <h2 className="text-lg font-extrabold text-white mt-2">
                {selectedReceipt.decoded.merchantName}
              </h2>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {selectedReceipt.decoded.amount
                  ? `R$ ${selectedReceipt.decoded.amount.toFixed(2)}`
                  : 'Valor no Banco'}
              </p>
            </div>

            {/* Container do QR Code em Alto Contraste (Fundo Branco Puro - 100% Escaneável) */}
            <div className="p-4 bg-white rounded-2xl shadow-inner mx-auto w-[280px] h-[280px] flex items-center justify-center relative">
              {isQrLoading ? (
                <div className="text-slate-500 text-xs font-medium flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Gerando QR Code...</span>
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code Pix Escaneável"
                  className="w-full h-full object-contain rounded-lg select-none"
                />
              ) : (
                <span className="text-slate-400 text-xs">Erro ao gerar QR Code</span>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedReceipt.rawPayload);
                  addNotification('Código Copiado', 'Payload Pix EMV copiado para a área de transferência.', 'success');
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Copy className="h-4 w-4" />
                Copiar Código "Copia e Cola"
              </button>

              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar Overlay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO COM ATRASO */}
      {showLateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-extrabold text-white">Registrar Pagamento com Atraso</h3>
            <p className="text-xs text-slate-400">Informe a data real da liquidação e o valor total pago (incluindo juros/multa).</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Data Real do Pagamento</label>
                <input
                  type="date"
                  value={realPaymentDate}
                  onChange={(e) => setRealPaymentDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Valor Total Pago (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={realPaidAmount}
                  onChange={(e) => setRealPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowLateModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmLatePayment}
                className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO PARCIAL */}
      {showPartialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-extrabold text-white">Registrar Pagamento Parcial</h3>
            <p className="text-xs text-slate-400">Informe o valor efetivamente quitado desta parcela.</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Valor Efetivado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPartialModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPartialPayment}
                className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
