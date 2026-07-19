import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

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
        
        // Atualiza banco de dados do Supabase
        updateSupabaseTransaction(transactionId, transaction);

        return NextResponse.json({ success: true, message: 'Simulação de pagamento confirmada.' });
      }
      return NextResponse.json({ error: 'Transação Sandbox não encontrada na memória.' }, { status: 404 });
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
        // Atualiza banco de dados do Supabase
        updateSupabaseTransaction(transactionId, transaction);
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

// Converte IDs offline para o formato UUID esperado pelo PostgreSQL
function toUUID(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;

  let clean = id.replace(/[^a-f0-9]/gi, '');
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  const padded = (clean + hashHex + '00000000000000000000000000000000').substring(0, 32);
  
  return `${padded.substring(0, 8)}-${padded.substring(8, 12)}-${padded.substring(12, 16)}-${padded.substring(16, 20)}-${padded.substring(20, 32)}`;
}

// Sincroniza em lote a confirmação com o banco Supabase em segundo plano
async function updateSupabaseTransaction(transactionId: string, transaction: any) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecret || !transaction || !transaction.debts || transaction.debts.length === 0) {
    console.log('[DataPay Webhook] Supabase não configurado ou transação sem dívidas vinculadas.');
    return;
  }

  try {
    console.log(`[DataPay Webhook] Atualizando dados no Supabase para transação: ${transactionId}...`);
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseSecret);

    // Encontra o user_id da primeira dívida para vincular o pagamento
    const firstDebtId = toUUID(transaction.debts[0].debtId);
    const { data: debtData, error: dbErr } = await supabase
      .from('debts')
      .select('user_id')
      .eq('id', firstDebtId)
      .single();

    if (dbErr || !debtData) {
      throw new Error('Não foi possível obter o user_id da dívida no banco: ' + (dbErr?.message || 'não encontrado'));
    }

    const userId = debtData.user_id;

    for (const item of transaction.debts) {
      const debtUuid = toUUID(item.debtId);
      const paidAmount = Number(item.amount);

      // 1. Obter dívida atual
      const { data: dbDebt } = await supabase
        .from('debts')
        .select('current_balance, remaining_installments, name')
        .eq('id', debtUuid)
        .single();

      const currentBalance = dbDebt ? Number(dbDebt.current_balance) : 0;
      const newBalance = Math.max(0, currentBalance - paidAmount);
      const status = newBalance <= 0 ? 'paid' : 'active';

      console.log(`[DataPay Webhook] Dívida ${debtUuid}: Novo saldo R$ ${newBalance} (Status: ${status})`);

      // 2. Atualizar Dívida
      const { error: updateErr } = await supabase
        .from('debts')
        .update({
          current_balance: newBalance,
          status: status,
          remaining_installments: dbDebt && dbDebt.remaining_installments ? Math.max(0, dbDebt.remaining_installments - 1) : 0
        })
        .eq('id', debtUuid);
      
      if (updateErr) throw updateErr;

      // 3. Registrar Pagamento
      const paymentId = toUUID(`p_mp_${transactionId}_${item.debtId}`);
      const { error: payErr } = await supabase
        .from('payments')
        .upsert({
          id: paymentId,
          user_id: userId,
          debt_id: debtUuid,
          amount: paidAmount,
          due_date: new Date().toISOString().split('T')[0],
          paid_date: new Date().toISOString(),
          status: 'Pago',
          method: 'Pix',
          type: 'Parcela'
        });

      if (payErr) throw payErr;

      // 4. Emitir Notificação no Banco de Dados
      const notificationId = toUUID(`n_mp_${transactionId}_${item.debtId}`);
      const { error: notifErr } = await supabase
        .from('notifications')
        .upsert({
          id: notificationId,
          user_id: userId,
          title: 'Pagamento Confirmado',
          content: `Seu pagamento Pix de R$ ${paidAmount.toLocaleString('pt-BR')} para a dívida ${dbDebt ? dbDebt.name : ''} foi compensado com sucesso!`,
          type: 'success',
          read: false,
          date: new Date().toISOString().split('T')[0]
        });

      if (notifErr) throw notifErr;
    }
    console.log('[DataPay Webhook] Atualização no Supabase concluída com sucesso!');
  } catch (sbErr: any) {
    console.error('[DataPay Webhook Supabase Error]:', sbErr.message);
  }
}
