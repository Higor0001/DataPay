import { NextResponse } from 'next/server';
import { decodeEMVPix } from '../../../../utils/emvPixParser';
import { connectToDatabase } from '../../../../utils/mongodb';

// Helper to send message back to Telegram Chat
async function sendTelegramMessage(botToken: string, chatId: number | string, text: string, parseMode: string = 'Markdown') {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });
  } catch (err: any) {
    console.error('[Telegram Bot Send Error]:', err.message);
  }
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const body = await req.json().catch(() => ({}));

    const message = body.message || body.edited_message;
    if (!message || !message.chat || !message.chat.id) {
      return NextResponse.json({ ok: true, note: 'No message to process' });
    }

    const chatId = message.chat.id;
    const text: string = (message.text || '').trim();

    if (!text) {
      return NextResponse.json({ ok: true });
    }

    console.log(`[Telegram Webhook] Recebida mensagem de chat_id=${chatId}: "${text.substring(0, 50)}"`);

    // 1. Comando /start ou /ajuda
    if (text.startsWith('/start') || text.startsWith('/ajuda') || text.startsWith('/help')) {
      const helpMsg = `🤖 *Central Pix & DataPay Bot*

Olá! Envie códigos Pix, chaves ou use os comandos abaixo para gerenciar seu financeiro:

📌 *Comandos Disponíveis:*
• \`/pix <codigo_copia_e_cola>\` — Cadastra e analisa um Pix na Central Pix via IA.
• \`/pagar <valor> <recebedor>\` — Gera um Pix instantâneo para pagamento.
• \`/saldos\` — Consulta saldos das suas contas no Pierre Open Finance.
• \`/dividas\` — Lista suas dívidas pendentes no DataPay.
• \`/ajuda\` — Exibe este menu.

💡 *Dica:* Você também pode colar qualquer código Pix Copia e Cola (\`000201...\`) diretamente aqui nesta conversa!`;

      if (botToken) await sendTelegramMessage(botToken, chatId, helpMsg);
      return NextResponse.json({ ok: true });
    }

    // 2. Comando /saldos (Pierre Open Finance)
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

    // 3. Comando /dividas
    if (text.startsWith('/dividas') || text.startsWith('/divida')) {
      let dividasMsg = `📋 *Resumo de Dívidas (DataPay)*\n\n`;
      try {
        const { db } = await connectToDatabase();
        const stored = await db.collection('UserData').findOne({});
        const debtsList = stored?.debts || [];
        const active = debtsList.filter((d: any) => d.status !== 'paid');

        if (active.length === 0) {
          dividasMsg += `🎉 Você não possui nenhuma dívida pendente!`;
        } else {
          let total = 0;
          active.forEach((d: any) => {
            total += d.currentBalance || 0;
            dividasMsg += `• *${d.name}* (${d.bank}): R$ ${(d.currentBalance || 0).toFixed(2)} | Parcela: R$ ${(d.installmentValue || 0).toFixed(2)}\n`;
          });
          dividasMsg += `\n🔴 *Dívida Total:* R$ ${total.toFixed(2)}`;
        }
      } catch (err: any) {
        dividasMsg += `Não foi possível carregar as dívidas no momento.`;
      }

      if (botToken) await sendTelegramMessage(botToken, chatId, dividasMsg);
      return NextResponse.json({ ok: true });
    }

    // 4. Comando /pagar <valor> <recebedor>
    if (text.startsWith('/pagar')) {
      const parts = text.replace('/pagar', '').trim().split(' ');
      const amountStr = parts[0];
      const recipient = parts.slice(1).join(' ') || 'Pagamento Pix';

      const amountVal = parseFloat(amountStr);
      if (!amountVal || amountVal <= 0) {
        if (botToken) await sendTelegramMessage(botToken, chatId, `⚠️ *Uso correto:* \`/pagar <valor> <recebedor>\` (Ex: \`/pagar 150 Mercado Pago\`)`);
        return NextResponse.json({ ok: true });
      }

      // Gera código Copia e Cola
      const emvPayload = `00020101021226840014br.gov.bcb.pix2562pix.mercadopago.com/qr/v2/4ad8d893-68d5-45bb-b3b2-70b55ec70cb0520400005303986540${amountVal.toFixed(2).length.toString().padStart(2, '0')}${amountVal.toFixed(2)}5802BR5925DataPay Ltda6009Sao Paulo62070503***63041A2B`;

      const payReply = `💸 *Pix Gerado para Pagamento*

👤 *Recebedor:* ${recipient}
💰 *Valor:* R$ ${amountVal.toFixed(2)}

📋 *Código Copia e Cola:*
\`${emvPayload}\`

Acesse o DataPay Central Pix para dar baixa no pagamento!`;

      if (botToken) await sendTelegramMessage(botToken, chatId, payReply);
      return NextResponse.json({ ok: true });
    }

    // 5. Envio de Pix (Via comando /pix ou colando o payload EMV diretamente)
    let pixCodeToParse = text;
    if (text.startsWith('/pix')) {
      pixCodeToParse = text.replace('/pix', '').trim();
    }

    if (pixCodeToParse.includes('000201') || pixCodeToParse.length > 20) {
      // Extrai a parte EMV se houver texto ao redor
      const match = pixCodeToParse.match(/000201[0-9a-zA-Z]+/);
      const cleanCode = match ? match[0] : pixCodeToParse;

      const decodeResult = decodeEMVPix(cleanCode);

      if (decodeResult.valid && decodeResult.decoded) {
        const queueId = 'pix_tg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
        const newItem = {
          id: queueId,
          rawPayload: cleanCode,
          decoded: decodeResult.decoded,
          receivedAt: new Date().toISOString(),
          status: 'PENDING' as const,
          source: 'TELEGRAM_BOT'
        };

        // Persiste no MongoDB
        try {
          const { db } = await connectToDatabase();
          await db.collection('CentralPix').updateOne(
            { id: newItem.id },
            { $set: newItem },
            { upsert: true }
          );
        } catch (dbErr: any) {
          console.warn('[Telegram Webhook DB Error]:', dbErr.message);
        }

        // Adiciona ao buffer global em memória
        if (typeof globalThis.pixQueueBuffer !== 'undefined') {
          globalThis.pixQueueBuffer.unshift(newItem);
        }

        const replyMsg = `⚡ *Pix Recebido e Cadastrado na Central Pix!*

👤 *Recebedor:* ${decodeResult.decoded.merchantName || 'Não especificado'}
💰 *Valor:* ${decodeResult.decoded.amount ? `R$ ${decodeResult.decoded.amount.toFixed(2)}` : 'Pix Dinâmico'}
🏙️ *Cidade:* ${decodeResult.decoded.merchantCity || 'Brasil'}
🕒 *Data:* ${new Date().toLocaleTimeString('pt-BR')}

✅ O Pix já foi adicionado à Fila Inteligente no DataPay.`;

        if (botToken) await sendTelegramMessage(botToken, chatId, replyMsg);
        return NextResponse.json({ ok: true });
      } else {
        if (botToken) await sendTelegramMessage(botToken, chatId, `⚠️ O código Pix enviado é inválido ou malformado. Certifique-se de enviar o código EMV Copia e Cola completo (começa com \`000201...\`).`);
        return NextResponse.json({ ok: true });
      }
    }

    // Mensagem genérica caso o texto não seja reconhecido
    if (botToken) {
      await sendTelegramMessage(botToken, chatId, `💡 Para cadastrar um Pix, cole o código Copia e Cola (\`000201...\`) ou use o comando \`/pix <codigo>\`. Digite \`/ajuda\` para ver os comandos.`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
