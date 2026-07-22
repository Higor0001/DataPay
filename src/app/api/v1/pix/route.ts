import { NextResponse } from 'next/server';
import { decodeEMVPix } from '../../../../utils/emvPixParser';
import { connectToDatabase } from '../../../../utils/mongodb';

// Memory buffer fallback
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

    // Suporta qualquer campo de payload comum do MacroDroid / Tasker / cURL
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

    // 1. Tenta salvar no MongoDB Cloud Atlas para persistência 100% garantida entre lambdas do Vercel
    let savedInMongo = false;
    try {
      const { db } = await connectToDatabase();
      await db.collection('CentralPix').updateOne(
        { id: newItem.id },
        { $set: newItem },
        { upsert: true }
      );
      savedInMongo = true;
      console.log(`[API /api/v1/pix] Item salvo com SUCESSO no MongoDB Cloud Atlas! ID: ${queueId}`);
    } catch (mongoErr: any) {
      console.warn('[API /api/v1/pix] MongoDB indisponível, usando fallback em memória:', mongoErr.message);
    }

    // 2. Adiciona também ao buffer em memória local
    globalThis.pixQueueBuffer.unshift(newItem);
    if (globalThis.pixQueueBuffer.length > 50) {
      globalThis.pixQueueBuffer = globalThis.pixQueueBuffer.slice(0, 50);
    }

    return NextResponse.json(
      {
        status: 'accepted',
        queue_id: queueId,
        message: 'Pix recebido e adicionado à Fila Inteligente com sucesso.',
        received_at: newItem.receivedAt,
        decoded: decodeResult.decoded,
        persisted: savedInMongo
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
    let mongoItems: any[] = [];
    let fetchedFromMongo = false;

    // Busca do MongoDB Cloud Atlas primeiro
    try {
      const { db } = await connectToDatabase();
      mongoItems = await db
        .collection('CentralPix')
        .find({ status: { $ne: 'DELETED' } })
        .sort({ receivedAt: -1 })
        .limit(50)
        .toArray();

      fetchedFromMongo = true;
    } catch (mongoErr: any) {
      console.warn('[API /api/v1/pix GET] Fallback para memória:', mongoErr.message);
    }

    // Combina itens do MongoDB e do buffer em memória sem duplicados
    const combinedMap = new Map();
    
    // Adiciona memória
    (globalThis.pixQueueBuffer || []).forEach(item => combinedMap.set(item.id, item));

    // Sobrescreve/complementa com MongoDB
    if (fetchedFromMongo && mongoItems.length > 0) {
      mongoItems.forEach(item => {
        // Remove id do Mongo (_id) da serialização
        const { _id, ...cleanItem } = item;
        combinedMap.set(cleanItem.id, cleanItem);
      });
    }

    const finalItems = Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      items: finalItems,
      count: finalItems.length,
      source: fetchedFromMongo ? 'mongodb' : 'memory_fallback',
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

    // Remove do MongoDB
    try {
      const { db } = await connectToDatabase();
      if (id) {
        await db.collection('CentralPix').deleteOne({ id });
      } else {
        await db.collection('CentralPix').deleteMany({});
      }
    } catch (e) {
      // Ignora erro do mongo no DELETE
    }

    // Remove da memória
    if (id) {
      globalThis.pixQueueBuffer = (globalThis.pixQueueBuffer || []).filter(item => item.id !== id);
    } else {
      globalThis.pixQueueBuffer = [];
    }

    return NextResponse.json({ success: true, message: 'Fila limpa.' });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao limpar fila de Pix.', details: err.message },
      { status: 500 }
    );
  }
}
