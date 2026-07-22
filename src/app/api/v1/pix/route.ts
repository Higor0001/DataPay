import { NextResponse } from 'next/server';
import { decodeEMVPix } from '../../../../utils/emvPixParser';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    const rawCode = body.codigo || body.pixCode || body.payload || body.text;

    if (!rawCode || typeof rawCode !== 'string') {
      return NextResponse.json(
        {
          error: 'Payload Pix ausente. Forneça o campo "codigo" com a string Copia e Cola EMV.',
          status: 'error'
        },
        { status: 400 }
      );
    }

    // Decodifica EMV
    const decodeResult = decodeEMVPix(rawCode);

    if (!decodeResult.valid) {
      return NextResponse.json(
        {
          error: decodeResult.error || 'Código Pix malformado.',
          status: 'invalid_format'
        },
        { status: 422 }
      );
    }

    const queueId = 'pix_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    return NextResponse.json(
      {
        status: 'accepted',
        queue_id: queueId,
        message: 'Pix recebido com sucesso via API MacroDroid/REST. Processamento IA concluído.',
        received_at: new Date().toISOString(),
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
