import { NextResponse } from 'next/server';
import { decodeEMVPix } from '../../../../utils/emvPixParser';
import { parseBoletoLine } from '../../../../utils/boletoParser';
import { connectToDatabase } from '../../../../utils/mongodb';
import { getPixCopyPasteCode } from '../../../../utils/qrCode';

// Memory map for user Telegram pending debt & parcel selections (chatId -> Selection)
declare global {
  var telegramPendingDebtSelections: Map<
    number | string,
    {
      debtId: string;
      debtName: string;
      bank: string;
      parcelRef: string;
      amount: number;
    }
  >;
}

if (!globalThis.telegramPendingDebtSelections) {
  globalThis.telegramPendingDebtSelections = new Map();
}

// Persistent Bottom Menu Keyboard (Teclado de Menu Fixo do Telegram com suporte a Pix e Boletos)
const mainPersistentMenu = {
  keyboard: [
    [{ text: '📋 Minhas Dívidas' }, { text: '🏦 Saldos Open Finance' }],
    [{ text: '💸 Pagar Pix' }, { text: '📄 Pagar Boleto' }],
    [{ text: 'ℹ️ Ajuda & Comandos' }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

// Helper to fetch REAL user debts from 'Finanças' collection
async function getStoredDebts(db: any) {
  const docs = await db.collection('Finanças').find({}).sort({ updatedAt: -1 }).toArray();
  const targetDoc = docs.find((d: any) => Array.isArray(d.debts) && d.debts.length > 0) || docs[0] || null;
  const debtsList: any[] = targetDoc?.debts || [];
  return { doc: targetDoc, debtsList };
}

// Helper to send message back to Telegram Chat
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
    // A. PROCESSAMENTO DE CALLBACK QUERIES (Cliques em Botões Inline)
    // ------------------------------------------------------------------------
    if (body.callback_query) {
      const cb = body.callback_query;
      const callbackId = cb.id;
      const chatId = cb.message?.chat?.id;
      const cbData: string = cb.data || '';

      console.log(`[Telegram Callback] Clique de chat_id=${chatId}: data="${cbData}"`);

      // 1. Passo 1: Seleção da Dívida -> Exibe o Menu da Referência/Parcela (select_debt_<debtId>)
      if (cbData.startsWith('select_debt_')) {
        const debtId = cbData.replace('select_debt_', '');

        try {
          const { db } = await connectToDatabase();
          const { debtsList } = await getStoredDebts(db);
          const targetDebt = debtsList.find((d: any) => d.id === debtId);

          if (targetDebt) {
            await answerTelegramCallbackQuery(botToken, callbackId, `Dívida "${targetDebt.name}" selecionada!`);

            const totalInst = targetDebt.totalInstallments || 12;
            const remainingInst = targetDebt.remainingInstallments || 1;
            const currentParcelNum = Math.max(1, totalInst - remainingInst + 1);
            const valParcela = targetDebt.installmentValue || targetDebt.currentBalance || 100;
            const valTotal = targetDebt.currentBalance || valParcela;

            const parcelButtons = [];

            parcelButtons.push([
              {
                text: `🗓️ Parcela ${currentParcelNum}/${totalInst} (Atual) — R$ ${valParcela.toFixed(2)}`,
                callback_data: `select_parcel_${targetDebt.id}_${currentParcelNum}_${valParcela}`
              }
            ]);

            if (remainingInst > 1 && currentParcelNum + 1 <= totalInst) {
              parcelButtons.push([
                {
                  text: `🗓️ Parcela ${currentParcelNum + 1}/${totalInst} (Próxima) — R$ ${valParcela.toFixed(2)}`,
                  callback_data: `select_parcel_${targetDebt.id}_${currentParcelNum + 1}_${valParcela}`
                }
              ]);
            }

            parcelButtons.push([
              {
                text: `💰 Quitar Saldo Total — R$ ${valTotal.toFixed(2)}`,
                callback_data: `select_parcel_${targetDebt.id}_total_${valTotal}`
              }
            ]);

            const msgText = `💳 *Dívida: ${targetDebt.name}* (${targetDebt.bank})

📊 *Parcelas:* ${currentParcelNum}/${totalInst}
💰 *Valor da Parcela:* R$ ${valParcela.toFixed(2)}
📉 *Saldo Devedor Total:* R$ ${valTotal.toFixed(2)}

📌 *Selecione a Referência / Parcela* para pagar com Pix ou Boleto:`;

            const replyMarkup = { inline_keyboard: parcelButtons };
            if (botToken) await sendTelegramMessage(botToken, chatId, msgText, replyMarkup);
          } else {
            await answerTelegramCallbackQuery(botToken, callbackId, 'Dívida não encontrada.');
          }
        } catch (err: any) {
          await answerTelegramCallbackQuery(botToken, callbackId, 'Erro ao carregar dívida.');
        }

        return NextResponse.json({ ok: true });
      }

      // 2. Passo 2: Seleção da Parcela/Referência (select_parcel_<debtId>_<parcelRef>_<amount>)
      if (cbData.startsWith('select_parcel_')) {
        const parts = cbData.replace('select_parcel_', '').split('_');
        const debtId = parts[0];
        const parcelRefStr = parts[1];
        const amount = parseFloat(parts[2]) || 0;

        try {
          const { db } = await connectToDatabase();
          const { debtsList } = await getStoredDebts(db);
          const targetDebt = debtsList.find((d: any) => d.id === debtId);

          if (targetDebt) {
            const parcelLabel = parcelRefStr === 'total' ? 'Quitação Total' : `Parcela ${parcelRefStr}/${targetDebt.totalInstallments || 12}`;

            globalThis.telegramPendingDebtSelections.set(chatId, {
              debtId: targetDebt.id,
              debtName: targetDebt.name,
              bank: targetDebt.bank,
              parcelRef: parcelLabel,
              amount: amount || targetDebt.installmentValue || 100
            });

            await answerTelegramCallbackQuery(botToken, callbackId, `Referência "${parcelLabel}" selecionada!`);

            const promptMsg = `🎯 *Dívida & Referência Selecionada:*
💳 *${targetDebt.name}* (${targetDebt.bank})
🗓️ *Referência:* ${parcelLabel}
💰 *Valor:* R$ ${(amount || targetDebt.installmentValue || 0).toFixed(2)}

📲 *Próximo Passo:*
Envie ou cole agora a *Chave Pix*, código *Pix Copia e Cola (\`000201...\`)* ou a *Linha Digitável do Boleto* (44 a 48 dígitos) para vincular e quitar!`;

            if (botToken) await sendTelegramMessage(botToken, chatId, promptMsg);
          }
        } catch (err: any) {
          await answerTelegramCallbackQuery(botToken, callbackId, 'Erro ao salvar referência.');
        }

        return NextResponse.json({ ok: true });
      }

      // 3. Passo 3: Confirmação de Quitação no DataPay (confirm_pay_<debtId>_<amount>_<parcelRef>)
      if (cbData.startsWith('confirm_pay_')) {
        const payloadStr = cbData.replace('confirm_pay_', '');
        const firstUnderscore = payloadStr.indexOf('_');
        const debtId = payloadStr.substring(0, firstUnderscore);
        const rest = payloadStr.substring(firstUnderscore + 1);
        const secondUnderscore = rest.indexOf('_');
        const amount = parseFloat(secondUnderscore !== -1 ? rest.substring(0, secondUnderscore) : rest) || 0;
        const parcelRef = secondUnderscore !== -1 ? decodeURIComponent(rest.substring(secondUnderscore + 1)) : 'Parcela';

        try {
          const { db } = await connectToDatabase();
          const { doc, debtsList } = await getStoredDebts(db);
          let updatedDebts: any[] = debtsList || [];
          let paymentsList: any[] = doc?.payments || [];

          const targetDebt = updatedDebts.find((d: any) => d.id === debtId);

          if (targetDebt && amount > 0) {
            const isTotalPayoff = parcelRef.toLowerCase().includes('total');
            const updatedRemaining = isTotalPayoff ? 0 : Math.max(0, (targetDebt.remainingInstallments || 1) - 1);
            const updatedBalance = isTotalPayoff ? 0 : Math.max(0, (targetDebt.currentBalance || amount) - amount);
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

            // Adiciona lançamento em pagamentos
            const newPayment = {
              id: `p_tg_${Date.now()}`,
              debtId: targetDebt.id,
              debtName: `${targetDebt.name} (${parcelRef})`,
              bankName: targetDebt.bank,
              amount,
              paidDate: new Date().toISOString().split('T')[0],
              status: 'Pago',
              method: 'Pix',
              createdAt: new Date().toISOString()
            };
            paymentsList.unshift(newPayment);

            const userId = doc?.userId || 'default_user';
            await db.collection('Finanças').updateOne(
              { userId },
              { $set: { userId, debts: updatedDebts, payments: paymentsList, updatedAt: new Date().toISOString() } },
              { upsert: true }
            );

            await answerTelegramCallbackQuery(botToken, callbackId, '✅ Baixa efetuada no DataPay!');

            const receiptMsg = `🎉 *PAGAMENTO CONFIRMADO E QUITADO!*

💳 *Dívida:* ${targetDebt.name} (${targetDebt.bank})
🗓️ *Referência:* ${parcelRef}
💰 *Valor Pago:* R$ ${amount.toFixed(2)}
📉 *Novo Saldo Devedor:* R$ ${updatedBalance.toFixed(2)}
📊 *Parcelas Restantes:* ${updatedRemaining}

✅ A baixa foi registrada com sucesso no DataPay!`;

            if (botToken) await sendTelegramMessage(botToken, chatId, receiptMsg, mainPersistentMenu);
            globalThis.telegramPendingDebtSelections.delete(chatId);
          } else {
            await answerTelegramCallbackQuery(botToken, callbackId, 'Não foi possível dar baixa.');
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
    // B. PROCESSAMENTO DE MENSAGENS E COMANDOS
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

    // 1. Comando /start, /menu ou botão "ℹ️ Ajuda & Comandos"
    if (
      text.startsWith('/start') ||
      text.startsWith('/menu') ||
      text.startsWith('/ajuda') ||
      text.includes('Ajuda')
    ) {
      const helpMsg = `🤖 *Central Pix & Boletos — DataPay Bot*

Selecione a opção desejada ou use o menu fixo abaixo para gerenciar seu financeiro:

📌 *Recursos Principais:*
• *📋 Minhas Dívidas* — Lista dívidas e parcelas para vincular Pix ou Boleto.
• *🏦 Saldos Open Finance* — Consulta saldos em tempo real via Pierre API.
• *💸 Pagar Pix* — Cole um Pix Copia e Cola ou Chave.
• *📄 Pagar Boleto* — Cole a Linha Digitável de um Boleto (44-48 dígitos).
• *ℹ️ Ajuda & Comandos* — Exibe este menu.`;

      if (botToken) await sendTelegramMessage(botToken, chatId, helpMsg, mainPersistentMenu);
      return NextResponse.json({ ok: true });
    }

    // 2. Comando /dividas ou botão "📋 Minhas Dívidas"
    if (
      text.startsWith('/dividas') ||
      text.startsWith('/divida') ||
      text.includes('Minhas Dívidas')
    ) {
      try {
        const { db } = await connectToDatabase();
        const { debtsList } = await getStoredDebts(db);
        const activeDebts = debtsList.filter((d: any) => d.status !== 'paid');

        if (activeDebts.length === 0) {
          if (botToken) {
            await sendTelegramMessage(
              botToken,
              chatId,
              `📋 *Nenhuma Dívida Ativa Encontrada*\n\nVocê não possui dívidas pendentes cadastradas no DataPay no momento.\n\n👉 Acesse [data-pay-omega.vercel.app](https://data-pay-omega.vercel.app) para cadastrar no site!`,
              mainPersistentMenu
            );
          }
          return NextResponse.json({ ok: true });
        }

        let msgText = `📋 *Selecione a Dívida para Vincular Pix ou Boleto:*\n\nClique na dívida desejada para escolher a parcela:`;

        const keyboardButtons = activeDebts.map((d: any) => {
          const val = d.installmentValue || d.currentBalance || 0;
          return [
            {
              text: `💳 ${d.name} (${d.bank}) — Parcela R$ ${val.toFixed(2)}`,
              callback_data: `select_debt_${d.id}`
            }
          ];
        });

        const replyMarkup = { inline_keyboard: keyboardButtons };
        if (botToken) await sendTelegramMessage(botToken, chatId, msgText, replyMarkup);
      } catch (err: any) {
        console.error('[Telegram /dividas Error]:', err);
        if (botToken) await sendTelegramMessage(botToken, chatId, `⚠️ Erro ao consultar dívidas no DataPay.`, mainPersistentMenu);
      }

      return NextResponse.json({ ok: true });
    }

    // 3. Comando /saldos ou botão "🏦 Saldos Open Finance"
    if (
      text.startsWith('/saldos') ||
      text.startsWith('/saldo') ||
      text.includes('Saldos Open Finance')
    ) {
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

      if (botToken) await sendTelegramMessage(botToken, chatId, saldoMsg, mainPersistentMenu);
      return NextResponse.json({ ok: true });
    }

    // 4. Suporte a envio de Linha Digitável de Boleto (44 a 48 dígitos)
    const cleanDigits = text.replace(/[^0-9]/g, '');
    const isBoletoCode = cleanDigits.length >= 44 && cleanDigits.length <= 48 && !text.includes('000201');

    if (isBoletoCode || text.startsWith('/boleto') || text.includes('Pagar Boleto')) {
      if (text.includes('Pagar Boleto') && cleanDigits.length < 44) {
        if (botToken) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `📄 *Envio de Boleto Bancário*\n\nCole a Linha Digitável (código de barras de 44 a 48 dígitos) do seu Boleto nesta conversa!`,
            mainPersistentMenu
          );
        }
        return NextResponse.json({ ok: true });
      }

      const boletoCode = text.startsWith('/boleto') ? text.replace('/boleto', '').trim() : text;
      const boletoRes = parseBoletoLine(boletoCode);
      const pendingSelection = globalThis.telegramPendingDebtSelections.get(chatId);

      const targetAmount = boletoRes.amount || pendingSelection?.amount || 100;
      const bankName = boletoRes.bankName || pendingSelection?.bank || 'Boleto Bancário';
      const parcelRef = pendingSelection?.parcelRef || 'Parcela';

      // Registra o Boleto na Central Pix & Boletos
      const queueId = 'bol_tg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newItem = {
        id: queueId,
        rawPayload: boletoRes.cleanLine || cleanDigits,
        type: 'boleto',
        decoded: {
          merchantName: bankName,
          amount: targetAmount,
          merchantCity: 'Brasil',
          dueDate: boletoRes.dueDate
        },
        receivedAt: new Date().toISOString(),
        status: 'PENDING' as const,
        linkedDebtId: pendingSelection?.debtId,
        parcelRef,
        source: 'TELEGRAM_BOT'
      };

      try {
        const { db } = await connectToDatabase();
        await db.collection('CentralPix').updateOne({ id: newItem.id }, { $set: newItem }, { upsert: true });
      } catch (dbErr: any) {
        console.warn('[Telegram Boleto DB Error]:', dbErr.message);
      }

      if (typeof globalThis.pixQueueBuffer !== 'undefined') {
        globalThis.pixQueueBuffer.unshift(newItem);
      }

      let responseMsg = `📄 *Boleto Decodificado & Vinculado com Sucesso!*\n\n`;
      if (pendingSelection) {
        responseMsg += `💳 *Dívida:* ${pendingSelection.debtName} (${pendingSelection.bank})\n`;
        responseMsg += `🗓️ *Referência:* ${parcelRef}\n`;
      }
      responseMsg += `🏦 *Emissor:* ${bankName}\n`;
      responseMsg += `💰 *Valor:* R$ ${targetAmount.toFixed(2)}\n`;
      if (boletoRes.dueDate) responseMsg += `📅 *Vencimento:* ${boletoRes.dueDate}\n`;
      responseMsg += `\n📋 *Linha Digitável:*\n\`${boletoRes.cleanLine || cleanDigits}\``;

      const confirmButtons = [];
      if (pendingSelection) {
        confirmButtons.push([
          {
            text: `✅ Confirmar Baixa do Boleto (${parcelRef} - R$ ${targetAmount.toFixed(2)})`,
            callback_data: `confirm_pay_${pendingSelection.debtId}_${targetAmount}_${encodeURIComponent(parcelRef)}`
          }
        ]);
      }

      const replyMarkup = confirmButtons.length > 0 ? { inline_keyboard: confirmButtons } : mainPersistentMenu;

      if (botToken) await sendTelegramMessage(botToken, chatId, responseMsg, replyMarkup);
      return NextResponse.json({ ok: true });
    }

    // 5. Recebimento de Chave Pix ou Payload EMV
    const pendingSelection = globalThis.telegramPendingDebtSelections.get(chatId);
    let pixCodeToParse = text.startsWith('/pix') ? text.replace('/pix', '').trim() : text;

    const isEMVCode = pixCodeToParse.includes('000201') || pixCodeToParse.length > 25;

    if (isEMVCode || (pendingSelection && !isBoletoCode)) {
      const match = pixCodeToParse.match(/000201[0-9a-zA-Z]+/);
      const cleanCode = match
        ? match[0]
        : (isEMVCode
            ? pixCodeToParse
            : getPixCopyPasteCode(pendingSelection?.amount || 100, pendingSelection?.debtName || 'DataPay'));

      const decodeResult = decodeEMVPix(cleanCode);
      const targetAmount = pendingSelection ? pendingSelection.amount : (decodeResult.decoded?.amount || 100);
      const recipientName = decodeResult.decoded?.merchantName || pendingSelection?.debtName || 'Beneficiário Pix';
      const parcelRef = pendingSelection?.parcelRef || 'Parcela';

      // Registra o Pix na Central Pix & Boletos
      const queueId = 'pix_tg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newItem = {
        id: queueId,
        rawPayload: cleanCode,
        type: 'pix',
        decoded: decodeResult.decoded || { merchantName: recipientName, amount: targetAmount, merchantCity: 'Brasil' },
        receivedAt: new Date().toISOString(),
        status: 'PENDING' as const,
        linkedDebtId: pendingSelection?.debtId,
        parcelRef,
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

      let responseMsg = `⚡ *Pix Gerado & Atrelado com Sucesso!*\n\n`;
      if (pendingSelection) {
        responseMsg += `💳 *Dívida:* ${pendingSelection.debtName} (${pendingSelection.bank})\n`;
        responseMsg += `🗓️ *Referência:* ${parcelRef}\n`;
      }
      responseMsg += `👤 *Recebedor:* ${recipientName}\n`;
      responseMsg += `💰 *Valor:* R$ ${targetAmount.toFixed(2)}\n\n`;
      responseMsg += `📋 *Código Pix Copia e Cola:*\n\`${cleanCode}\``;

      const confirmButtons = [];
      if (pendingSelection) {
        confirmButtons.push([
          {
            text: `✅ Confirmar Baixa (${parcelRef} - R$ ${targetAmount.toFixed(2)})`,
            callback_data: `confirm_pay_${pendingSelection.debtId}_${targetAmount}_${encodeURIComponent(parcelRef)}`
          }
        ]);
      }

      const replyMarkup = confirmButtons.length > 0 ? { inline_keyboard: confirmButtons } : mainPersistentMenu;

      if (botToken) await sendTelegramMessage(botToken, chatId, responseMsg, replyMarkup);
      return NextResponse.json({ ok: true });
    }

    // Mensagem padrão com menu principal
    if (botToken) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `💡 *Como Pagar uma Dívida com Pix ou Boleto:*\n\n1. Clique em *📋 Minhas Dívidas* ou digite \`/dividas\`.\n2. Escolha a dívida e a *parcela/referência* desejada.\n3. Cole a Chave Pix, código Copia e Cola ou a *Linha Digitável do Boleto* (44-48 dígitos) para dar baixa!`,
        mainPersistentMenu
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
