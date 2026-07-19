import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

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

    let transaction = globalTransactions.get(id);

    if (!transaction) {
      console.log(`[DataPay Status API] Transação ${id} não encontrada em memória. Buscando no MongoDB...`);
      try {
        const { db } = await connectToDatabase();
        transaction = await db.collection('Transactions').findOne({ id });
      } catch (dbErr: any) {
        console.error('[DataPay Status API DB Error] Falha ao consultar transação no MongoDB:', dbErr.message);
      }
    }

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

export async function POST(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'ID e status são obrigatórios.' }, { status: 400 });
    }

    console.log(`[DataPay Status API] Solicitado cancelamento / alteração da transação ${id} para: ${status}`);

    // 1. Atualiza no mapa de memória local
    const transaction = globalTransactions.get(id);
    if (transaction) {
      transaction.status = status;
      transaction.updatedAt = new Date().toISOString();
      globalTransactions.set(id, transaction);
    }

    // 2. Atualiza no MongoDB
    try {
      const { db } = await connectToDatabase();
      await db.collection('Transactions').updateOne(
        { id },
        { $set: { status, updatedAt: new Date().toISOString() } }
      );
      console.log(`[DataPay Status API] Transação ${id} atualizada no MongoDB para: ${status}`);
    } catch (dbErr: any) {
      console.error('[DataPay Status API DB Error] Falha ao atualizar transação no MongoDB:', dbErr.message);
    }

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
