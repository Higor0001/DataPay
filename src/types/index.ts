export type DebtType =
  | 'Empréstimo'
  | 'Financiamento'
  | 'Cartão'
  | 'Consignado'
  | 'Parcelamento'
  | 'Crediário'
  | 'Negociação';

export interface Attachment {
  name: string;
  url: string;
  type: 'pdf' | 'image';
}

export interface Debt {
  id: string;
  name: string;
  bank: string;
  type: DebtType;
  originalValue: number;
  currentBalance: number;
  interestRate: number; // % ao mês
  cet: number; // Custo Efetivo Total % ao ano
  iof: number;
  fine: number; // Multa em %
  delayFee: number; // Mora em % ao mês
  contractDate: string;
  dueDate: number; // Dia de vencimento (1 a 31)
  nextDueDate: string; // Data completa do próximo vencimento YYYY-MM-DD
  totalInstallments: number;
  remainingInstallments: number;
  installmentValue: number;
  indexUsed: string; // IPCA, CDI, Taxa Fixa, etc.
  notes?: string;
  attachments?: Attachment[];
  status: 'active' | 'negotiation' | 'paid' | 'overdue';
}

export interface Payment {
  id: string;
  debtId: string;
  debtName: string;
  bankName: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'Pago' | 'Pendente' | 'Atrasado' | 'Agendado' | 'Reembolsado';
  method: 'Pix' | 'Boleto' | 'Reserva Inteligente' | 'Automático';
  type: 'Parcela' | 'Amortização' | 'Quitação';
  receipt?: string;
  remainingBalanceAfterPayment?: number;
}

export interface SmartReserve {
  goalValue: number;
  currentBalance: number;
  history: {
    id: string;
    date: string;
    amount: number;
    type: 'deposit' | 'withdraw';
    description: string;
  }[];
}

export interface Goal {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  type: 'quitar_cartao' | 'quitar_emprestimo' | 'eliminar_dividas' | 'criar_reserva' | 'fundo_emergencia';
  deadline: string;
  accumulatedSavings: number;
}

export interface BankIntegration {
  id: string;
  name: string;
  logo: string;
  connected: boolean;
  lastSync?: string;
  consentExpiry?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  content: string;
  date: string;
  read: boolean;
  type: 'info' | 'warning' | 'alert' | 'success';
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}
