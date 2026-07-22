import { NextResponse } from 'next/server';
import { decodeEMVPix } from '../../../../utils/emvPixParser';

// Declaração do buffer global em memória para persistir mensagens recebidas via MacroDroid/REST
declare global {
  var pixQueueBuffer: Array<{
    id: string;
    rawPayload: string;
    decoded: any;
    receivedAt: string;
    status: 'PENDING' | 'PAID' | 'PAID_PARTIAL' | 'PAID_LATE' | 'IGNORED';
  }>;
}

if (!globalThis.pixQueueBuffer) {
  globalThis.pixQueueBuffer = [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Suporta qualquer nome de parâmetro comum enviado pelo MacroDroid / Tasker / cURL
    const rawCode = body.codigo || body.pixCode || body.payload || body.text || body.clipboard;

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return NextResponse.json(
        {
          error: 'Payload Pix ausente. Forneça o campo "codigo" contendo a string Copia e Cola EMV.',
          status: 'error'
        },
        { status: 400 }
      );
    }

    const cleanCode = rawCode.trim();

    // Decodifica EMV AST
    const decodeResult = decodeEMVPix(cleanCode);

    if (!decodeResult.valid) {
      return NextResponse.json(
        {
          error: decodeResult.error || 'Código Pix malformado.',
          status: 'invalid_format'
        },
        { status: 422 }
      );
    }

    const queueId = 'pix_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const newItem = {
      id: queueId,
      rawPayload: cleanCode,
      decoded: decodeResult.decoded,
      receivedAt: new Date().toISOString(),
      status: 'PENDING' as const
    };

    // Insere no topo da fila em memória
    globalThis.pixQueueBuffer.unshift(newItem);

    // Limita o buffer em memória aos últimos 50 itens
    if (globalThis.pixQueueBuffer.length > 50) {
      globalThis.pixQueueBuffer = globalThis.pixQueueBuffer.slice(0, 50);
    }

    console.log(`[API /api/v1/pix] Novo Pix inserido com sucesso na fila! ID: ${queueId}, Beneficiario: ${decodeResult.decoded.merchantName}`);

    return NextResponse.json(
      {
        status: 'accepted',
        queue_id: queueId,
        message: 'Pix recebido e adicionado à Fila Inteligente do Central Pix com sucesso.',
        received_at: newItem.receivedAt,
        decoded: decodeResult.decoded
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error('[API /api/v1/pix Error]:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar payload Pix.', details: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      items: globalThis.pixQueueBuffer || [],
      count: (globalThis.pixQueueBuffer || []).length,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao consultar fila de Pix.', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      globalThis.pixQueueBuffer = (globalThis.pixQueueBuffer || []).filter(item => item.id !== id);
    } else {
      globalThis.pixQueueBuffer = [];
    }

    return NextResponse.json({ success: true, message: 'Fila atualizada.' });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao limpar fila de Pix.', details: err.message },
      { status: 500 }
    );
  }
}
