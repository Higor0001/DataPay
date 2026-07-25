import { NextResponse } from 'next/server';

const PIERRE_BASE_URL = 'https://pierre.finance/tools/api';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || '/get-accounts';
    const apiKey = req.headers.get('x-pierre-api-key') || process.env.PIERRE_API_KEY || '';

    // Forward additional search parameters excluding 'endpoint'
    const forwardedParams = new URLSearchParams();
    searchParams.forEach((val, key) => {
      if (key !== 'endpoint') forwardedParams.append(key, val);
    });

    const queryString = forwardedParams.toString() ? `?${forwardedParams.toString()}` : '';
    const targetUrl = `${PIERRE_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}${queryString}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    }

    const response = await fetch(targetUrl, { method: 'GET', headers });
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[Pierre Proxy GET Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Falha na comunicação com a API Pierre Finance.', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || '/manual-update';
    const apiKey = req.headers.get('x-pierre-api-key') || process.env.PIERRE_API_KEY || '';

    const body = await req.json().catch(() => ({}));
    const targetUrl = `${PIERRE_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[Pierre Proxy POST Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Falha na comunicação com a API Pierre Finance.', details: error.message },
      { status: 500 }
    );
  }
}
