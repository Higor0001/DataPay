import { Debt, Payment } from '../types';
import { EMVDecodedPayload, AIPrediction, FeatureVector, CompetenceChecklistItem } from '../types/centralPix';

/**
 * Normaliza strings removendo acentos, caracteres especiais e sufixos societários comuns.
 */
function cleanString(str: string): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(S\.?A\.?|LTDA|ME|EPP|INSTITUICAO DE PAGAMENTO|PAGAMENTOS|PAYMENTS|FINANCEIRA)\b/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distância de Levenshtein entre duas strings.
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const s1 = cleanString(a);
  const s2 = cleanString(b);

  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // remoção
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Retorna similaridade proporcional entre 0.0 e 1.0 (1.0 = idêntico)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const c1 = cleanString(name1);
  const c2 = cleanString(name2);

  if (!c1 || !c2) return 0.0;
  if (c1 === c2 || c1.includes(c2) || c2.includes(c1)) return 1.0;

  const dist = calculateLevenshteinDistance(c1, c2);
  const maxLen = Math.max(c1.length, c2.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * F2 (Sim_Valor): Proximidade de valor com ajuste para juros/multa.
 */
export function calculateAmountSimilarity(pixAmount: number | undefined, debtAmount: number): number {
  if (!pixAmount || pixAmount <= 0 || debtAmount <= 0) return 0.5; // Valor ausente em Pix Dinâmico

  if (Math.abs(pixAmount - debtAmount) < 0.01) return 1.0;

  // Se o Pix for maior que a dívida em até 30% (multa/juros de atraso)
  if (pixAmount > debtAmount && pixAmount <= debtAmount * 1.30) {
    const diff = (pixAmount - debtAmount) / debtAmount;
    return Math.max(0.70, 1.0 - diff * 0.8);
  }

  const diffRatio = Math.abs(pixAmount - debtAmount) / Math.max(pixAmount, debtAmount);
  return Math.max(0.0, 1.0 - diffRatio);
}

/**
 * F3 (Sim_Tempo): Decaimento Gaussiano de proximidade temporal até a data de vencimento.
 */
export function calculateTemporalSimilarity(pixDateStr: string, dueDay: number): number {
  const pixDate = new Date(pixDateStr);
  const currentMonth = pixDate.getMonth();
  const currentYear = pixDate.getFullYear();

  // Data provável do vencimento no mês corrente
  const targetDueDate = new Date(currentYear, currentMonth, Math.min(dueDay, 28));

  const diffTime = Math.abs(pixDate.getTime() - targetDueDate.getTime());
  const diffDays = diffTime / (1000 * 3600 * 24);

  // Decaimento Gaussiano com sigma = 7 dias
  const sigma = 7;
  const score = Math.exp(-Math.pow(diffDays, 2) / (2 * Math.pow(sigma, 2)));

  return parseFloat(score.toFixed(3));
}

/**
 * F4 (Match_TXID): Verifica se o TXID/label contém número da parcela ou referência do mês.
 */
export function calculateTXIDMatch(txid: string | undefined, installmentNum: number, referenceMonthStr: string): number {
  if (!txid) return 0.0;
  const cleanTxid = txid.toUpperCase();

  // Ex: "FATURA04", "PARCELA7", "P07", "042026"
  const instStr = installmentNum.toString().padStart(2, '0');
  const monthNum = referenceMonthStr.split('/')[0];

  if (cleanTxid.includes(instStr) || cleanTxid.includes(`P${installmentNum}`) || cleanTxid.includes(monthNum)) {
    return 1.0;
  }
  return 0.0;
}

/**
 * F5 (Match_ChavePix): Histórico de pagamentos anteriores associados à dívida.
 */
export function calculateKeyMatch(decoded: EMVDecodedPayload, debt: Debt, historicalPayments: Payment[]): number {
  const pixKey = decoded.merchantInfo.key?.toLowerCase();
  const merchantName = decoded.merchantName.toLowerCase();

  const matchingHistory = historicalPayments.filter(p => p.debtId === debt.id && p.status === 'Pago');

  if (matchingHistory.length === 0) return 0.0;

  // Se o recebedor for o mesmo de um pagamento anterior confirmado
  const hasMatchedMerchant = matchingHistory.some(p => p.bankName.toLowerCase().includes(merchantName) || merchantName.includes(p.bankName.toLowerCase()));

  return hasMatchedMerchant ? 1.0 : 0.0;
}

/**
 * Motor Principal de IA para Predição de Dívidas a partir do Pix EMV.
 */
export function predictDebtForPix(
  decoded: EMVDecodedPayload,
  debts: Debt[],
  historicalPayments: Payment[],
  pixReceivedDateStr: string = new Date().toISOString()
): AIPrediction | null {
  const activeDebts = debts.filter(d => d.status !== 'paid');
  if (activeDebts.length === 0) return null;

  const candidates = activeDebts.map(debt => {
    // F1: Nome
    const f1_name = Math.max(
      calculateNameSimilarity(decoded.merchantName, debt.bank),
      calculateNameSimilarity(decoded.merchantName, debt.name)
    );

    // F2: Valor
    const f2_amount = calculateAmountSimilarity(decoded.amount, debt.installmentValue);

    // F3: Tempo
    const f3_tempo = calculateTemporalSimilarity(pixReceivedDateStr, debt.dueDate);

    // Mês de referência atual (ex: 07/2026)
    const now = new Date(pixReceivedDateStr);
    const monthStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const instNum = debt.totalInstallments - debt.remainingInstallments + 1;

    // F4: TXID Match
    const f4_txid = calculateTXIDMatch(decoded.additionalData?.txid, instNum, monthStr);

    // F5: Key/History Match
    const f5_key = calculateKeyMatch(decoded, debt, historicalPayments);

    // Ponderação do Vetor de Features
    // Se houver Key Match histórico (F5=1), aumentamos significativamente o peso da confiança
    let score = (0.35 * f1_name) + (0.30 * f2_amount) + (0.15 * f3_tempo) + (0.10 * f4_txid) + (0.10 * f5_key);

    if (f5_key === 1.0) {
      score = Math.min(1.0, score + 0.15);
    }
    if (f1_name >= 0.90 && f2_amount >= 0.95) {
      score = Math.min(1.0, score + 0.10);
    }

    const featureVector: FeatureVector = {
      f1_nameSim: parseFloat(f1_name.toFixed(3)),
      f2_amountSim: parseFloat(f2_amount.toFixed(3)),
      f3_temporalSim: parseFloat(f3_tempo.toFixed(3)),
      f4_txidMatch: f4_txid,
      f5_keyMatch: f5_key
    };

    return {
      debt,
      score: parseFloat(score.toFixed(3)),
      featureVector,
      installmentNumber: Math.max(1, instNum),
      referenceMonth: monthStr
    };
  });

  // Ordena candidatos pelo Score decrescente
  candidates.sort((a, b) => b.score - a.score);

  const top = candidates[0];
  if (!top) return null;

  let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (top.score >= 0.92) {
    confidenceLevel = 'HIGH';
  } else if (top.score >= 0.78) {
    confidenceLevel = 'MEDIUM';
  }

  // Motivação explicativa do algoritmo para a UI
  let reasoning = '';
  if (top.featureVector.f5_keyMatch === 1.0) {
    reasoning = `Histórico de pagamento prévio confirmado com o credor ${top.debt.bank}.`;
  } else if (top.featureVector.f1_nameSim >= 0.8) {
    reasoning = `Nome do recebedor ("${decoded.merchantName}") é compatível com "${top.debt.bank}".`;
  } else if (top.featureVector.f2_amountSim >= 0.9) {
    reasoning = `Valor de R$ ${decoded.amount?.toFixed(2) || '---'} coincide com a parcela esperada.`;
  } else {
    reasoning = `Associação estatística baseada em vencimento e histórico aproximado.`;
  }

  const alternativeCandidates = candidates.slice(1, 4).map(c => ({
    debtId: c.debt.id,
    debtName: c.debt.name,
    installmentNumber: c.installmentNumber,
    referenceMonth: c.referenceMonth,
    score: c.score
  }));

  return {
    debtId: top.debt.id,
    debtName: top.debt.name,
    bankName: top.debt.bank,
    installmentNumber: top.installmentNumber,
    totalInstallments: top.debt.totalInstallments,
    referenceMonth: top.referenceMonth,
    dueDate: top.debt.nextDueDate,
    confidenceScore: top.score,
    confidenceLevel,
    featureVector: top.featureVector,
    reasoning,
    alternativeCandidates
  };
}

/**
 * Gera a Máquina de Estados de Competência (Checklist da Linha do Tempo) para uma Dívida.
 */
export function buildCompetenceChecklist(
  debt: Debt,
  historicalPayments: Payment[],
  suggestedInstallmentNum: number
): CompetenceChecklistItem[] {
  const items: CompetenceChecklistItem[] = [];
  const total = debt.totalInstallments || 12;

  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();

  const paidPayments = historicalPayments.filter(p => p.debtId === debt.id && p.status === 'Pago');

  for (let i = 1; i <= Math.min(total, 12); i++) {
    const monthOffset = i - suggestedInstallmentNum;
    const targetDate = new Date(startYear, startMonth + monthOffset, debt.dueDate);
    const monthStr = `${(targetDate.getMonth() + 1).toString().padStart(2, '0')}/${targetDate.getFullYear()}`;

    const paidMatch = paidPayments.find(p => {
      if (!p.paidDate) return false;
      const pDate = new Date(p.paidDate);
      return pDate.getMonth() === targetDate.getMonth() && pDate.getFullYear() === targetDate.getFullYear();
    });

    if (paidMatch) {
      items.push({
        monthYear: monthStr,
        installmentNumber: i,
        status: 'PAID',
        paidDate: paidMatch.paidDate,
        amount: paidMatch.amount
      });
    } else if (i === suggestedInstallmentNum) {
      items.push({
        monthYear: monthStr,
        installmentNumber: i,
        status: 'SUGGESTED',
        amount: debt.installmentValue
      });
    } else if (i < suggestedInstallmentNum) {
      items.push({
        monthYear: monthStr,
        installmentNumber: i,
        status: 'PENDING_OVERDUE',
        amount: debt.installmentValue
      });
    } else {
      items.push({
        monthYear: monthStr,
        installmentNumber: i,
        status: 'PENDING',
        amount: debt.installmentValue
      });
    }
  }

  return items;
}
