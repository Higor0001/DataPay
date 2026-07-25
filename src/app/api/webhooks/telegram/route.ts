import { NextResponse } from 'next/server';
import { decodeEMVPix } from '../../../../utils/emvPixParser';
import { connectToDatabase } from '../../../../utils/mongodb';
import { getPixCopyPasteCode } from '../../../../utils/qrCode';

// Memory map for user Telegram pending debt selections (chatId -> debtId)
declare global {
  var telegramPendingDebtSelections: Map<number | string, { debtId: string; debtName: string; amount: number }>;
}

if (!globalThis.telegramPendingDebtSelections) {
  globalThis.telegramPendingDebtSelections = new Map();
}

// Helper to fetch user debts from 'Finanças' collection with automatic fallback
async function getStoredDebts(db: any) {
  let doc = await db.collection('Finanças').findOne({ userId: 'default_user' });
  if (!doc) {
    doc = await db.collection('Finanças').findOne({});
  }

  let debtsList: any[] = doc?.debts || [];

  // Se não houver dívidas salvas no banco, inicializa dívidas padrão para teste imediato
  if (!debtsList || debtsList.length === 0) {
    debtsList = [
      {
        id: 'debt_itau_1',
        name: 'Empréstimo Itaú Unibanco',
        bank: 'Itaú',
        installmentValue: 450.00,
        currentBalance: 4500.00,
        remainingInstallments: 10,
        totalInstallments: 12,
        status: 'active'
      },
      {
        id: 'debt_nubank_2',
        name: 'Fatura Cartão Nubank',
        bank: 'Nubank',
        installmentValue: 320.50,
        currentBalance: 320.50,
        remainingInstallments: 1,
        totalInstallments: 1,
        status: 'active'
      },
      {
        id: 'debt_bradesco_3',
        name: 'Financiamento Bradesco',
        bank: 'Bradesco',
        installmentValue: 890.00,
        currentBalance: 8900.00,
        remainingInstallments: 10,
        totalInstallments: 12,
        status: 'active'
      }
    ];

    try {
      await db.collection('Finanças').updateOne(
        { userId: 'default_user' },
        { $set: { userId: 'default_user', debts: debtsList, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
    } catch (e: any) {
      console.warn('[Telegram DB Init Error]:', e.message);
    }
  }

  return { doc, debtsList };
}

// Helper to send message back to Telegram Chat with optional Inline Keyboards
async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: any,
  parseMode: string = 'Markdown'
) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: parseMode
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err: any) {
    console.error('[Telegram Bot Send Error]:', err.message);
  }
}

// Helper to answer Telegram callback query (button clicks)
async function answerTelegramCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || 'Processado com sucesso!'
      })
    });
  } catch (err: any) {
    console.error('[Telegram Callback Error]:', err.message);
  }
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const body = await req.json().catch(() => ({}));

    // ------------------------------------------------------------------------
    // A. PROCESSAMENTO DE CALLBACK QUERIES (Cliques em Botões Interativos)
    // ------------------------------------------------------------------------
    if (body.callback_query) {
      const cb = body.callback_query;
      const callbackId = cb.id;
      const chatId = cb.message?.chat?.id;
      const cbData: string = cb.data || '';

      console.log(`[Telegram Callback] Clique em botão de chat_id=${chatId}: data="${cbData}"`);

      // 1. Seleção de Dívida: pay_debt_<debtId>
      if (cbData.startsWith('pay_debt_')) {
        const debtId = cbData.replace('pay_debt_', '');

        try {
          const { db } = await connectToDatabase();
          const { debtsList } = await getStoredDebts(db);
          const targetDebt = debtsList.find((d: any) => d.id === debtId);

          if (targetDebt) {
            const amount = targetDebt.installmentValue || targetDebt.currentBalance || 100;
            globalThis.telegramPendingDebtSelections.set(chatId, {
              debtId: targetDebt.id,
              debtName: targetDebt.name,
              amount
            });

            await answerTelegramCallbackQuery(botToken, callbackId, `Dívida "${targetDebt.name}" selecionada!`);

            const promptMsg = `🎯 *Dívida Selecionada: ${targetDebt.name}* (${targetDebt.bank})

💰 *Valor da Parcela:* R$ ${amount.toFixed(2)}
📉 *Saldo Restante:* R$ ${(targetDebt.currentBalance || 0).toFixed(2)}

📲 *Próximo Passo:*
Envie ou cole agora a *Chave Pix* ou o código *Pix Copia e Cola (\`000201...\`)* para quitar esta parcela!`;

            if (botToken) await sendTelegramMessage(botToken, chatId, promptMsg);
          } else {
            await answerTelegramCallbackQuery(botToken, callbackId, 'Dívida não encontrada.');
          }
        } catch (err: any) {
          await answerTelegramCallbackQuery(botToken, callbackId, 'Erro ao carregar dívida.');
        }

        return NextResponse.json({ ok: true });
      }

      // 2. Confirmação de Quitação: confirm_pay_<debtId>_<amount>
      if (cbData.startsWith('confirm_pay_')) {
        const parts = cbData.replace('confirm_pay_', '').split('_');
        const debtId = parts[0];
        const amount = parseFloat(parts[1]) || 0;

        try {
          const { db } = await connectToDatabase();
          const { doc, debtsList } = await getStoredDebts(db);
          let updatedDebts: any[] = debtsList || [];
          let paymentsList: any[] = doc?.payments || [];

          const targetDebt = updatedDebts.find((d: any) => d.id === debtId);

          if (targetDebt && amount > 0) {
            // Atualiza saldo e parcelas no MongoDB (Coleção 'Finanças')
            const updatedRemaining = Math.max(0, (targetDebt.remainingInstallments || 1) - 1);
            const updatedBalance = Math.max(0, (targetDebt.currentBalance || amount) - amount);
            const newStatus = updatedBalance <= 0 || updatedRemaining === 0 ? 'paid' : 'active';

            updatedDebts = updatedDebts.map((d: any) =>
              d.id === debtId
                ? {
                    ...d,
                    currentBalance: updatedBalance,
                    remainingInstallments: updatedRemaining,
                    status: newStatus
                  }
                : d
            );

            // Adiciona comprovante em pagamentos
            const newPayment = {
              id: `p_tg_${Date.now()}`,
              debtId: targetDebt.id,
              debtName: targetDebt.name,
              bankName: targetDebt.bank,
              amount,
              paidDate: new Date().toISOString().split('T')[0],
              status: 'Pago',
              method: 'Pix',
              createdAt: new Date().toISOString()
            };
            paymentsList.unshift(newPayment);

            await db.collection('Finanças').updateOne(
              { userId: 'default_user' },
              { $set: { userId: 'default_user', debts: updatedDebts, payments: paymentsList, updatedAt: new Date().toISOString() } },
              { upsert: true }
            );

            await answerTelegramCallbackQuery(botToken, callbackId, '✅ Parcela quitada no DataPay!');

            const receiptMsg = `🎉 *PAGAMENTO CONFIRMADO E QUITADO!*

💳 *Dívida:* ${targetDebt.name} (${targetDebt.bank})
💰 *Valor Pago:* R$ ${amount.toFixed(2)}
📉 *Novo Saldo Devedor:* R$ ${updatedBalance.toFixed(2)}
📊 *Parcelas Restantes:* ${updatedRemaining}

✅ A baixa da parcela foi registrada automaticamente no DataPay!`;

            if (botToken) await sendTelegramMessage(botToken, chatId, receiptMsg);
            globalThis.telegramPendingDebtSelections.delete(chatId);
          } else {
            await answerTelegramCallbackQuery(botToken, callbackId, 'Não foi possível quitar a parcela.');
          }
        } catch (err: any) {
          console.error('[Telegram Confirm Pay Error]:', err);
          await answerTelegramCallbackQuery(botToken, callbackId, 'Erro ao registrar quitação.');
        }

        return NextResponse.json({ ok: true });
      }

      await answerTelegramCallbackQuery(botToken, callbackId);
      return NextResponse.json({ ok: true });
    }

    // ------------------------------------------------------------------------
    // B. PROCESSAMENTO DE MENSAGENS NORMAIS E COMANDOS
    // ------------------------------------------------------------------------
    const message = body.message || body.edited_message;
    if (!message || !message.chat || !message.chat.id) {
      return NextResponse.json({ ok: true, note: 'No message to process' });
    }

    const chatId = message.chat.id;
    const text: string = (message.text || '').trim();

    if (!text) {
      return NextResponse.json({ ok: true });
    }

    console.log(`[Telegram Webhook] Mensagem de chat_id=${chatId}: "${text.substring(0, 50)}"`);

    // 1. Comando /start ou /ajuda
    if (text.startsWith('/start') || text.startsWith('/ajuda') || text.startsWith('/help')) {
      const helpMsg = `🤖 *Central Pix & DataPay Bot*

Selecione uma dívida para vincular uma Chave Pix ou use os comandos abaixo:

📌 *Comandos Disponíveis:*
• \`/dividas\` — Lista dívidas ativas para selecionar e atrelar Chaves Pix.
• \`/pix <chave_ou_copia_cola>\` — Cadastra e analisa Pix via IA.
• \`/pagar <valor> <recebedor>\` — Gera um Pix instantâneo para pagamento.
• \`/saldos\` — Consulta saldos das suas contas no Pierre Open Finance.
• \`/ajuda\` — Exibe este menu.`;

      if (botToken) await sendTelegramMessage(botToken, chatId, helpMsg);
      return NextResponse.json({ ok: true });
    }

    // 2. Comando /dividas ou /pagar_divida (Com Botões Interativos para Selecionar)
    if (text.startsWith('/dividas') || text.startsWith('/divida')) {
      try {
        const { db } = await connectToDatabase();
        const { debtsList } = await getStoredDebts(db);
        const activeDebts = debtsList.filter((d: any) => d.status !== 'paid');

        if (activeDebts.length === 0) {
          if (botToken) await sendTelegramMessage(botToken, chatId, `🎉 *Parabéns!* Você não possui nenhuma dívida ativa pendente no momento.`);
          return NextResponse.json({ ok: true });
        }

        let msgText = `📋 *Selecione a Dívida para Vincular o Pix:*\n\nClique no botão da dívida que você deseja quitar ou pagar a parcela:`;

        const keyboardButtons = activeDebts.map((d: any) => {
          const val = d.installmentValue || d.currentBalance || 0;
          return [
            {
              text: `💳 ${d.name} (${d.bank}) — R$ ${val.toFixed(2)}`,
              callback_data: `pay_debt_${d.id}`
            }
          ];
        });

        const replyMarkup = { inline_keyboard: keyboardButtons };
        if (botToken) await sendTelegramMessage(botToken, chatId, msgText, replyMarkup);
      } catch (err: any) {
        console.error('[Telegram /dividas Error]:', err);
        if (botToken) await sendTelegramMessage(botToken, chatId, `⚠️ Erro ao consultar dívidas no DataPay.`);
      }

      return NextResponse.json({ ok: true });
    }

    // 3. Comando /saldos (Pierre Open Finance)
    if (text.startsWith('/saldos') || text.startsWith('/saldo')) {
      let saldoMsg = `🏦 *Saldos Open Finance (Pierre API)*\n\n`;
      try {
        const apiKey = process.env.PIERRE_API_KEY || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;

        const res = await fetch('https://pierre.finance/tools/api/get-accounts', { headers });
        const resData = await res.json();

        if (resData.success && Array.isArray(resData.data)) {
          let total = 0;
          resData.data.forEach((acc: any) => {
            const b = typeof acc.balance === 'string' ? parseFloat(acc.balance) : (acc.balance || 0);
            total += b;
            const bankName = acc.connectorName || acc.brandName || acc.name;
            saldoMsg += `• *${bankName}* (${acc.subtype || acc.type}): R$ ${b.toFixed(2)}\n`;
          });
          saldoMsg += `\n💰 *Total Consolidado:* R$ ${total.toFixed(2)}`;
        } else {
          saldoMsg += `Nenhuma conta retornada pela API.`;
        }
      } catch (err: any) {
        saldoMsg += `Erro ao consultar saldos: ${err.message}`;
      }

      if (botToken) await sendTelegramMessage(botToken, chatId, saldoMsg);
      return NextResponse.json({ ok: true });
    }

    // 4. Recebimento de Chave Pix ou Payload EMV (Se houver seleção de dívida pendente ou envio direto)
    const pendingSelection = globalThis.telegramPendingDebtSelections.get(chatId);
    let pixCodeToParse = text.startsWith('/pix') ? text.replace('/pix', '').trim() : text;

    const isEMVCode = pixCodeToParse.includes('000201') || pixCodeToParse.length > 25;

    if (isEMVCode || pendingSelection) {
      const match = pixCodeToParse.match(/000201[0-9a-zA-Z]+/);
      const cleanCode = match ? match[0] : (isEMVCode ? pixCodeToParse : getPixCopyPasteCode(pendingSelection?.amount || 100, pendingSelection?.debtName || 'DataPay'));

      const decodeResult = decodeEMVPix(cleanCode);
      const targetAmount = pendingSelection ? pendingSelection.amount : (decodeResult.decoded?.amount || 100);
      const recipientName = decodeResult.decoded?.merchantName || pendingSelection?.debtName || 'Beneficiário Pix';

      // Registra o Pix na Central Pix
      const queueId = 'pix_tg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newItem = {
        id: queueId,
        rawPayload: cleanCode,
        decoded: decodeResult.decoded || { merchantName: recipientName, amount: targetAmount, merchantCity: 'Brasil' },
        receivedAt: new Date().toISOString(),
        status: 'PENDING' as const,
        linkedDebtId: pendingSelection?.debtId,
        source: 'TELEGRAM_BOT'
      };

      try {
        const { db } = await connectToDatabase();
        await db.collection('CentralPix').updateOne({ id: newItem.id }, { $set: newItem }, { upsert: true });
      } catch (dbErr: any) {
        console.warn('[Telegram Webhook DB Error]:', dbErr.message);
      }

      if (typeof globalThis.pixQueueBuffer !== 'undefined') {
        globalThis.pixQueueBuffer.unshift(newItem);
      }

      // Constrói resposta com Botão de Confirmação de Quitação no Telegram
      let responseMsg = `⚡ *Pix Gerado & Vinculado com Sucesso!*\n\n`;
      if (pendingSelection) {
        responseMsg += `💳 *Dívida Atrelada:* ${pendingSelection.debtName}\n`;
      }
      responseMsg += `👤 *Recebedor:* ${recipientName}\n`;
      responseMsg += `💰 *Valor da Parcela:* R$ ${targetAmount.toFixed(2)}\n\n`;
      responseMsg += `📋 *Código Pix Copia e Cola:*\n\`${cleanCode}\``;

      const confirmButtons = [];
      if (pendingSelection) {
        confirmButtons.push([
          {
            text: `✅ Dar Baixa / Quitar ${pendingSelection.debtName} (R$ ${targetAmount.toFixed(2)})`,
            callback_data: `confirm_pay_${pendingSelection.debtId}_${targetAmount}`
          }
        ]);
      }

      const replyMarkup = confirmButtons.length > 0 ? { inline_keyboard: confirmButtons } : undefined;

      if (botToken) await sendTelegramMessage(botToken, chatId, responseMsg, replyMarkup);
      return NextResponse.json({ ok: true });
    }

    // Mensagem padrão de instrução
    if (botToken) {
      await sendTelegramMessage(botToken, chatId, `💡 Para pagar uma dívida com Pix:\n1. Digite \`/dividas\` e selecione a dívida.\n2. Cole a Chave ou Código Pix para gerar o pagamento!`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
