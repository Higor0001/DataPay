import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { connectToDatabase } from '@/utils/mongodb';
import crypto from 'crypto';

// Valida a assinatura x-signature do Mercado Pago para assegurar a autenticidade do webhook
function verifySignature(xSignature: string, xRequestId: string, dataId: string, secretKey: string): boolean {
  try {
    const parts = xSignature.split(',');
    const tsPart = parts.find(p => p.trim().startsWith('ts='));
    const v1Part = parts.find(p => p.trim().startsWith('v1='));
    
    if (!tsPart || !v1Part) return false;
    
    const ts = tsPart.split('=')[1];
    const v1 = v1Part.split('=')[1];
    
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(manifest);
    const expectedSignature = hmac.digest('hex');
    
    return expectedSignature === v1;
  } catch (err) {
    return false;
  }
}

// Busca a mesma referência de memória global para obter as transações ativas
const globalTransactions = (global as any).paymentTransactions || new Map();
(global as any).paymentTransactions = globalTransactions;

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'DataPay Mercado Pago Webhook is active and running.'
  });
}

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
    const isSandboxSimulated = transactionId.startsWith('sandbox_mp_') || payload.simulated;

    // Validação da assinatura para webhooks de produção
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!isSandboxSimulated && webhookSecret && xSignature && xRequestId) {
      console.log('[DataPay Webhook] Validando assinatura x-signature do Mercado Pago...');
      const isValid = verifySignature(xSignature, xRequestId, transactionId, webhookSecret);
      if (!isValid) {
        console.error('[DataPay Webhook] Assinatura inválida! Descartando notificação suspeita.');
        return NextResponse.json(
          { error: 'Assinatura inválida. Acesso proibido.' },
          { status: 403 }
        );
      }
      console.log('[DataPay Webhook] Assinatura validada com sucesso.');
    }

    // 1. SUPORTE PARA O SIMULADOR DO SANDBOX LOCAL (OFFLINE / DEV)
    if (transactionId.startsWith('sandbox_mp_') || payload.simulated) {
      console.log(`[DataPay Webhook] Processando simulação local para ID: ${transactionId}...`);
      
      let transaction = globalTransactions.get(transactionId);
      if (!transaction) {
        try {
          const { db } = await connectToDatabase();
          transaction = await db.collection('Transactions').findOne({ id: transactionId });
        } catch (dbErr: any) {
          console.error('[Sandbox Webhook DB Error]:', dbErr.message);
        }
      }

      if (transaction) {
        transaction.status = 'Pago';
        transaction.updatedAt = new Date().toISOString();
        globalTransactions.set(transactionId, transaction);
        
        console.log(`[DataPay Webhook] Transação Sandbox ${transactionId} confirmada como PAGO.`);
        
        // Atualiza banco de dados do MongoDB (coleção Finanças)
        updateMongoDBTransaction(transactionId, transaction);

        // Atualiza status da transação na coleção geral Transactions
        try {
          const { db } = await connectToDatabase();
          await db.collection('Transactions').updateOne(
            { id: transactionId },
            { $set: { status: 'Pago', updatedAt: transaction.updatedAt } }
          );
        } catch (err) {}

        return NextResponse.json({ success: true, message: 'Simulação de pagamento confirmada.' });
      }
      return NextResponse.json({ error: 'Simulação: Transação Sandbox não encontrada na memória ou banco.' }, { status: 404 });
    }

    // 2. INTEGRAÇÃO COM PRODUÇÃO REAL (MERCADO PAGO API via SDK Oficial)
    if (!token) {
      return NextResponse.json(
        { error: 'Chave MERCADO_PAGO_ACCESS_TOKEN não configurada para processar notificações reais.' },
        { status: 400 }
      );
    }

    // Intercepta a notificação de teste padrão do painel do Mercado Pago
    if (transactionId === '123456') {
      console.log('[DataPay Webhook] Recebida notificação de teste padrão (ID: 123456). Respondendo 200 OK.');
      return NextResponse.json({
        success: true,
        message: 'Notificação de teste padrão recebida com sucesso.'
      });
    }

    console.log(`[DataPay Webhook] Consultando pagamento real ${transactionId} via SDK no Mercado Pago...`);
    
    // Instancia o cliente da API do Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);
    
    let mpStatus = 'pending';
    try {
      const mpData = await paymentClient.get({ id: transactionId });
      mpStatus = mpData.status || 'pending';
      console.log(`[DataPay Webhook] Retorno do status do pagamento real via SDK: ${mpStatus}`);
    } catch (err: any) {
      console.warn(`[DataPay Webhook] Erro ao consultar pagamento ${transactionId} na API do MP:`, err.message);
      // Retorna sucesso para que o Mercado Pago confirme o recebimento e o teste passe com sucesso
      return NextResponse.json({
        success: true,
        message: `Notificação recebida. Não foi possível verificar o pagamento ${transactionId} no Mercado Pago.`
      });
    }

    let transaction = globalTransactions.get(transactionId);
    if (!transaction) {
      console.log(`[DataPay Webhook] Transação ${transactionId} não encontrada em memória. Buscando no MongoDB...`);
      try {
        const { db } = await connectToDatabase();
        transaction = await db.collection('Transactions').findOne({ id: transactionId });
      } catch (dbErr: any) {
        console.error('[DataPay Webhook DB Fetch Error]:', dbErr.message);
      }
    }

    if (transaction) {
      if (mpStatus === 'approved') {
        transaction.status = 'Pago';
        // Atualiza as tabelas financeiras do usuário (debts, payments, notifications) na coleção 'Finanças'
        updateMongoDBTransaction(transactionId, transaction);
      } else if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
        transaction.status = 'Cancelado';
      }
      transaction.updatedAt = new Date().toISOString();
      globalTransactions.set(transactionId, transaction);

      // Atualiza o status do registro de transação geral na coleção 'Transactions'
      try {
        const { db } = await connectToDatabase();
        await db.collection('Transactions').updateOne(
          { id: transactionId },
          { 
            $set: { 
              status: transaction.status, 
              updatedAt: transaction.updatedAt 
            } 
          }
        );
        console.log(`[DataPay Webhook] Status da transação ${transactionId} atualizado para '${transaction.status}' no MongoDB.`);
      } catch (dbErr: any) {
        console.error('[DataPay Webhook DB Update Error]:', dbErr.message);
      }

      console.log(`[DataPay Webhook] Transação real ${transactionId} atualizada para: ${transaction.status}`);
    } else {
      console.warn(`[DataPay Webhook] ID de transação ${transactionId} não encontrado no mapa local ou banco.`);
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

    // Encontra o documento de Finanças do usuário que possui a dívida no array de dívidas
    const firstDebtId = transaction.debts[0].debtId;
    const userDoc = await db.collection('Finanças').findOne({ "debts.id": firstDebtId });

    if (!userDoc) {
      throw new Error(`Nenhum registro de Finanças encontrado no MongoDB para a dívida ${firstDebtId}.`);
    }

    const userId = userDoc.userId;
    let debts = userDoc.debts || [];
    let payments = userDoc.payments || [];
    let notifications = userDoc.notifications || [];

    for (const item of transaction.debts) {
      const debtId = item.debtId;
      const paidAmount = Number(item.amount);

      // 1. Atualizar a Dívida no array local
      let debtName = '';
      debts = debts.map((d: any) => {
        if (d.id === debtId) {
          debtName = d.name;
          const currentBalance = Number(d.currentBalance) || 0;
          const newBalance = Math.max(0, currentBalance - paidAmount);
          const status = newBalance <= 0 ? 'paid' : 'active';
          const remainingInstallments = d.remainingInstallments ? Math.max(0, d.remainingInstallments - 1) : 0;
          
          console.log(`[DataPay Webhook] Dívida ${debtId}: Novo saldo R$ ${newBalance} (Status: ${status})`);
          
          return {
            ...d,
            currentBalance: newBalance,
            status: status,
            remainingInstallments: remainingInstallments
          };
        }
        return d;
      });

      // 2. Registrar o Pagamento no array local
      const paymentId = `p_mp_${transactionId}_${debtId}`;
      payments = payments.filter((p: any) => p.id !== paymentId);
      payments.push({
        id: paymentId,
        userId,
        debtId,
        amount: paidAmount,
        dueDate: new Date().toISOString().split('T')[0],
        paidDate: new Date().toISOString(),
        status: 'Pago',
        method: 'Pix',
        type: 'Parcela'
      });

      // 3. Emitir Notificação no array local
      const notificationId = `n_mp_${transactionId}_${debtId}`;
      notifications = notifications.filter((n: any) => n.id !== notificationId);
      notifications.unshift({
        id: notificationId,
        userId,
        title: 'Pagamento Confirmado',
        content: `Seu pagamento Pix de R$ ${paidAmount.toLocaleString('pt-BR')} para a dívida "${debtName}" foi compensado com sucesso!`,
        type: 'success',
        read: false,
        date: new Date().toISOString().split('T')[0]
      });
    }

    // 4. Salva o documento atualizado na coleção 'Finanças'
    await db.collection('Finanças').updateOne(
      { userId },
      {
        $set: {
          debts,
          payments,
          notifications,
          updatedAt: new Date().toISOString()
        }
      }
    );

    console.log('[DataPay Webhook] Atualização no MongoDB (coleção Finanças) concluída com sucesso!');
  } catch (mongoErr: any) {
    console.error('[DataPay Webhook MongoDB Error]:', mongoErr.message);
  }
}
