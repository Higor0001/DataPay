/**
 * SERVIÇO DE INTEGRAÇÃO OPEN FINANCE BRASIL
 * Mapeia a arquitetura OAuth2 e fornece os métodos necessários para comunicação,
 * consentimento e extração de dados das APIs do Open Finance no Brasil.
 */

export interface OpenFinanceConsent {
  consentId: string;
  bankId: string;
  status: 'AWAITING_AUTHORISATION' | 'AUTHORISED' | 'REJECTED' | 'REVOKED';
  permissions: string[];
  expirationDateTime: string;
  transactionFromDateTime?: string;
}

export interface OpenFinanceAccount {
  accountId: string;
  brandName: string;
  companyName: string;
  type: 'CONTA_CORRENTE' | 'CONTA_POUPANCA' | 'CONTA_PAGAMENTO';
  subtype: 'INDIVIDUAL' | 'CONJUNTA';
  currency: string;
  status: 'ACTIVE' | 'BLOCKED';
}

export interface OpenFinanceCreditCard {
  creditCardAccountId: string;
  brandName: string;
  companyName: string;
  name: string;
  productType: 'BASIC' | 'GOLD' | 'PLATINUM' | 'BLACK';
  billDueDate: number;
}

export interface OpenFinanceLoan {
  contractId: string;
  brandName: string;
  companyName: string;
  productType: 'EMPRESTIMO_PESSOAL' | 'FINANCIAMENTO' | 'CONSIGNADO';
  contractDate: string;
  disbursedAmount: number;
  interestRate: number; // % ao mês
  totalInstallments: number;
}

export class OpenFinanceService {
  /**
   * 1. CONFIGURAÇÃO DE REDIRECIONAMENTO OAUTH2
   * Gera a URL de autorização para o banco selecionado seguindo o padrão Open Finance Brasil.
   */
  public static generateConsentUrl(bankId: string, redirectUri: string): { consentId: string; authUrl: string } {
    const consentId = `urn:banco:${bankId}:${Math.random().toString(36).substring(2, 11)}`;
    
    // Escopos obrigatórios regulados pelo Banco Central do Brasil (BACEN)
    const scopes = [
      'openid',
      'consents',
      'resources',
      'accounts',
      'credit-cards',
      'loans'
    ].join(' ');

    // URLs de Autorização OAuth2 simuladas de cada instituição
    const authEndpoints: Record<string, string> = {
      nubank: 'https://api.nubank.com.br/oauth/v2/authorize',
      itau: 'https://api.itau.com.br/oauth/v2/authorize',
      caixa: 'https://login.caixa.gov.br/oauth/v2/authorize',
      bb: 'https://oauth.bb.com.br/oauth/v2/authorize',
      santander: 'https://openfinance.santander.com.br/oauth/v2/authorize',
      mercadopago: 'https://api.mercadopago.com/oauth/v2/authorize'
    };

    const baseEndpoint = authEndpoints[bankId] || 'https://api.openfinance.org.br/oauth/v2/authorize';
    
    // Parâmetros obrigatórios de redirecionamento OAuth2
    const queryParams = new URLSearchParams({
      response_type: 'code',
      client_id: `client_datapay_prod_${bankId}`,
      redirect_uri: redirectUri,
      scope: scopes,
      state: Math.random().toString(36).substring(2, 15),
      request: consentId // No padrão Open Finance, o request JWT contém o ID do consentimento prévio
    });

    return {
      consentId,
      authUrl: `${baseEndpoint}?${queryParams.toString()}`
    };
  }

  /**
   * 2. TROCA DE CÓDIGO POR TOKEN DE ACESSO
   * Simula a troca do authorization_code pelo token de acesso final de acordo com a RFC 6749.
   */
  public static async exchangeAuthCode(code: string, bankId: string, redirectUri: string): Promise<string> {
    console.log(`[Open Finance] Trocando Authorization Code para o banco ${bankId}...`);
    
    // Em produção, isso seria uma chamada para o seu backend para evitar expor o Client Secret no frontend.
    // POST https://auth.banco.com.br/oauth/v2/token
    // Body: grant_type=authorization_code&code={code}&redirect_uri={redirectUri}&client_id={clientId}&client_secret={clientSecret}
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`access_token_of_${bankId}_${Math.random().toString(36).substring(2, 20)}`);
      }, 1000);
    });
  }

  /**
   * 3. EXTRAÇÃO DE CONTRATOS E FATURAS (MOCK DE PRODUÇÃO)
   * Importa automaticamente os dados financeiros reais da conta do cliente do Open Finance.
   */
  public static async fetchBankData(accessToken: string, bankId: string): Promise<{ debts: any[]; payments: any[] }> {
    console.log(`[Open Finance] Buscando contas e contratos ativos usando o token do ${bankId}...`);
    
    // Simula as chamadas de API:
    // GET https://api.banco.com.br/accounts/v1/accounts
    // GET https://api.banco.com.br/loans/v1/contracts
    // GET https://api.banco.com.br/credit-cards/v1/accounts
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Retorna dívidas fictícias baseadas no banco para o simulador
        const mockDebts: Record<string, any[]> = {
          nubank: [
            {
              name: 'Fatura Open Finance',
              bank: 'Nubank',
              type: 'Cartão',
              originalValue: 3200,
              currentBalance: 3200,
              interestRate: 14.5,
              cet: 395.4,
              iof: 18.2,
              fine: 2,
              delayFee: 1,
              contractDate: '2026-07-01',
              dueDate: 15,
              totalInstallments: 1,
              remainingInstallments: 1,
              installmentValue: 3200,
              indexUsed: 'Taxa Fixa',
              notes: 'Importado de forma automática via Open Finance.'
            }
          ],
          itau: [
            {
              name: 'Crédito Pessoal Itaú',
              bank: 'Itaú',
              type: 'Empréstimo',
              originalValue: 12000,
              currentBalance: 8400,
              interestRate: 4.5,
              cet: 72.8,
              iof: 85.0,
              fine: 2,
              delayFee: 1.2,
              contractDate: '2026-02-10',
              dueDate: 10,
              totalInstallments: 12,
              remainingInstallments: 6,
              installmentValue: 1400,
              indexUsed: 'Prefixado',
              notes: 'Importado de forma automática via Open Finance.'
            }
          ]
        };

        const debts = mockDebts[bankId] || [];
        const payments = debts.map((d, i) => ({
          id: `p_of_${bankId}_${i}`,
          debtName: d.name,
          bankName: d.bank,
          amount: d.installmentValue,
          dueDate: '2026-08-15',
          status: 'Pendente',
          method: 'Pix',
          type: 'Parcela'
        }));

        resolve({ debts, payments });
      }, 1500);
    });
  }
}

/**
 * =========================================================================
 * 💡 GUIA DE INTEGRAÇÃO COM AGREGADORES OPEN FINANCE (PLUGGY OU BELVO)
 * =========================================================================
 * Para evitar conectar com o endpoint de cada banco brasileiro manualmente,
 * a melhor prática é integrar um Hub Agregador como o Pluggy ou Belvo.
 * 
 * 1. INTEGRAÇÃO PLUGGY (https://pluggy.ai/)
 * 
 * Exemplo de backend em Node.js usando o SDK do Pluggy:
 * ```javascript
 * const { PluggyClient } = require('pluggy-sdk');
 * const client = new PluggyClient({
 *   clientId: process.env.PLUGGY_CLIENT_ID,
 *   clientSecret: process.env.PLUGGY_CLIENT_SECRET,
 * });
 * 
 * // Rota 1: Gerar Token do Widget para abrir no frontend do PWA
 * app.post('/api/open-finance/connect-token', async (req, res) => {
 *   const connectionToken = await client.createConnectToken();
 *   res.json({ accessToken: connectionToken.accessToken });
 * });
 * 
 * // Rota 2: Buscar contratos de empréstimos consolidados de uma conexão
 * app.get('/api/open-finance/loans/:itemConnectionId', async (req, res) => {
 *   const loans = await client.fetchLoans(req.params.itemConnectionId);
 *   res.json(loans.results); // Retorna taxas, amortizações e prazos
 * });
 * ```
 * 
 * 2. FLUXO NO FRONTEND DO APP (PWA):
 * ```javascript
 * // Abrir o Pluggy Connect Widget no PWA
 * const response = await fetch('/api/open-finance/connect-token', { method: 'POST' });
 * const { accessToken } = await response.json();
 * 
 * const pluggyConnect = new PluggyConnect({
 *   connectToken: accessToken,
 *   onSuccess: (connectionData) => {
 *     // Sincroniza os dados bancários no Supabase usando o ID da conexão
 *     fetch(`/api/sync-bank/${connectionData.item.id}`);
 *   }
 * });
 * pluggyConnect.open();
 * ```
 */
