import { NextRequest, NextResponse } from 'next/server';
import { parseCreditDescription } from '../../../utils/creditParser';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo foi enviado na requisição.' },
        { status: 400 }
      );
    }

    // Determina o MIME type do arquivo
    let mimeType = file.type;
    if (!mimeType) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else mimeType = 'application/pdf'; // fallback padrão
    }

    const isImage = mimeType.startsWith('image/');

    // Converte o arquivo recebido para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // SE A CHAVE GEMINI ESTIVER CONFIGURADA -> USA A INTELIGÊNCIA ARTIFICIAL DO GEMINI (MULTIMODAL)
    if (apiKey) {
      console.log(`[DataPay API] Processando ${isImage ? 'imagem' : 'PDF'} com a IA do Google Gemini...`);
      
      const base64Data = buffer.toString('base64');
      const prompt = `Você é um extrator de contratos ou faturas de crédito bancário brasileiro de alta precisão.
Analise a ${isImage ? 'imagem' : 'documento PDF'} em anexo e extraia as informações contratuais.
Retorne estritamente um objeto JSON com a seguinte estrutura:
{
  "name": "Nome curto sugestivo para a dívida (ex: Empréstimo Nubank)",
  "bank": "Nome legível da instituição financeira",
  "type": "Empréstimo" | "Financiamento" | "Cartão" | "Consignado",
  "originalValue": número (valor original contratado),
  "currentBalance": número (saldo devedor atual),
  "interestRate": número (taxa de juros mensal em %),
  "cet": número (Custo Efetivo Total anual em %),
  "totalInstallments": número (quantidade total de parcelas),
  "remainingInstallments": número (parcelas restantes para pagar),
  "installmentValue": número (valor de cada parcela mensal),
  "notes": "Um breve resumo das condições identificadas"
}`;

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.warn('[Gemini API Error] Falha na chamada da API:', errText);
        throw new Error('Falha de comunicação com a API do Gemini.');
      }

      const geminiData = await geminiResponse.json();
      const rawTextResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawTextResponse) {
        throw new Error('A inteligência artificial não retornou dados legíveis.');
      }

      // Converte o texto JSON retornado pela IA para um objeto Javascript
      const parsedData = JSON.parse(rawTextResponse);

      return NextResponse.json({
        success: true,
        method: 'Gemini AI',
        fileName: file.name,
        data: parsedData
      });
    }

    // FALLBACK LOCAL: SE NÃO TIVER A CHAVE DO GEMINI -> USA A BIBLIOTECA LOCAL
    if (isImage) {
      throw new Error('A extração local não suporta imagens. Insira a chave GEMINI_API_KEY no arquivo .env para habilitar OCR e leitura de fotos por Inteligência Artificial.');
    }

    console.log('[DataPay API] GEMINI_API_KEY ausente. Usando biblioteca de extração local...');
    
    // Polyfills do browser para o leitor de PDF funcionar sem erros no Node.js
    const g = global as any;
    if (typeof g.DOMMatrix === 'undefined') g.DOMMatrix = class DOMMatrix {};
    if (typeof g.ImageData === 'undefined') g.ImageData = class ImageData {};
    if (typeof g.Path2D === 'undefined') g.Path2D = class Path2D {};

    const { PDFParse } = require('pdf-parse');
    const uint8Array = new Uint8Array(arrayBuffer);

    const parser = new PDFParse({ data: uint8Array });
    const pdfData = await parser.getText();
    const text = pdfData.text || '';
    await parser.destroy();

    const parsedData = parseCreditDescription(text);

    return NextResponse.json({
      success: true,
      method: 'Local Parser',
      fileName: file.name,
      textPreview: text.substring(0, 500) + '...',
      data: parsedData
    });
  } catch (error: any) {
    console.error('Erro na extração de dados do PDF/Imagem:', error.message);
    return NextResponse.json(
      { error: 'Falha ao processar o arquivo.', details: error.message },
      { status: 500 }
    );
  }
}
