import { NextRequest, NextResponse } from 'next/server';

// Busca a mesma referência de memória global para obter as transações ativas
const globalTransactions = (global as any).paymentTransactions || new Map();
(global as any).paymentTransactions = globalTransactions;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Parâmetro "id" é obrigatório na requisição.' },
        { status: 400 }
      );
    }

    const transaction = globalTransactions.get(id);

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transação não localizada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      debts: transaction.debts,
      updatedAt: transaction.updatedAt
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Falha ao buscar status do Pix.', details: error.message },
      { status: 500 }
    );
  }
}
