/**
 * PARSER DE DESCRITIVOS DE CRÉDITO E OPERAÇÕES BANCÁRIAS (DED)
 * Extrai valores e taxas de contratos de empréstimos, faturas e financiamentos brasileiros por texto.
 */

export interface ParsedCreditData {
  name: string;
  bank: string;
  type: 'Empréstimo' | 'Financiamento' | 'Cartão' | 'Consignado';
  originalValue: number;
  currentBalance: number;
  interestRate: number;
  cet: number;
  totalInstallments: number;
  remainingInstallments: number;
  installmentValue: number;
  notes: string;
}

export function parseCreditDescription(text: string): Partial<ParsedCreditData> {
  const result: Partial<ParsedCreditData> = {};
  const cleanedText = text.replace(/\s+/g, ' ');

  // 1. Identificação do Banco
  const banks = [
    { name: 'Nubank', regex: /nubank|nu bank/i },
    { name: 'Itaú', regex: /ita[úu]/i },
    { name: 'Caixa', regex: /caixa|cef/i },
    { name: 'Banco do Brasil', regex: /banco do brasil|bb/i },
    { name: 'Bradesco', regex: /bradesco/i },
    { name: 'Santander', regex: /santander/i },
    { name: 'Inter', regex: /inter/i },
    { name: 'C6 Bank', regex: /c6 bank|c6bank|c6/i },
    { name: 'Mercado Pago', regex: /mercado pago|mercadopago/i }
  ];

  for (const b of banks) {
    if (b.regex.test(cleanedText)) {
      result.bank = b.name;
      break;
    }
  }
  if (!result.bank) result.bank = 'Instituição Financeira';

  // 2. Identificação do Tipo
  if (/financiamento/i.test(cleanedText)) {
    result.type = 'Financiamento';
  } else if (/consignado/i.test(cleanedText)) {
    result.type = 'Consignado';
  } else if (/cart[aã]o|fatura/i.test(cleanedText)) {
    result.type = 'Cartão';
  } else {
    result.type = 'Empréstimo';
  }

  // 3. Parser de Valores Monetários (Original e Saldo Devedor)
  // Ex: "Valor contratado: R$ 15.000,00" ou "Saldo devedor: R$12.300,50"
  const valOriginalMatch = cleanedText.match(/(?:valor contratado|valor principal|valor total|valor solicitado|valor original|valor do empr[eé]stimo)\s*(?:de)?\s*(?:r\$)?\s*([\d.]+,\d{2})/i);
  if (valOriginalMatch) {
    result.originalValue = parseCurrency(valOriginalMatch[1]);
  }

  const saldoDevedorMatch = cleanedText.match(/(?:saldo devedor|saldo atual|valor devido|total devedor|saldo para quita[cç][aã]o)\s*(?:de)?\s*(?:r\$)?\s*([\d.]+,\d{2})/i);
  if (saldoDevedorMatch) {
    result.currentBalance = parseCurrency(saldoDevedorMatch[1]);
  }

  // Se não achar saldo devedor mas achar o original, assume o original de partida
  if (result.originalValue && !result.currentBalance) {
    result.currentBalance = result.originalValue;
  }

  // 4. Taxas de Juros (a.m. e a.a. / CET)
  // Ex: "Taxa de juros: 4,5% a.m."
  const jurosMatch = cleanedText.match(/(?:taxa|juros|taxa efetiva|juros mensais)\s*(?:de)?\s*([\d,]+)\s*(?:%|\s*por cento)?\s*(?:a\.m\.|ao m[eê]s)/i);
  if (jurosMatch) {
    result.interestRate = parsePercent(jurosMatch[1]);
  }

  // Ex: "CET: 72,5% a.a."
  const cetMatch = cleanedText.match(/(?:cet|custo efetivo total|cet anual)\s*(?:de)?\s*([\d,]+)\s*(?:%|\s*por cento)?\s*(?:a\.a\.|ao ano)/i);
  if (cetMatch) {
    result.cet = parsePercent(cetMatch[1]);
  }

  // 5. Parcelas (Totais e Restantes) e Valor das Parcelas
  // Ex: "24 parcelas de R$ 680,00" ou "prestação de R$ 450,00"
  const parcMatch = cleanedText.match(/(\d+)\s*(?:x|vezes|parcelas|presta[cç][õo]es)\s*(?:de)?\s*(?:r\$)?\s*([\d.]+,\d{2})/i);
  if (parcMatch) {
    result.totalInstallments = parseInt(parcMatch[1], 10);
    result.installmentValue = parseCurrency(parcMatch[2]);
  } else {
    // Busca avulsa por parcelas totais
    const totalParcMatch = cleanedText.match(/(?:total de parcelas|quantidade de parcelas|número de parcelas|prazo)\s*(?:de)?\s*(\d+)/i);
    if (totalParcMatch) {
      result.totalInstallments = parseInt(totalParcMatch[1], 10);
    }
    // Busca avulsa por valor da prestação
    const vParcMatch = cleanedText.match(/(?:valor da parcela|prestação|valor da prestação|mensalidade)\s*(?:de)?\s*(?:r\$)?\s*([\d.]+,\d{2})/i);
    if (vParcMatch) {
      result.installmentValue = parseCurrency(vParcMatch[1]);
    }
  }

  // Parcelas restantes
  const restParcMatch = cleanedText.match(/(?:parcelas restantes|restam|parcelas a pagar|parcelas em aberto)\s*(?:de)?\s*(\d+)/i);
  if (restParcMatch) {
    result.remainingInstallments = parseInt(restParcMatch[1], 10);
  } else if (result.totalInstallments) {
    // Se não especificado, assume que restam todas as parcelas
    result.remainingInstallments = result.totalInstallments;
  }

  // Ajuste do Nome Sugerido
  result.name = `${result.type} ${result.bank}`;
  result.notes = 'Preenchido automaticamente a partir do descritivo do contrato.';

  return result;
}

/**
 * Converte string no formato brasileiro (1.500,00) para Float
 */
function parseCurrency(valStr: string): number {
  return parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
}

/**
 * Converte taxa de porcentagem brasileira (4,5) para Float
 */
function parsePercent(pctStr: string): number {
  return parseFloat(pctStr.replace(',', '.'));
}
