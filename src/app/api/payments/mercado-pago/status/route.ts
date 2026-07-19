import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { MercadoPagoConfig, Payment } from 'mercadopago';

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

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // Se a transação ainda está Pendente no banco/memória e não é sandbox, faz consulta direta à API do Mercado Pago
    if (transaction.status === 'Pendente' && !id.startsWith('sandbox_mp_') && token) {
      try {
        console.log(`[DataPay Status API] Consultando status real de ${id} na API do Mercado Pago...`);
        const client = new MercadoPagoConfig({ accessToken: token });
        const paymentClient = new Payment(client);
        const mpData = await paymentClient.get({ id });

        if (mpData && mpData.status === 'approved') {
          console.log(`[DataPay Status API] Transação real ${id} confirmada como APROVADA na API do Mercado Pago!`);
          transaction.status = 'Pago';
          transaction.updatedAt = new Date().toISOString();
          
          globalTransactions.set(id, transaction);

          // 1. Atualiza no banco de dados MongoDB (coleção Transactions)
          const { db } = await connectToDatabase();
          await db.collection('Transactions').updateOne(
            { id },
            { $set: { status: 'Pago', updatedAt: transaction.updatedAt } }
          );

          // 2. Executa a baixa das faturas na coleção Finanças se houver dívidas vinculadas
          if (transaction.debts && transaction.debts.length > 0) {
            const firstDebtId = transaction.debts[0].debtId;
            const userDoc = await db.collection('Finanças').findOne({ "debts.id": firstDebtId });

            if (userDoc) {
              const userId = userDoc.userId;
              let debts = userDoc.debts || [];
              let payments = userDoc.payments || [];
              let notifications = userDoc.notifications || [];

              for (const item of transaction.debts) {
                const debtId = item.debtId;
                const paidAmount = Number(item.amount);

                let debtName = '';
                let bankName = '';
                debts = debts.map((d: any) => {
                  if (d.id === debtId) {
                    debtName = d.name;
                    bankName = d.bank;
                    const currentBalance = Number(d.currentBalance) || 0;
                    const newBalance = Math.max(0, currentBalance - paidAmount);
                    const status = newBalance <= 0 ? 'paid' : 'active';
                    const remainingInstallments = d.remainingInstallments ? Math.max(0, d.remainingInstallments - 1) : 0;
                    return {
                      ...d,
                      currentBalance: newBalance,
                      status: status,
                      remainingInstallments: remainingInstallments
                    };
                  }
                  return d;
                });

                const paymentId = `p_mp_${id}_${debtId}`;
                payments = payments.filter((p: any) => p.id !== paymentId);
                payments.push({
                  id: paymentId,
                  userId,
                  debtId,
                  debtName: debtName || 'Dívida',
                  bankName: bankName || 'Banco',
                  amount: paidAmount,
                  dueDate: new Date().toISOString().split('T')[0],
                  paidDate: new Date().toISOString(),
                  status: 'Pago',
                  method: 'Pix',
                  type: 'Parcela'
                });

                const notificationId = `n_mp_${id}_${debtId}`;
                notifications = notifications.filter((n: any) => n.id !== notificationId);
                notifications.unshift({
                  id: notificationId,
                  userId,
                  title: 'Pagamento Confirmado',
                  content: `Seu pagamento Pix de R$ ${paidAmount.toLocaleString('pt-BR')} para a dívida "${debtName}" foi compensado com sucesso!`,
                  type: 'success',
                  date: new Date().toISOString(),
                  read: false
                });
              }

              await db.collection('Finanças').updateOne(
                { userId },
                { $set: { debts, payments, notifications } }
              );
              console.log(`[DataPay Status API] Baixa efetuada no MongoDB para o usuário ${userId}`);
            }
          }
        }
      } catch (mpErr: any) {
        console.warn(`[DataPay Status API Live Check Warning] Erro ao consultar Pix ${id} diretamente no MP:`, mpErr.message);
      }
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
