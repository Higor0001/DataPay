import { PluggyClient } from 'pluggy-sdk';

export async function POST(req: Request) {
  try {
    // Tenta ler primeiro os valores do .env local (PLUGGY_) ou o padrão do processo (CLIENT_)
    const clientId = process.env.PLUGGY_CLIENT_ID || process.env.CLIENT_ID;
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET || process.env.CLIENT_SECRET;

    console.log('[DataPay API] Chamando connect-token. Status das chaves:', {
      clientIdConfigurado: !!clientId,
      clientIdPrefixo: clientId ? clientId.substring(0, 8) : 'null',
      clientSecretConfigurado: !!clientSecret
    });

    if (!clientId || !clientSecret) {
      return Response.json(
        { error: 'Credenciais CLIENT_ID ou CLIENT_SECRET ausentes no servidor.' },
        { status: 500 }
      );
    }

    const pluggy = new PluggyClient({
      clientId: clientId,
      clientSecret: clientSecret,
    });

    // Lê os dados enviados no corpo da requisição (ex: ID do usuário local)
    const { clientUserId } = await req.json().catch(() => ({ clientUserId: undefined }));

    // Gera o token temporário seguro para o Widget Pluggy Connect abrir no frontend
    // Passamos undefined no primeiro argumento (itemId) por ser nova conexão, e o clientUserId no objeto de opções
    const connectToken = await pluggy.createConnectToken(undefined, {
      clientUserId: clientUserId || undefined
    });

    return Response.json({ accessToken: connectToken.accessToken });
  } catch (error: any) {
    console.error('Erro na API connect-token:', error.message);
    return Response.json(
      { error: 'Falha ao gerar o token de conexão do Open Finance.', details: error.message },
      { status: 500 }
    );
  }
}
