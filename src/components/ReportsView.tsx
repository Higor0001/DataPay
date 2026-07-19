'use client';

import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Building2,
  Percent,
  Layers,
  ArrowRight,
  TrendingDown,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { debts, payments, reserve } = useAppState();
  const [activeReport, setActiveReport] = useState('consolidated');
  const [isExporting, setIsExporting] = useState(false);

  // Helper to trigger direct CSV download
  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      let csv = '';
      let filename = 'relatorio.csv';

      if (activeReport === 'consolidated') {
        filename = 'DataPay_Consolidado_Dividas.csv';
        csv = 'Nome da Divida;Banco;Tipo;Saldo Atual (RS);Juros (a.m. %);CET (a.a. %);Parcelas Restantes;Vencimento;Status\n';
        debts.forEach((d) => {
          csv += `"${d.name}";"${d.bank}";"${d.type}";${d.currentBalance};${d.interestRate};${d.cet};${d.remainingInstallments};"${d.nextDueDate}";"${d.status}"\n`;
        });
      } else if (activeReport === 'payments') {
        filename = 'DataPay_Historico_Pagamentos.csv';
        csv = 'Contrato;Banco;Valor (RS);Vencimento;Data de Pagamento;Metodo;Tipo;Status\n';
        payments.forEach((p) => {
          csv += `"${p.debtName}";"${p.bankName}";${p.amount};"${p.dueDate}";"${p.paidDate || '-'}";"${p.method}";"${p.type}";"${p.status}"\n`;
        });
      } else if (activeReport === 'interest') {
        filename = 'DataPay_Relatorio_Juros.csv';
        csv = 'Dívida;Banco;Juros Mensal (%);CET Anual (%);Saldo Atual (RS);Juros Estimado Mensal (RS)\n';
        debts.forEach((d) => {
          const estMonthlyInterest = Math.round(d.currentBalance * (d.interestRate / 100));
          csv += `"${d.name}";"${d.bank}";${d.interestRate};${d.cet};${d.currentBalance};${estMonthlyInterest}\n`;
        });
      }

      downloadCSV(filename, csv);
      setIsExporting(false);
    }, 1000);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const reportOptions = [
    { id: 'consolidated', title: 'Relatório Consolidado de Dívidas', description: 'Visão geral de saldos, prazos, taxas médias e datas de quitação.', icon: FileSpreadsheet },
    { id: 'payments', title: 'Extrato de Pagamentos e Amortizações', description: 'Histórico completo de pagamentos efetuados e parcelas agendadas.', icon: FileText },
    { id: 'interest', title: 'Painel de Juros e Custo Efetivo (CET)', description: 'Auditoria de bancos cobrando juros altos, taxas CET e multas.', icon: Percent }
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 bg-slate-950 text-slate-100 pb-24 lg:pb-6 print:bg-white print:text-black">
      
      {/* Title Header (hidden in print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Exportar Relatórios</h2>
          <p className="text-slate-400 text-xs mt-1">
            Gere planilhas em CSV, Excel ou exporte PDF para consolidação de auditorias financeiras.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Selection side (hidden in print) */}
        <div className="lg:col-span-1 space-y-4 print:hidden">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">
            <span>Selecione o Relatório</span>
          </div>

          <div className="space-y-2.5">
            {reportOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = activeReport === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setActiveReport(opt.id)}
                  className={`w-full text-left p-4 rounded-3xl border transition-all flex items-start gap-3.5 group cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                      : 'bg-slate-900/60 border-slate-850 text-slate-350 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-450'}`} />
                  <div>
                    <h4 className="font-bold text-xs text-white">{opt.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview and actions (styles adapted for printing) */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md print:bg-white print:border-none print:shadow-none">
          
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-4 mb-6 print:hidden">
            <h3 className="font-bold text-white text-sm">Visualização Prévia</h3>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintPDF}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir PDF</span>
              </button>
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Exportando...' : 'Exportar Excel/CSV'}</span>
              </button>
            </div>
          </div>

          {/* Report layout mock inside preview box */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-850 text-xs text-slate-300 space-y-6 print:bg-white print:text-black print:border-none print:p-0">
            
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-slate-900 pb-4">
              <div>
                <h4 className="font-extrabold text-white text-sm print:text-black">DATAPAY - ANÁLISE DE DÍVIDAS</h4>
                <p className="text-[9.5px] text-slate-500 mt-0.5">Diagnóstico emitido em 19/07/2026 às 00:42</p>
              </div>
              <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-805 px-2.5 py-1 rounded-lg print:hidden">
                Status: Auditado
              </span>
            </div>

            {/* Content preview changes based on active report */}
            {activeReport === 'consolidated' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 font-medium text-[10.5px]">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                    <span className="text-[8.5px] text-slate-500 block">Dívidas Ativas</span>
                    <span className="font-bold text-white text-xs">
                      {debts.filter(d => d.status !== 'paid').length} contratos
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                    <span className="text-[8.5px] text-slate-500 block">Saldo Consolidado</span>
                    <span className="font-bold text-white text-xs">
                      R$ {debts.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.currentBalance, 0).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                    <span className="text-[8.5px] text-slate-500 block">Reserva Inteligente</span>
                    <span className="font-bold text-white text-xs">
                      R$ {reserve.currentBalance.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10.5px] text-slate-350">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-500 font-semibold">
                        <th className="py-2">Contrato</th>
                        <th className="py-2">Banco</th>
                        <th className="py-2 text-right">Saldo Devedor</th>
                        <th className="py-2 text-right">Taxa (a.m.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {debts.map((d) => (
                        <tr key={d.id} className="py-2">
                          <td className="py-2 font-medium text-slate-200">{d.name}</td>
                          <td className="py-2 text-slate-450">{d.bank}</td>
                          <td className="py-2 text-right text-white">R$ {d.currentBalance.toLocaleString('pt-BR')}</td>
                          <td className="py-2 text-right">{d.interestRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'payments' && (
              <div className="space-y-4">
                <h5 className="font-bold text-slate-200 uppercase text-[10px]">Histórico Recente de Compensação</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10.5px] text-slate-350">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-500 font-semibold">
                        <th className="py-2">Descrição</th>
                        <th className="py-2">Vencimento</th>
                        <th className="py-2">Canal</th>
                        <th className="py-2 text-right">Valor Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {payments.map((p) => (
                        <tr key={p.id} className="py-2">
                          <td className="py-2 font-medium text-slate-200">
                            {p.debtName} <span className="text-[9px] text-slate-500">({p.bankName})</span>
                          </td>
                          <td className="py-2">{new Date(p.dueDate).toLocaleDateString('pt-BR')}</td>
                          <td className="py-2">{p.method}</td>
                          <td className="py-2 text-right text-emerald-400">R$ {p.amount.toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'interest' && (
              <div className="space-y-4">
                <h5 className="font-bold text-slate-200 uppercase text-[10px]">Auditoria de Custo Composto e Impacto Financeiro</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10.5px] text-slate-350">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-500 font-semibold">
                        <th className="py-2">Contrato</th>
                        <th className="py-2 text-right">CET Anual</th>
                        <th className="py-2 text-right">Multa/Mora</th>
                        <th className="py-2 text-right">Desperdício Juros Mensal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {debts.filter(d => d.status !== 'paid').map((d) => {
                        const waste = Math.round(d.currentBalance * (d.interestRate / 100));
                        return (
                          <tr key={d.id} className="py-2">
                            <td className="py-2 font-medium text-slate-200">{d.name}</td>
                            <td className="py-2 text-right text-red-400">{d.cet}% a.a.</td>
                            <td className="py-2 text-right">{d.fine}% + {d.delayFee}%</td>
                            <td className="py-2 text-right text-white">R$ {waste.toLocaleString('pt-BR')}/mês</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PDF footer disclaimer for prints */}
            <div className="border-t border-slate-900 pt-4 text-center text-[9px] text-slate-550 leading-relaxed">
              Relatório emitido confidencialmente pelo usuário no aplicativo DataPay. Todos os direitos reservados.
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
