import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, PaymentRefund } from 'mercadopago';
import { connectToDatabase } from '@/utils/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { paymentId, transactionId } = await req.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: 'ID de pagamento ausente na requisição.' },
        { status: 400 }
      );
    }

    console.log(`[DataPay Refund] Solicitando reembolso para o pagamento: ${paymentId}`);

    const { db } = await connectToDatabase();

    // 1. Localiza a conta do usuário que contém este pagamento no array de pagamentos
    const userDoc = await db.collection('Finanças').findOne({ "payments.id": paymentId });

    if (!userDoc) {
      return NextResponse.json(
        { error: 'Registro de pagamento não localizado no banco de dados.' },
        { status: 404 }
      );
    }

    const userId = userDoc.userId;
    let debts = userDoc.debts || [];
    let payments = userDoc.payments || [];
    let notifications = userDoc.notifications || [];
    let reserve = userDoc.reserve || { goalValue: 0, currentBalance: 0, history: [] };

    // Encontra o pagamento específico
    const targetPayment = payments.find((p: any) => p.id === paymentId);
    if (!targetPayment) {
      return NextResponse.json(
        { error: 'Lançamento de pagamento não localizado na lista do usuário.' },
        { status: 404 }
      );
    }

    if (targetPayment.status === 'Reembolsado') {
      return NextResponse.json(
        { error: 'Este pagamento já se encontra estornado/reembolsado.' },
        { status: 400 }
      );
    }

    // Extrai o ID da transação original (ex: p_mp_12345678_d1 -> 12345678)
    const rawTxId = transactionId || (paymentId.startsWith('p_mp_') ? paymentId.split('_')[2] : '');
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // 2. Se for um pagamento real via Mercado Pago, efetua o estorno oficial na API do MP
    if (rawTxId && !rawTxId.startsWith('sandbox_mp_') && !isNaN(Number(rawTxId)) && token) {
      try {
        console.log(`[DataPay Refund] Executando estorno oficial no Mercado Pago para a transação ${rawTxId}...`);
        const client = new MercadoPagoConfig({ accessToken: token });
        const paymentRefund = new PaymentRefund(client);
        
        await paymentRefund.create({ payment_id: Number(rawTxId) });
        console.log(`[DataPay Refund] Estorno no Mercado Pago efetuado com sucesso para ID ${rawTxId}.`);
      } catch (mpErr: any) {
        console.error('[DataPay Refund MP Error] Falha ao estornar no Mercado Pago:', mpErr.message);
        return NextResponse.json(
          { error: `O Mercado Pago recusou o reembolso: ${mpErr.message}` },
          { status: 422 }
        );
      }
    }

    // 3. Atualiza o status do pagamento para 'Reembolsado'
    const paidAmount = Number(targetPayment.amount);
    const debtId = targetPayment.debtId;

    payments = payments.map((p: any) => {
      if (p.id === paymentId) {
        return {
          ...p,
          status: 'Reembolsado',
          refundedDate: new Date().toISOString()
        };
      }
      return p;
    });

    // 4. Devolve o saldo e restaura a parcela na dívida correspondente
    let debtName = targetPayment.debtName || 'Dívida';
    debts = debts.map((d: any) => {
      if (d.id === debtId) {
        debtName = d.name;
        const currentBalance = Number(d.currentBalance) || 0;
        const newBalance = currentBalance + paidAmount;
        const remainingInstallments = (Number(d.remainingInstallments) || 0) + 1;
        return {
          ...d,
          currentBalance: newBalance,
          remainingInstallments: remainingInstallments,
          status: 'active'
        };
      }
      return d;
    });

    // 5. Ajusta o saldo da Reserva Inteligente se tiver sido depositado lá
    if (rawTxId) {
      const reserveDepositDescription = `Reserva Pix Mercado Pago (Lote #${rawTxId})`;
      const foundDeposit = reserve.history.some((h: any) => h.description.includes(rawTxId) || h.description === reserveDepositDescription);
      
      if (foundDeposit) {
        reserve.currentBalance = Math.max(0, reserve.currentBalance - paidAmount);
        reserve.history.unshift({
          id: `w_refund_${Date.now()}`,
          type: 'withdraw',
          amount: paidAmount,
          description: `Estorno/Reembolso de pagamento (ID: ${paymentId})`,
          date: new Date().toISOString()
        });
      }
    }

    // 6. Notifica o usuário sobre o reembolso efetuado
    notifications.unshift({
      id: `n_refund_${Date.now()}`,
      userId,
      title: 'Pagamento Reembolsado',
      content: `O valor de R$ ${paidAmount.toLocaleString('pt-BR')} para a dívida "${debtName}" foi estornado com sucesso. A dívida foi reaberta.`,
      type: 'info',
      date: new Date().toISOString(),
      read: false
    });

    // 7. Grava as alterações na coleção Finanças do MongoDB
    await db.collection('Finanças').updateOne(
      { userId },
      { $set: { debts, payments, notifications, reserve } }
    );

    // 8. Se houver registro na coleção Transactions, atualiza para Reembolsado
    if (rawTxId) {
      try {
        await db.collection('Transactions').updateOne(
          { id: rawTxId },
          { $set: { status: 'Reembolsado', updatedAt: new Date().toISOString() } }
        );
      } catch (err) {}
    }

    console.log(`[DataPay Refund] Processo de reembolso concluído com sucesso para o usuário ${userId}.`);

    return NextResponse.json({
      success: true,
      message: 'Pagamento reembolsado com sucesso!'
    });

  } catch (error: any) {
    console.error('[DataPay Refund Error]:', error.message);
    return NextResponse.json(
      { error: 'Erro interno ao processar reembolso.', details: error.message },
      { status: 500 }
    );
  }
}
