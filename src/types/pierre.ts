/**
 * PIERRE OPEN FINANCE API TYPES
 * Tipos e interfaces de resposta da API do Pierre Finance (https://docs.pierre.finance)
 */

export interface PierreAccount {
  id: string;
  name: string;
  type: 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN' | string;
  subtype?: 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'CREDIT_CARD' | 'PAYMENT_ACCOUNT' | string;
  balance: number;
  currency?: string;
  brandName?: string;
  institution?: string;
  accountNumber?: string;
  updatedAt?: string;
}

export interface PierreAccountBalanceItem {
  accountId: string;
  accountName: string;
  brandName?: string;
  balance: number;
  currency: string;
  type: string;
}

export interface PierreBalanceData {
  totalBalance: number;
  currency: string;
  accounts: PierreAccountBalanceItem[];
  updatedAt?: string;
}

export interface PierreTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type: 'DEBIT' | 'CREDIT' | string;
  accountId: string;
  accountName?: string;
  status?: 'POSTED' | 'PENDING' | string;
  paymentMethod?: string;
}

export interface PierreStructuredTransactionsData {
  totalAmount: number;
  totalIncome?: number;
  totalExpense?: number;
  byCategory?: Record<string, number>;
  transactions: PierreTransaction[];
}

export interface PierreBillSummary {
  accountId: string;
  accountName?: string;
  totalLimit: number;
  availableLimit: number;
  currentBillAmount: number;
  dueDate?: string;
  closingDay?: number;
}

export interface PierreApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface PierreSyncResponse {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  timestamp?: string;
}
