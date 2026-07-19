import { NextRequest, NextResponse } from 'next/server';

const asaasTransactions = (global as any).asaasTransactions || new Map();
(global as any).asaasTransactions = asaasTransactions;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Parâmetro ID é obrigatório.' }, { status: 400 });
    }

    const transaction = asaasTransactions.get(id);

    if (!transaction) {
      return NextResponse.json({ error: 'Transação não encontrada.' }, { status: 404 });
    }

    const ASAAS_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    const isRealAsaas = ASAAS_KEY && ASAAS_KEY.trim() !== '' && !ASAAS_KEY.includes('mock');

    if (transaction.status === 'Pendente') {
      if (isRealAsaas) {
        try {
          const res = await fetch(`${ASAAS_URL}/payments/${id}`, {
            method: 'GET',
            headers: { 'access_token': ASAAS_KEY! }
          });
          if (res.ok) {
            const data = await res.json();
            // Statuses do Asaas: RECEIVED, CONFIRMED, OVERDUE, PENDING
            if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
              transaction.status = 'Pago';
              transaction.updatedAt = new Date().toISOString();
              asaasTransactions.set(id, transaction);
            }
          }
        } catch (err) {
          console.error('[Asaas Status API Error]:', err);
        }
      } else {
        // Simulação automática: Pago após 10 segundos
        const elapsed = (Date.now() - new Date(transaction.createdAt).getTime()) / 1000;
        if (elapsed > 10) {
          transaction.status = 'Pago';
          transaction.updatedAt = new Date().toISOString();
          asaasTransactions.set(id, transaction);
        }
      }
    }

    return NextResponse.json({
      success: true,
      id: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      debts: transaction.debts
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
