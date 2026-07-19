import { NextRequest, NextResponse } from 'next/server';
import { PaymentProviderFactory } from '../../../../../utils/paymentProviders';
import { connectToDatabase } from '@/utils/mongodb';

// Armazenamento em memória síncrono para desenvolvimento/simulação
const globalTransactions = (global as any).paymentTransactions || new Map();
(global as any).paymentTransactions = globalTransactions;

export async function POST(req: NextRequest) {
  try {
    const { amount, debts, email } = await req.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Valor total inválido.' },
        { status: 400 }
      );
    }

    if (!debts || !Array.isArray(debts) || debts.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma dívida foi informada para o pagamento em lote.' },
        { status: 400 }
      );
    }

    console.log(`[DataPay API] Gerando Pix para pagamento em lote de R$ ${amount.toFixed(2)} (${debts.length} dívidas, Email: ${email})...`);

    // Fábrica resolve o provedor correto (Mercado Pago ou Sandbox)
    const provider = PaymentProviderFactory.getProvider();
    const description = `Reserva para quitação de ${debts.length} dúvida(s) - DataPay`;
    const pix = await provider.createPix(amount, description, email);

    // Registra a transação no servidor como Pendente
    const transaction = {
      id: pix.id,
      amount,
      debts,
      status: 'Pendente',
      qrCodeBase64: pix.qrCodeBase64,
      qrCodeCopyPaste: pix.qrCodeCopyPaste,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    globalTransactions.set(pix.id, transaction);

    // Persiste a transação no MongoDB para durabilidade (serverless/Vercel)
    try {
      const { db } = await connectToDatabase();
      await db.collection('Transactions').insertOne({ ...transaction });
      console.log(`[DataPay API] Transação ${pix.id} persistida no MongoDB.`);
    } catch (dbErr: any) {
      console.error('[DataPay API DB Error] Falha ao persistir transação no MongoDB:', dbErr.message);
    }

    return NextResponse.json({
      success: true,
      transaction
    });
  } catch (error: any) {
    console.error('[DataPay API Error] Falha ao criar pagamento Pix:', error.message);
    
    // Grava um log detalhado para análise em scratch/mp_error.log
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(process.cwd(), 'scratch');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logPath = path.join(logDir, 'mp_error.log');
      const logData = {
        timestamp: new Date().toISOString(),
        errorMessage: error.message,
        errorStack: error.stack,
        rawError: JSON.parse(JSON.stringify(error)),
        tokenUsed: process.env.MERCADO_PAGO_ACCESS_TOKEN ? process.env.MERCADO_PAGO_ACCESS_TOKEN.substring(0, 20) + '...' : 'none'
      };
      fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf8');
      console.log(`[DataPay API] Log de erro gravado com sucesso em: ${logPath}`);
    } catch (logErr: any) {
      console.error('Falha ao escrever log de erro:', logErr.message);
    }

    let userFriendlyError = 'Falha ao gerar cobrança Pix pelo Mercado Pago.';
    const errMsgLower = error.message.toLowerCase();
    
    if (errMsgLower.includes('live credentials') || errMsgLower.includes('unauthorized use of live')) {
      userFriendlyError = 'Uso de credenciais de produção não autorizado na sandbox. O Mercado Pago exige o uso de um comprador de testes para homologar chaves de teste. Por favor, crie uma "Conta de teste" de comprador no seu Painel de Desenvolvedores e use o e-mail gerado (@testuser.com) para gerar o Pix.';
    } else if (
      errMsgLower.includes('authorization') || 
      errMsgLower.includes('unauthorized') || 
      errMsgLower.includes('token') || 
      errMsgLower.includes('401')
    ) {
      userFriendlyError = 'O Token do Mercado Pago fornecido é inválido ou expirado. Certifique-se de usar o Access Token correto (começa com APP_USR- e é um código longo) no arquivo .env e reinicie o servidor local.';
    }

    return NextResponse.json(
      { error: userFriendlyError, details: error.message },
      { status: 550 }
    );
  }
}
