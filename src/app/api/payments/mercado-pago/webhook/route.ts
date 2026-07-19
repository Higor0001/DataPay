import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { connectToDatabase } from '@/utils/mongodb';

// Busca a mesma referência de memória global para obter as transações ativas
const globalTransactions = (global as any).paymentTransactions || new Map();
(global as any).paymentTransactions = globalTransactions;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('[DataPay Webhook] Notificação recebida do Mercado Pago:', JSON.stringify(payload));

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    
    // Mercado Pago pode enviar o ID de diferentes formas dependendo da API
    let paymentId = payload.data?.id || payload.id;

    if (!paymentId) {
      return NextResponse.json(
        { error: 'ID de transação ausente na notificação.' },
        { status: 400 }
      );
    }

    const transactionId = String(paymentId);

    // 1. SUPORTE PARA O SIMULADOR DO SANDBOX LOCAL (OFFLINE / DEV)
    if (transactionId.startsWith('sandbox_mp_') || payload.simulated) {
      console.log(`[DataPay Webhook] Processando simulação local para ID: ${transactionId}...`);
      
      const transaction = globalTransactions.get(transactionId);
      if (transaction) {
        transaction.status = 'Pago';
        transaction.updatedAt = new Date().toISOString();
        globalTransactions.set(transactionId, transaction);
        
        console.log(`[DataPay Webhook] Transação Sandbox ${transactionId} confirmada como PAGO.`);
        
        // Atualiza banco de dados do MongoDB
        updateMongoDBTransaction(transactionId, transaction);

        return NextResponse.json({ success: true, message: 'Simulação de pagamento confirmada.' });
      }
      return NextResponse.json({ error: 'Simulação: Transação Sandbox não encontrada na memória.' }, { status: 404 });
    }

    // 2. INTEGRAÇÃO COM PRODUÇÃO REAL (MERCADO PAGO API via SDK Oficial)
    if (!token) {
      return NextResponse.json(
        { error: 'Chave MERCADO_PAGO_ACCESS_TOKEN não configurada para processar notificações reais.' },
        { status: 400 }
      );
    }

    console.log(`[DataPay Webhook] Consultando pagamento real ${transactionId} via SDK no Mercado Pago...`);
    
    // Instancia o cliente da API do Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);
    
    const mpData = await paymentClient.get({ id: transactionId });
    const mpStatus = mpData.status; // pending | approved | cancelled | rejected

    console.log(`[DataPay Webhook] Retorno do status do pagamento real via SDK: ${mpStatus}`);

    const transaction = globalTransactions.get(transactionId);
    if (transaction) {
      if (mpStatus === 'approved') {
        transaction.status = 'Pago';
        // Atualiza banco de dados do MongoDB
        updateMongoDBTransaction(transactionId, transaction);
      } else if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
        transaction.status = 'Cancelado';
      }
      transaction.updatedAt = new Date().toISOString();
      globalTransactions.set(transactionId, transaction);
      console.log(`[DataPay Webhook] Transação real ${transactionId} atualizada para: ${transaction.status}`);
    } else {
      console.warn(`[DataPay Webhook] ID de transação ${transactionId} não encontrado no mapa local.`);
    }

    return NextResponse.json({
      success: true,
      mpStatus
    });
  } catch (error: any) {
    console.error('[DataPay Webhook Error] Erro ao tratar notificação:', error.message);
    return NextResponse.json(
      { error: 'Erro ao processar notificação.', details: error.message },
      { status: 500 }
    );
  }
}

// Sincroniza em lote a confirmação de pagamento com o MongoDB em segundo plano
async function updateMongoDBTransaction(transactionId: string, transaction: any) {
  const mongodbUri = process.env.MONGODB_URI;

  if (!mongodbUri || !transaction || !transaction.debts || transaction.debts.length === 0) {
    console.log('[DataPay Webhook] MongoDB URI não configurada ou transação sem dívidas vinculadas.');
    return;
  }

  try {
    console.log(`[DataPay Webhook] Conectando ao MongoDB para atualizar transação: ${transactionId}...`);
    const { db } = await connectToDatabase();

    // Encontra a primeira dívida vinculada à transação para obter o userId do proprietário
    const firstDebt = await db.collection('debts').findOne({ id: transaction.debts[0].debtId });
    if (!firstDebt) {
      throw new Error(`Dívida ${transaction.debts[0].debtId} não encontrada nas coleções do MongoDB.`);
    }

    const userId = firstDebt.userId;

    for (const item of transaction.debts) {
      const debtId = item.debtId;
      const paidAmount = Number(item.amount);

      // 1. Obter dados atuais da dívida
      const dbDebt = await db.collection('debts').findOne({ id: debtId });
      const currentBalance = dbDebt ? Number(dbDebt.currentBalance) : 0;
      const newBalance = Math.max(0, currentBalance - paidAmount);
      const status = newBalance <= 0 ? 'paid' : 'active';
      const remainingInstallments = dbDebt && dbDebt.remainingInstallments ? Math.max(0, dbDebt.remainingInstallments - 1) : 0;

      console.log(`[DataPay Webhook] Dívida ${debtId}: Novo saldo R$ ${newBalance} (Status: ${status})`);

      // 2. Atualizar o saldo da Dívida no banco
      await db.collection('debts').updateOne(
        { id: debtId },
        { 
          $set: { 
            currentBalance: newBalance,
            status: status,
            remainingInstallments: remainingInstallments
          } 
        }
      );

      // 3. Registrar o Pagamento na coleção 'payments'
      const paymentId = `p_mp_${transactionId}_${debtId}`;
      await db.collection('payments').updateOne(
        { id: paymentId },
        {
          $set: {
            id: paymentId,
            userId,
            debtId,
            amount: paidAmount,
            dueDate: new Date().toISOString().split('T')[0],
            paidDate: new Date().toISOString(),
            status: 'Pago',
            method: 'Pix',
            type: 'Parcela'
          }
        },
        { upsert: true }
      );

      // 4. Emitir Notificação interna de sucesso
      const notificationId = `n_mp_${transactionId}_${debtId}`;
      await db.collection('notifications').updateOne(
        { id: notificationId },
        {
          $set: {
            id: notificationId,
            userId,
            title: 'Pagamento Confirmado',
            content: `Seu pagamento Pix de R$ ${paidAmount.toLocaleString('pt-BR')} para a dívida ${dbDebt ? dbDebt.name : ''} foi compensado com sucesso!`,
            type: 'success',
            read: false,
            date: new Date().toISOString().split('T')[0]
          }
        },
        { upsert: true }
      );
    }
    console.log('[DataPay Webhook] Atualização no MongoDB concluída com sucesso!');
  } catch (mongoErr: any) {
    console.error('[DataPay Webhook MongoDB Error]:', mongoErr.message);
  }
}
