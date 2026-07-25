/**
 * Utililitário para validação e decodificação de Linhas Digitáveis e Códigos de Barras de Boletos Bancários e Concessionárias (ISO/BACEN)
 */

export interface DecodedBoleto {
  valid: boolean;
  type: 'bancario' | 'concessionaria' | 'desconhecido';
  bankCode: string;
  bankName: string;
  amount: number | null;
  dueDate: string | null; // YYYY-MM-DD
  cleanLine: string;
  error?: string;
}

const BANK_CODES_MAP: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '077': 'Banco Inter',
  '104': 'Caixa Econômica Federal',
  '208': 'BTG Pactual',
  '212': 'Banco Original',
  '237': 'Bradesco',
  '260': 'Nubank / Nu Pagamentos',
  '336': 'C6 Bank',
  '341': 'Itaú Unibanco',
  '389': 'Banco Mercantil',
  '422': 'Banco Safra',
  '633': 'Banco Rendimento',
  '655': 'Neon Pagamentos',
  '748': 'Sicredi',
  '756': 'Sicoob'
};

export function parseBoletoLine(inputStr: string): DecodedBoleto {
  if (!inputStr || typeof inputStr !== 'string') {
    return {
      valid: false,
      type: 'desconhecido',
      bankCode: '',
      bankName: 'Desconhecido',
      amount: null,
      dueDate: null,
      cleanLine: '',
      error: 'Linha digitável não informada.'
    };
  }

  // Remove espaços, pontos e traços
  const clean = inputStr.replace(/[^0-9]/g, '');

  if (clean.length < 44 || clean.length > 48) {
    return {
      valid: false,
      type: 'desconhecido',
      bankCode: '',
      bankName: 'Desconhecido',
      amount: null,
      dueDate: null,
      cleanLine: clean,
      error: `Tamanho inválido para Boleto (${clean.length} dígitos). Esperado 44 ou 47/48 dígitos.`
    };
  }

  // Boleto de Concessionária (luz, água, gás, telefone) começa com '8'
  const isConcessionaria = clean.startsWith('8');

  // Identificação do Banco (3 primeiros dígitos para boleto bancário comercial)
  const bankCode = isConcessionaria ? '888' : clean.substring(0, 3);
  const bankName = isConcessionaria ? 'Concessionária de Serviços' : (BANK_CODES_MAP[bankCode] || `Banco ${bankCode}`);

  let amount: number | null = null;
  let dueDate: string | null = null;

  if (!isConcessionaria) {
    // Boleto Bancário de 47 dígitos (Linha Digitável Comum)
    if (clean.length === 47) {
      // Valor do boleto: 10 últimos dígitos (centavos)
      const amountStr = clean.substring(37, 47);
      const valCent = parseInt(amountStr, 10);
      if (!isNaN(valCent) && valCent > 0) {
        amount = valCent / 100;
      }

      // Fator de vencimento: 4 dígitos (posições 33 a 37)
      const factorStr = clean.substring(33, 37);
      const factor = parseInt(factorStr, 10);
      if (!isNaN(factor) && factor > 1000) {
        // Base de cálculo do Bacen: 07/10/1997
        const baseDate = new Date(1997, 9, 7);
        baseDate.setDate(baseDate.getDate() + factor);
        dueDate = baseDate.toISOString().split('T')[0];
      }
    } else if (clean.length === 44) {
      // Código de barras de 44 dígitos
      const amountStr = clean.substring(9, 19);
      const valCent = parseInt(amountStr, 10);
      if (!isNaN(valCent) && valCent > 0) {
        amount = valCent / 100;
      }

      const factorStr = clean.substring(5, 9);
      const factor = parseInt(factorStr, 10);
      if (!isNaN(factor) && factor > 1000) {
        const baseDate = new Date(1997, 9, 7);
        baseDate.setDate(baseDate.getDate() + factor);
        dueDate = baseDate.toISOString().split('T')[0];
      }
    }
  } else {
    // Concessionária (48 dígitos)
    if (clean.length === 48) {
      // Posições de valor em concessionárias dependem do módulo de verificação
      const amountStr = clean.substring(4, 15);
      const valCent = parseInt(amountStr, 10);
      if (!isNaN(valCent) && valCent > 0) {
        amount = valCent / 100;
      }
    }
  }

  return {
    valid: true,
    type: isConcessionaria ? 'concessionaria' : 'bancario',
    bankCode,
    bankName,
    amount,
    dueDate,
    cleanLine: clean
  };
}
