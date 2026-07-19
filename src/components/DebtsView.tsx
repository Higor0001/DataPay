'use client';

import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { Debt, DebtType } from '../types';
import { parseCreditDescription } from '../utils/creditParser';
import { parseOFX, extractBankFromOFX } from '../utils/ofxParser';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  FileText,
  AlertCircle,
  X,
  CreditCard,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  Banknote,
  DollarSign,
  Upload,
  ArrowRight,
  Calculator,
  Sparkles,
  Pencil
} from 'lucide-react';

export const DebtsView: React.FC = () => {
  const { debts, addDebt, updateDebt, deleteDebt, payInstallment, amortizeDebt, addNotification } = useAppState();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showAmortizeModal, setShowAmortizeModal] = useState<Debt | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  // Amortization form state
  const [amortizeAmount, setAmortizeAmount] = useState<string>('');
  const [amortizeType, setAmortizeType] = useState<'time' | 'value'>('time');
  const [amortizeResult, setAmortizeResult] = useState<{ savings: number; newRemaining: number; newBalance: number } | null>(null);

  // Add form state
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [type, setType] = useState<DebtType>('Empréstimo');
  const [originalValue, setOriginalValue] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [cet, setCet] = useState('');
  const [iof, setIof] = useState('0');
  const [fine, setFine] = useState('2');
  const [delayFee, setDelayFee] = useState('1');
  const [contractDate, setContractDate] = useState('2026-01-01');
  const [dueDate, setDueDate] = useState('10');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [remainingInstallments, setRemainingInstallments] = useState('');
  const [installmentValue, setInstallmentValue] = useState('');
  const [indexUsed, setIndexUsed] = useState('Taxa Fixa');
  const [notes, setNotes] = useState('');
  const [rawContractText, setRawContractText] = useState('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // Edit form state
  const [showEditModal, setShowEditModal] = useState<Debt | null>(null);
  const [editName, setEditName] = useState('');
  const [editBank, setEditBank] = useState('');
  const [editType, setEditType] = useState<DebtType>('Empréstimo');
  const [editOriginalValue, setEditOriginalValue] = useState('');
  const [editCurrentBalance, setEditCurrentBalance] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editCet, setEditCet] = useState('');
  const [editIof, setEditIof] = useState('0');
  const [editFine, setEditFine] = useState('2');
  const [editDelayFee, setEditDelayFee] = useState('1');
  const [editContractDate, setEditContractDate] = useState('2026-01-01');
  const [editDueDate, setEditDueDate] = useState('10');
  const [editTotalInstallments, setEditTotalInstallments] = useState('');
  const [editRemainingInstallments, setEditRemainingInstallments] = useState('');
  const [editInstallmentValue, setEditInstallmentValue] = useState('');
  const [editIndexUsed, setEditIndexUsed] = useState('Taxa Fixa');
  const [editNotes, setEditNotes] = useState('');

  // Set edit form values when edit modal is shown
  useEffect(() => {
    if (showEditModal) {
      setEditName(showEditModal.name);
      setEditBank(showEditModal.bank);
      setEditType(showEditModal.type);
      setEditOriginalValue(String(showEditModal.originalValue));
      setEditCurrentBalance(String(showEditModal.currentBalance));
      setEditInterestRate(String(showEditModal.interestRate));
      setEditCet(String(showEditModal.cet));
      setEditIof(String(showEditModal.iof));
      setEditFine(String(showEditModal.fine));
      setEditDelayFee(String(showEditModal.delayFee));
      setEditContractDate(showEditModal.contractDate);
      setEditDueDate(String(showEditModal.dueDate));
      setEditTotalInstallments(String(showEditModal.totalInstallments));
      setEditRemainingInstallments(String(showEditModal.remainingInstallments));
      setEditInstallmentValue(String(showEditModal.installmentValue));
      setEditIndexUsed(showEditModal.indexUsed);
      setEditNotes(showEditModal.notes || '');
    }
  }, [showEditModal]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !editName || !editBank || !editCurrentBalance || !editInstallmentValue) return;

    updateDebt({
      ...showEditModal,
      name: editName,
      bank: editBank,
      type: editType,
      originalValue: Number(editOriginalValue) || Number(editCurrentBalance),
      currentBalance: Number(editCurrentBalance),
      interestRate: Number(editInterestRate) || 0,
      cet: Number(editCet) || 0,
      iof: Number(editIof) || 0,
      fine: Number(editFine) || 2,
      delayFee: Number(editDelayFee) || 1,
      contractDate: editContractDate,
      dueDate: Number(editDueDate) || 10,
      totalInstallments: Number(editTotalInstallments) || 1,
      remainingInstallments: Number(editRemainingInstallments) || 1,
      installmentValue: Number(editInstallmentValue),
      indexUsed: editIndexUsed,
      notes: editNotes
    });

    addNotification(
      'Dívida Atualizada',
      `As informações da dívida "${editName}" foram atualizadas com sucesso.`,
      'success'
    );

    setShowEditModal(null);
  };

  // Search and Filter
  const filteredDebts = debts.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.bank.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'All' || d.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleParseContract = () => {
    if (!rawContractText.trim()) return;
    try {
      const parsed = parseCreditDescription(rawContractText);
      
      if (parsed.name) setName(parsed.name);
      if (parsed.bank) setBank(parsed.bank);
      if (parsed.type) setType(parsed.type);
      if (parsed.originalValue) setOriginalValue(String(parsed.originalValue));
      if (parsed.currentBalance) setCurrentBalance(String(parsed.currentBalance));
      if (parsed.interestRate) setInterestRate(String(parsed.interestRate));
      if (parsed.cet) setCet(String(parsed.cet));
      if (parsed.totalInstallments) setTotalInstallments(String(parsed.totalInstallments));
      if (parsed.remainingInstallments) setRemainingInstallments(String(parsed.remainingInstallments));
      if (parsed.installmentValue) setInstallmentValue(String(parsed.installmentValue));
      if (parsed.notes) setNotes(parsed.notes);

      setRawContractText('');
      
      addNotification(
        'Contrato Analisado',
        'Dados extraídos com sucesso! Revise os campos preenchidos no formulário abaixo.',
        'success'
      );
    } catch (err) {
      addNotification('Falha na Análise', 'Não foi possível extrair dados estruturados deste texto.', 'alert');
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Se for arquivo de Extrato Bancário OFX, processa 100% no cliente de forma offline
    if (file.name.toLowerCase().endsWith('.ofx')) {
      setIsPdfLoading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          if (!text) throw new Error('Arquivo OFX vazio.');

          const transactions = parseOFX(text);
          const bankName = extractBankFromOFX(text) || 'Banco';

          // Procura transações que contenham palavras chaves de crédito
          const loanKeywords = ['EMPRESTIMO', 'FINANCIAMENTO', 'CONSIG', 'PARCELA', 'JUROS', 'DED', 'MUTUO', 'CREDITO'];
          const loanTx = transactions.find(t => 
            loanKeywords.some(kw => t.description.toUpperCase().includes(kw))
          );

          setBank(bankName);
          setType('Empréstimo');

          if (loanTx) {
            setName(loanTx.description);
            setInstallmentValue(String(Math.abs(loanTx.amount)));
            setNotes(`Mapeado via extrato OFX: Lançamento "${loanTx.description}" de R$ ${Math.abs(loanTx.amount).toFixed(2)} em ${loanTx.date}.`);
          } else {
            setName(`Dívida ${bankName}`);
            // Pega o maior débito no extrato como sugestão de parcela
            const debits = transactions.filter(t => t.amount < 0);
            if (debits.length > 0) {
              const sortedDebits = debits.sort((a, b) => a.amount - b.amount); // Ordena decrescente (mais negativo primeiro)
              const mainDebit = sortedDebits[0];
              setInstallmentValue(String(Math.abs(mainDebit.amount)));
              setNotes(`Mapeado via extrato OFX: Maior débito encontrado "${mainDebit.description}" de R$ ${Math.abs(mainDebit.amount).toFixed(2)}.`);
            } else {
              setNotes(`Extrato OFX carregado. ${transactions.length} transações encontradas.`);
            }
          }

          addNotification(
            'Extrato OFX Mapeado',
            `Arquivo ${file.name} processado. ${transactions.length} transações lidas!`,
            'success'
          );
        } catch (err: any) {
          console.error(err);
          addNotification('Erro de Leitura', 'Não foi possível ler as transações deste arquivo OFX.', 'alert');
        } finally {
          setIsPdfLoading(false);
        }
      };
      reader.readAsText(file);
      return;
    }

    setIsPdfLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.details ? `${errData.error} Detalhes: ${errData.details}` : (errData.error || 'Falha na resposta do servidor.');
        throw new Error(errMsg);
      }

      const result = await res.json();
      console.log('[DataPay Debug] Resposta da API de PDF:', result);
      
      if (result.success && result.data) {
        const parsed = result.data;
        if (parsed.name) setName(parsed.name);
        if (parsed.bank) setBank(parsed.bank);
        if (parsed.type) setType(parsed.type);
        if (parsed.originalValue) setOriginalValue(String(parsed.originalValue));
        if (parsed.currentBalance) setCurrentBalance(String(parsed.currentBalance));
        if (parsed.interestRate) setInterestRate(String(parsed.interestRate));
        if (parsed.cet) setCet(String(parsed.cet));
        if (parsed.totalInstallments) setTotalInstallments(String(parsed.totalInstallments));
        if (parsed.remainingInstallments) setRemainingInstallments(String(parsed.remainingInstallments));
        if (parsed.installmentValue) setInstallmentValue(String(parsed.installmentValue));
        if (parsed.notes) setNotes(parsed.notes);

        addNotification(
          'PDF Processado',
          `Documento ${file.name} analisado. Dados preenchidos no formulário!`,
          'success'
        );
      } else {
        throw new Error('Estrutura de resposta inválida.');
      }
    } catch (err: any) {
      console.error(err);
      addNotification('Erro de Leitura', err.message || 'Não foi possível extrair os dados desse PDF.', 'alert');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !bank || !currentBalance || !installmentValue) return;

    addDebt({
      name,
      bank,
      type,
      originalValue: Number(originalValue) || Number(currentBalance),
      currentBalance: Number(currentBalance),
      interestRate: Number(interestRate) || 0,
      cet: Number(cet) || 0,
      iof: Number(iof) || 0,
      fine: Number(fine) || 2,
      delayFee: Number(delayFee) || 1,
      contractDate,
      dueDate: Number(dueDate) || 10,
      totalInstallments: Number(totalInstallments) || 1,
      remainingInstallments: Number(remainingInstallments) || 1,
      installmentValue: Number(installmentValue),
      indexUsed,
      notes,
      attachments: []
    });

    // Reset Form
    setName('');
    setBank('');
    setType('Empréstimo');
    setOriginalValue('');
    setCurrentBalance('');
    setInterestRate('');
    setCet('');
    setIof('0');
    setFine('2');
    setDelayFee('1');
    setDueDate('10');
    setTotalInstallments('');
    setRemainingInstallments('');
    setInstallmentValue('');
    setIndexUsed('Taxa Fixa');
    setNotes('');
    setShowAddModal(false);
  };

  const handleAmortizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAmortizeModal || !amortizeAmount) return;

    const res = amortizeDebt(showAmortizeModal.id, Number(amortizeAmount), amortizeType);
    setAmortizeResult(res);
    setAmortizeAmount('');
  };

  const debtTypes: DebtType[] = [
    'Empréstimo',
    'Financiamento',
    'Cartão',
    'Consignado',
    'Parcelamento',
    'Crediário',
    'Negociação'
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Gestão de Dívidas</h2>
          <p className="text-slate-400 text-xs mt-1">
            Cadastre, organize e realize amortizações para reduzir juros totais.
          </p>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-3 rounded-2xl transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-600/10"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Nova Dívida</span>
        </button>
      </div>

      {/* Search & Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou banco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-3 py-1">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer py-2"
          >
            <option value="All" className="bg-slate-950 text-white">Todos os Tipos</option>
            {debtTypes.map((t) => (
              <option key={t} value={t} className="bg-slate-950 text-white">{t}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Debts Table/List */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-md">
        {filteredDebts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <AlertCircle className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-xs">Nenhuma dívida encontrada para os critérios selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Dívida / Banco</th>
                  <th className="py-4 px-6">Tipo</th>
                  <th className="py-4 px-6">Saldo Atual</th>
                  <th className="py-4 px-6">Próxima Parcela</th>
                  <th className="py-4 px-6">Vencimento</th>
                  <th className="py-4 px-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredDebts.map((debt) => {
                  const isPaid = debt.status === 'paid';
                  const isOverdue = debt.status === 'overdue';

                  return (
                    <tr
                      key={debt.id}
                      className="hover:bg-slate-900/30 transition-colors text-xs text-slate-200"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedDebt(debt)}
                            className="font-bold text-slate-200 hover:text-indigo-400 transition-colors text-left"
                          >
                            {debt.name}
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{debt.bank}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                          {debt.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-white">
                        {isPaid ? (
                          <span className="text-emerald-400 font-semibold text-[10.5px]">Liquidada</span>
                        ) : (
                          `R$ ${debt.currentBalance.toLocaleString('pt-BR')}`
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {!isPaid && (
                          <>
                            <span className="font-semibold">R$ {debt.installmentValue.toLocaleString('pt-BR')}</span>
                            <span className="text-[9.5px] text-slate-400 block mt-0.5">{debt.remainingInstallments} parcelas rest.</span>
                          </>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {!isPaid && (
                          <span className={`px-2 py-0.5 rounded-full border text-[9.5px] font-semibold ${
                            isOverdue
                              ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}>
                            {new Date(debt.nextDueDate).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedDebt(debt)}
                            className="bg-slate-800 border border-slate-750 hover:bg-slate-750 text-slate-300 p-2 rounded-xl transition-all cursor-pointer"
                            title="Ver Detalhes"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => setShowEditModal(debt)}
                            className="bg-slate-800 border border-slate-750 hover:bg-slate-750 text-slate-300 p-2 rounded-xl transition-all cursor-pointer"
                            title="Editar Dívida"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          
                          {!isPaid && (
                            <>
                              <button
                                onClick={() => {
                                  setAmortizeResult(null);
                                  setShowAmortizeModal(debt);
                                }}
                                className="bg-indigo-650 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-2 rounded-xl border border-indigo-600 transition-all cursor-pointer"
                              >
                                Amortizar
                              </button>
                              <button
                                onClick={() => deleteDebt(debt.id)}
                                className="bg-slate-900 border border-red-950 hover:bg-red-950/20 text-red-400 p-2 rounded-xl transition-all cursor-pointer hover:border-red-550"
                                title="Excluir Dívida"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
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

      {/* Add Debt Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4 mb-6">
              <h3 className="font-bold text-white text-base">Cadastrar Nova Dívida</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">

              {/* Seção de Importação Inteligente por Texto */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    <span className="text-xs font-bold text-slate-200">Importação Inteligente de Contrato</span>
                  </div>
                  <span className="text-[8px] text-indigo-400 font-extrabold uppercase bg-indigo-950/20 border border-indigo-900/30 px-1.5 py-0.5 rounded">Parser IA</span>
                </div>
                <p className="text-[10px] text-slate-450 leading-normal">
                  Cole o descritivo de crédito, extrato ou demonstrativo copiado do internet banking. O sistema extrairá valores, taxas e parcelas na hora.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <textarea
                    rows={2}
                    placeholder="Cole aqui o texto do seu contrato... (Ex: Empréstimo Itaú no valor contratado de R$ 12.000,00 com taxa de juros de 4,5% a.m., CET: 72,8% a.a., 24 parcelas de R$ 680,00)"
                    value={rawContractText}
                    onChange={(e) => setRawContractText(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleParseContract}
                    className="bg-indigo-650 hover:bg-indigo-700 text-white text-[11px] font-bold px-4 py-2.5 sm:py-0 rounded-xl transition-all cursor-pointer flex items-center justify-center whitespace-nowrap shadow-md shadow-indigo-600/10"
                  >
                    Analisar Texto
                  </button>
                </div>
              </div>
              
              {/* Row 1: Name and Bank */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Nome da Dívida</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fatura Cartão Visa"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Banco / Creditor</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Nubank, Banco do Brasil"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Type and Index */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Tipo de Contrato</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as DebtType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {debtTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Índice / Indexador</label>
                  <input
                    type="text"
                    placeholder="Ex: IPCA + 6%, CDI, Prefixo"
                    value={indexUsed}
                    onChange={(e) => setIndexUsed(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 3: Values */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Saldo Devedor Atual</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="Ex: 8500"
                    value={currentBalance}
                    onChange={(e) => setCurrentBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Valor Contratado Orig.</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 15000"
                    value={originalValue}
                    onChange={(e) => setOriginalValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Valor da Parcela</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="Ex: 450"
                    value={installmentValue}
                    onChange={(e) => setInstallmentValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 4: Interest and Fees */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Juros (% a.m.)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">CET (% a.a.)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 28.5"
                    value={cet}
                    onChange={(e) => setCet(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">IOF em R$</label>
                  <input
                    type="number"
                    step="0.01"
                    value={iof}
                    onChange={(e) => setIof(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 5: Installment counting & dates */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Nº Parcelas Totais</label>
                  <input
                    type="number"
                    placeholder="Ex: 36"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Parcelas Restantes</label>
                  <input
                    type="number"
                    placeholder="Ex: 24"
                    value={remainingInstallments}
                    onChange={(e) => setRemainingInstallments(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Dia Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Data Contratação</label>
                  <input
                    type="date"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* PDF/Image/OFX contract upload */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">
                  Importar via PDF, Imagem ou OFX
                </label>
                {isPdfLoading ? (
                  <div className="border border-slate-800 bg-slate-950/40 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3">
                    <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-indigo-400 font-bold animate-pulse">Lendo documento com Inteligência Artificial...</span>
                  </div>
                ) : (
                  <label className="border border-dashed border-slate-800 hover:border-indigo-600/50 bg-slate-950/40 hover:bg-slate-900/10 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200">
                    <Upload className="h-8 w-8 text-indigo-400 mb-2 animate-bounce" />
                    <span className="text-[11px] text-slate-300 font-semibold">Selecione o PDF, Foto ou Extrato OFX</span>
                    <span className="text-[9px] text-slate-500 mt-1">A IA lerá faturas e PDFs. Arquivos OFX são processados na hora de forma offline.</span>
                    <input
                      type="file"
                      accept=".pdf,.ofx,image/png,image/jpeg,image/jpg"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Notas / Observações</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais como renegociações efetuadas..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
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
                  Salvar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Selected Debt Details Modal */}
      {selectedDebt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-white text-sm">{selectedDebt.name}</h3>
                <span className="text-[10px] text-slate-400">{selectedDebt.bank} • {selectedDebt.type}</span>
              </div>
              <button
                onClick={() => setSelectedDebt(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Saldo Devedor Atual</span>
                  <span className="text-base font-extrabold text-white">R$ {selectedDebt.currentBalance.toLocaleString('pt-BR')}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Contrato Original</span>
                  <span className="text-base font-extrabold text-slate-300">R$ {selectedDebt.originalValue.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs bg-slate-950/20 p-4 rounded-2xl border border-slate-800/50">
                <div>
                  <span className="text-[8.5px] uppercase text-slate-500 block">Juros Mensal</span>
                  <span className="font-bold text-slate-200">{selectedDebt.interestRate}% a.m.</span>
                </div>
                <div>
                  <span className="text-[8.5px] uppercase text-slate-500 block">CET Anual</span>
                  <span className="font-bold text-slate-200">{selectedDebt.cet}% a.a.</span>
                </div>
                <div>
                  <span className="text-[8.5px] uppercase text-slate-500 block">Indexador</span>
                  <span className="font-bold text-slate-200">{selectedDebt.indexUsed}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[8.5px] uppercase text-slate-500 block">Valor Parcela</span>
                  <span className="font-semibold text-slate-300">R$ {selectedDebt.installmentValue.toLocaleString('pt-BR')}</span>
                </div>
                <div>
                  <span className="text-[8.5px] uppercase text-slate-500 block">Parcelas Pendentes</span>
                  <span className="font-semibold text-slate-300">{selectedDebt.remainingInstallments} de {selectedDebt.totalInstallments}</span>
                </div>
                <div>
                  <span className="text-[8.5px] uppercase text-slate-500 block">Dia Vencimento</span>
                  <span className="font-semibold text-slate-300">Todo dia {selectedDebt.dueDate}</span>
                </div>
                <div>
                  <span className="text-[8.5px] uppercase text-slate-500 block">Data Contratação</span>
                  <span className="font-semibold text-slate-300">{new Date(selectedDebt.contractDate).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-3">
                <span className="text-[8.5px] uppercase text-slate-500 font-bold block mb-1">Notas Contratuais</span>
                <p className="text-slate-300 text-xs bg-slate-950/50 p-3 rounded-xl leading-relaxed">
                  {selectedDebt.notes || 'Nenhuma observação cadastrada para este contrato.'}
                </p>
              </div>

              <div className="border-t border-slate-800/80 pt-3">
                <span className="text-[8.5px] uppercase text-slate-500 font-bold block mb-1">Documentos Digitais</span>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 flex items-center justify-between p-2.5 bg-slate-950/30 hover:bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4.5 w-4.5 text-indigo-400" />
                      <span className="text-[10.5px] text-slate-300 truncate font-medium">Contrato_Bancario.pdf</span>
                    </div>
                    <span className="text-[9px] text-indigo-400 font-semibold uppercase">Visualizar</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditModal(selectedDebt);
                  setSelectedDebt(null);
                }}
                className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-semibold py-3 px-5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => setSelectedDebt(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold py-3 rounded-2xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amortization Modal */}
      {showAmortizeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Simular e Executar Amortização</h3>
                <span className="text-[10px] text-slate-400">{showAmortizeModal.name} • Saldo: R$ {showAmortizeModal.currentBalance.toLocaleString('pt-BR')}</span>
              </div>
              <button
                onClick={() => {
                  setShowAmortizeModal(null);
                  setAmortizeResult(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {!amortizeResult ? (
              <form onSubmit={handleAmortizeSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Valor do Aporte Extra (R$)</label>
                  <input
                    type="number"
                    required
                    min="10"
                    placeholder="Ex: 1000"
                    value={amortizeAmount}
                    onChange={(e) => setAmortizeAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Estratégia de Amortização</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAmortizeType('time')}
                      className={`px-4 py-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        amortizeType === 'time'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <Layers className="h-4.5 w-4.5" />
                      <span>Reduzir Prazo</span>
                      <span className="text-[9px] text-slate-500 font-normal">Quita mais rápido</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmortizeType('value')}
                      className={`px-4 py-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        amortizeType === 'value'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <Banknote className="h-4.5 w-4.5" />
                      <span>Reduzir Parcela</span>
                      <span className="text-[9px] text-slate-500 font-normal">Alivia fluxo mensal</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl text-[11px] text-slate-400 leading-relaxed">
                  📢 **Dica do Assistente IA:** Reduzir o **Prazo** cancela a maior quantidade de juros compostos nas parcelas finais, gerando a maior economia financeira global.
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAmortizeModal(null)}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    Aplicar Amortização
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 py-2">
                <div className="bg-emerald-950/30 border border-emerald-900/50 p-5 rounded-3xl text-center">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-extrabold block">Economia Estimada em Juros</span>
                  <h4 className="text-2xl font-black text-emerald-400 mt-2">
                    R$ {amortizeResult.savings.toLocaleString('pt-BR')}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1.5">dinheiro que deixou de ir para o banco</p>
                </div>

                <div className="space-y-2.5 text-xs bg-slate-950/40 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Novo Saldo Devedor:</span>
                    <span className="font-bold text-white">R$ {amortizeResult.newBalance.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Parcelas Restantes:</span>
                    <span className="font-bold text-white">{amortizeResult.newRemaining} meses</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status do Contrato:</span>
                    <span className="text-indigo-400 font-semibold">Atualizado e Otimizado</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAmortizeModal(null);
                    setAmortizeResult(null);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3.5 rounded-2xl transition-all mt-4 cursor-pointer"
                >
                  Confirmar e Concluir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4 mb-6">
              <h3 className="font-bold text-white text-base">Editar Dívida</h3>
              <button
                onClick={() => setShowEditModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              {/* Row 1: Name and Bank */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Nome da Dívida</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fatura Cartão Visa"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Banco / Creditor</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Nubank, Banco do Brasil"
                    value={editBank}
                    onChange={(e) => setEditBank(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Type and Index */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Tipo de Contrato</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as DebtType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {debtTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Índice / Indexador</label>
                  <input
                    type="text"
                    placeholder="Ex: IPCA + 6%, CDI, Prefixo"
                    value={editIndexUsed}
                    onChange={(e) => setEditIndexUsed(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 3: Values */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Saldo Devedor Atual</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="Ex: 8500"
                    value={editCurrentBalance}
                    onChange={(e) => setEditCurrentBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Valor Contratado Orig.</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 15000"
                    value={editOriginalValue}
                    onChange={(e) => setEditOriginalValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Valor da Parcela</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="Ex: 450"
                    value={editInstallmentValue}
                    onChange={(e) => setEditInstallmentValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 4: Interest and Fees */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Juros (% a.m.)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2.1"
                    value={editInterestRate}
                    onChange={(e) => setEditInterestRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">CET (% a.a.)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 28.5"
                    value={editCet}
                    onChange={(e) => setEditCet(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">IOF em R$</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editIof}
                    onChange={(e) => setEditIof(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 5: Installment counting & dates */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Nº Parcelas Totais</label>
                  <input
                    type="number"
                    placeholder="Ex: 36"
                    value={editTotalInstallments}
                    onChange={(e) => setEditTotalInstallments(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Parcelas Restantes</label>
                  <input
                    type="number"
                    placeholder="Ex: 24"
                    value={editRemainingInstallments}
                    onChange={(e) => setEditRemainingInstallments(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Dia Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Data Contratação</label>
                  <input
                    type="date"
                    value={editContractDate}
                    onChange={(e) => setEditContractDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Notas / Observações</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais como renegociações efetuadas..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  Confirmar Alterações
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
