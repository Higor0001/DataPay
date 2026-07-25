import {
  PierreAccount,
  PierreBalanceData,
  PierreTransaction,
  PierreBillSummary,
  PierreApiResponse,
  PierreSyncResponse
} from '../types/pierre';

const PIERRE_BASE_URL = 'https://pierre.finance/tools/api';

/**
 * Helper to retrieve stored API Key from localStorage or environment
 */
export function getStoredPierreApiKey(): string {
  if (typeof window !== 'undefined') {
    const key = localStorage.getItem('datapay_pierre_api_key');
    if (key) return key;
  }
  return process.env.NEXT_PUBLIC_PIERRE_API_KEY || '';
}

export function setStoredPierreApiKey(apiKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('datapay_pierre_api_key', apiKey.trim());
  }
}

/**
 * Service to communicate with Pierre Open Finance API
 */
export class PierreFinanceService {
  /**
   * Internal fetch wrapper with Authorization Bearer
   */
  private static async request<T>(endpoint: string, options: RequestInit = {}, customApiKey?: string): Promise<PierreApiResponse<T>> {
    const apiKey = customApiKey || getStoredPierreApiKey();

    // Route through local Next API proxy if available to avoid CORS and protect credentials
    const isServer = typeof window === 'undefined';
    
    // Check if API key starts with sk- or is available
    if (!apiKey && !isServer) {
      console.warn('[Pierre Service] API Key não configurada. Usando dados demonstrativos da Pierre Open Finance API.');
      return this.getMockResponse<T>(endpoint);
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
      };

      if (apiKey) {
        headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
      }

      const res = await fetch(`${PIERRE_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Erro HTTP ${res.status} ao consultar Pierre API`);
      }

      const responseData = await res.json();
      return responseData;
    } catch (err: any) {
      console.error(`[Pierre API Error] ${endpoint}:`, err.message);
      // If request fails (e.g. invalid key or network issue), return fallback structured response with error message
      return {
        success: false,
        error: err.message,
        data: (this.getMockResponse<T>(endpoint)).data
      };
    }
  }

  /**
   * 1. GET ACCOUNTS (/tools/api/get-accounts)
   * Retorna todas as contas financeiras do usuário no Pierre Open Finance
   */
  public static async getAccounts(apiKey?: string): Promise<PierreApiResponse<PierreAccount[]>> {
    const res = await this.request<any[]>('/get-accounts', { method: 'GET' }, apiKey);
    if (res.success && Array.isArray(res.data)) {
      const normalizedAccounts: PierreAccount[] = res.data.map((acc: any) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype,
        balance: typeof acc.balance === 'string' ? parseFloat(acc.balance) : (acc.balance || 0),
        currency: acc.currencyCode || acc.currency || 'BRL',
        brandName: acc.connectorName || acc.brandName || acc.marketingName || 'Open Finance',
        institution: acc.connectorName || acc.institution || 'Banco Conectado',
        accountNumber: acc.number ? `•••• ${acc.number.slice(-4)}` : undefined,
        updatedAt: acc.updatedAt
      }));
      return { ...res, data: normalizedAccounts };
    }
    return res as PierreApiResponse<PierreAccount[]>;
  }

  /**
   * 2. GET BALANCE (/tools/api/get-balance)
   * Retorna o saldo consolidado total e o saldo por instituição
   */
  public static async getBalance(apiKey?: string): Promise<PierreApiResponse<PierreBalanceData>> {
    const res = await this.request<any>('/get-balance', { method: 'GET' }, apiKey);
    if (res.success && res.data) {
      const d = res.data;
      const normalized: PierreBalanceData = {
        totalBalance: typeof d.total_balance !== 'undefined' ? (typeof d.total_balance === 'string' ? parseFloat(d.total_balance) : d.total_balance) : (typeof d.totalBalance === 'string' ? parseFloat(d.totalBalance) : (d.totalBalance || 0)),
        currency: d.currency || 'BRL',
        accounts: Array.isArray(d.accounts) ? d.accounts.map((a: any) => ({
          accountId: a.id || a.accountId,
          accountName: a.name || a.accountName,
          brandName: a.brandName || a.connectorName,
          balance: typeof a.balance === 'string' ? parseFloat(a.balance) : (a.balance || 0),
          currency: a.currency || 'BRL',
          type: a.account_type || a.type
        })) : [],
        updatedAt: res.timestamp
      };
      return { ...res, data: normalized };
    }
    return res as PierreApiResponse<PierreBalanceData>;
  }

  /**
   * 3. GET BALANCE BY ACCOUNT (/tools/api/get-balance-by-account)
   * Retorna o saldo de uma conta específica
   */
  public static async getBalanceByAccount(accountId: string, apiKey?: string): Promise<PierreApiResponse<any>> {
    return this.request<any>(`/get-balance-by-account?accountId=${encodeURIComponent(accountId)}`, { method: 'GET' }, apiKey);
  }

  /**
   * 4. GET TRANSACTIONS (/tools/api/get-transactions)
   * Retorna o extrato bancário inteligente com suporte a filtro em linguagem natural
   */
  public static async getTransactions(
    params: {
      startDate?: string;
      endDate?: string;
      categories?: string;
      minAmount?: number;
      maxAmount?: number;
      accountType?: 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN';
      accountSubtype?: string;
      format?: 'raw' | 'structured';
      clientMessage?: string;
    } = {},
    apiKey?: string
  ): Promise<PierreApiResponse<PierreTransaction[] | any>> {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.categories) query.append('categories', params.categories);
    if (params.minAmount !== undefined) query.append('minAmount', params.minAmount.toString());
    if (params.maxAmount !== undefined) query.append('maxAmount', params.maxAmount.toString());
    if (params.accountType) query.append('accountType', params.accountType);
    if (params.accountSubtype) query.append('accountSubtype', params.accountSubtype);
    if (params.format) query.append('format', params.format);
    if (params.clientMessage) query.append('clientMessage', params.clientMessage);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<PierreTransaction[] | any>(`/get-transactions${queryString}`, { method: 'GET' }, apiKey);
  }

  /**
   * 5. GET BILL SUMMARY (/tools/api/get-bill-summary)
   * Retorna o resumo da fatura atual dos cartões de crédito
   */
  public static async getBillSummary(params: { accountId?: string; closingDay?: number } = {}, apiKey?: string): Promise<PierreApiResponse<PierreBillSummary[]>> {
    const query = new URLSearchParams();
    if (params.accountId) query.append('accountId', params.accountId);
    if (params.closingDay) query.append('closingDay', params.closingDay.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<PierreBillSummary[]>(`/get-bill-summary${queryString}`, { method: 'GET' }, apiKey);
  }

  /**
   * 6. MANUAL UPDATE (/tools/api/manual-update)
   * Sincroniza em tempo real com as contas bancárias no Open Finance
   */
  public static async manualUpdate(apiKey?: string): Promise<PierreSyncResponse> {
    const res = await this.request<any>('/manual-update', { method: 'POST' }, apiKey);
    return {
      success: res.success,
      message: res.message || 'Sincronização com instituições financeiras concluída.',
      details: res.data
    };
  }

  /**
   * Demonstration/Fallback Mock Data Generator (used when key is not provided or in preview mode)
   */
  private static getMockResponse<T>(endpoint: string): PierreApiResponse<T> {
    if (endpoint.includes('/get-accounts')) {
      const mockAccounts: PierreAccount[] = [
        {
          id: 'acc_pierre_01',
          name: 'Conta Corrente Principal',
          type: 'BANK',
          subtype: 'CHECKING_ACCOUNT',
          balance: 8450.30,
          currency: 'BRL',
          brandName: 'Nubank',
          institution: 'Nubank S.A.',
          accountNumber: '•••• 4892'
        },
        {
          id: 'acc_pierre_02',
          name: 'Conta Poupança / Reserva',
          type: 'BANK',
          subtype: 'SAVINGS_ACCOUNT',
          balance: 15200.00,
          currency: 'BRL',
          brandName: 'Itaú',
          institution: 'Itaú Unibanco',
          accountNumber: '•••• 1045'
        },
        {
          id: 'acc_pierre_03',
          name: 'Cartão de Crédito Black',
          type: 'CREDIT',
          subtype: 'CREDIT_CARD',
          balance: -3280.50,
          currency: 'BRL',
          brandName: 'Santander',
          institution: 'Banco Santander Brasil',
          accountNumber: '•••• 8821'
        }
      ];
      return { success: true, data: mockAccounts as T, count: mockAccounts.length };
    }

    if (endpoint.includes('/get-balance')) {
      const mockBalance: PierreBalanceData = {
        totalBalance: 20369.80,
        currency: 'BRL',
        accounts: [
          { accountId: 'acc_pierre_01', accountName: 'Nubank Conta', brandName: 'Nubank', balance: 8450.30, currency: 'BRL', type: 'BANK' },
          { accountId: 'acc_pierre_02', accountName: 'Itaú Poupança', brandName: 'Itaú', balance: 15200.00, currency: 'BRL', type: 'BANK' },
          { accountId: 'acc_pierre_03', accountName: 'Santander Crédito', brandName: 'Santander', balance: -3280.50, currency: 'BRL', type: 'CREDIT' }
        ],
        updatedAt: new Date().toISOString()
      };
      return { success: true, data: mockBalance as T };
    }

    if (endpoint.includes('/get-transactions')) {
      const mockTransactions: PierreTransaction[] = [
        {
          id: 'tx_p_101',
          description: 'Supermercado Pão de Açúcar',
          amount: 450.80,
          date: '2026-07-24T14:30:00Z',
          category: 'Alimentação',
          type: 'DEBIT',
          accountId: 'acc_pierre_01',
          accountName: 'Nubank Conta',
          status: 'POSTED',
          paymentMethod: 'Pix'
        },
        {
          id: 'tx_p_102',
          description: 'Pagamento Salário / Remuneração',
          amount: 6800.00,
          date: '2026-07-20T08:00:00Z',
          category: 'Renda',
          type: 'CREDIT',
          accountId: 'acc_pierre_01',
          accountName: 'Nubank Conta',
          status: 'POSTED',
          paymentMethod: 'TED'
        },
        {
          id: 'tx_p_103',
          description: 'Posto Shell Combustível',
          amount: 220.00,
          date: '2026-07-18T18:15:00Z',
          category: 'Transporte',
          type: 'DEBIT',
          accountId: 'acc_pierre_03',
          accountName: 'Santander Crédito',
          status: 'POSTED',
          paymentMethod: 'Cartão de Crédito'
        },
        {
          id: 'tx_p_104',
          description: 'Assinatura Netflix / Streaming',
          amount: 55.90,
          date: '2026-07-15T10:00:00Z',
          category: 'Entretenimento',
          type: 'DEBIT',
          accountId: 'acc_pierre_03',
          accountName: 'Santander Crédito',
          status: 'POSTED',
          paymentMethod: 'Cartão de Crédito'
        },
        {
          id: 'tx_p_105',
          description: 'Restaurante Coco Bambu',
          amount: 310.00,
          date: '2026-07-12T21:40:00Z',
          category: 'Alimentação',
          type: 'DEBIT',
          accountId: 'acc_pierre_01',
          accountName: 'Nubank Conta',
          status: 'POSTED',
          paymentMethod: 'Pix'
        }
      ];
      return { success: true, data: mockTransactions as T, count: mockTransactions.length };
    }

    if (endpoint.includes('/get-bill-summary')) {
      const mockBillSummaries: PierreBillSummary[] = [
        {
          accountId: 'acc_pierre_03',
          accountName: 'Santander Black',
          totalLimit: 15000.00,
          availableLimit: 11719.50,
          currentBillAmount: 3280.50,
          dueDate: '2026-08-10',
          closingDay: 3
        }
      ];
      return { success: true, data: mockBillSummaries as T };
    }

    return { success: true, data: null as unknown as T };
  }
}
