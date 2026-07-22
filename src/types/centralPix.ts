export interface EMVDecodedPayload {
  formatIndicator: string; // ID 00
  merchantInfo: {
    gui?: string; // Sub-00 (br.gov.bcb.pix)
    key?: string; // Sub-01
    url?: string; // Sub-25 (Pix Dinâmico)
    rawTag26?: string;
  };
  mcc?: string; // ID 52
  currency: string; // ID 53 (986 = BRL)
  amount?: number; // ID 54
  countryCode: string; // ID 58 (BR)
  merchantName: string; // ID 59
  merchantCity: string; // ID 60
  additionalData?: {
    txid?: string; // Sub-05
    rawTag62?: string;
  };
  crc16: string; // ID 63
  crcValid: boolean;
  isDynamic: boolean;
}

export interface FeatureVector {
  f1_nameSim: number;      // 0.0 - 1.0 Levenshtein / Fuzzy
  f2_amountSim: number;    // 0.0 - 1.0 Proximidade de valor
  f3_temporalSim: number;  // 0.0 - 1.0 Decaimento gaussiano até vencimento
  f4_txidMatch: number;    // 0.0 ou 1.0 Match de mês/parcela no TXID
  f5_keyMatch: number;     // 0.0 ou 1.0 Histórico de chaves Pix
}

export interface AIPrediction {
  debtId: string;
  debtName: string;
  bankName: string;
  installmentNumber: number;
  totalInstallments: number;
  referenceMonth: string; // MM/YYYY
  dueDate: string; // YYYY-MM-DD
  confidenceScore: number; // 0.0 to 1.0 (ex: 0.982)
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'; // >=95% HIGH, 80-94% MEDIUM, <80% LOW
  featureVector: FeatureVector;
  reasoning: string;
  alternativeCandidates?: {
    debtId: string;
    debtName: string;
    installmentNumber: number;
    referenceMonth: string;
    score: number;
  }[];
}

export interface PixReceiptItem {
  id: string;
  rawPayload: string;
  decoded: EMVDecodedPayload;
  receivedAt: string;
  status: 'PENDING' | 'PAID' | 'PAID_PARTIAL' | 'PAID_LATE' | 'IGNORED';
  prediction?: AIPrediction;
  linkedInstallmentId?: string;
  linkedDebtId?: string;
  amountPaid?: number;
  paidAt?: string;
  daysLate?: number;
  userOverridden?: boolean;
}

export interface CompetenceChecklistItem {
  monthYear: string;
  installmentNumber: number;
  status: 'PAID' | 'PENDING' | 'PENDING_OVERDUE' | 'SUGGESTED';
  paidDate?: string;
  amount?: number;
}
