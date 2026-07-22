export async function POST(req: Request) {
  try {
    const event = await req.json();

    console.log('Received webhook event:', event.event);
    console.log('Event ID:', event.eventId);
    console.log('Item ID:', event.itemId);

    // Processamento assíncrono para garantir retorno em menos de 5 segundos
    // (Padrão exigido pelo regulamento da API do Pluggy para evitar timeouts)
    switch (event.event) {
      case 'item/created':
        // Dispara de forma assíncrona sem dar await no processo demorado
        handleItemCreated(event.itemId).catch(err => 
          console.error('Erro ao processar item/created:', err.message)
        );
        break;
      case 'item/updated':
        handleItemUpdated(event.itemId).catch(err => 
          console.error('Erro ao processar item/updated:', err.message)
        );
        break;
      case 'item/error':
        handleItemError(event.itemId, event.error).catch(err => 
          console.error('Erro ao processar item/error:', err.message)
        );
        break;
      default:
        console.log(`Evento não processado: ${event.event}`);
    }

    // Retorna status 200 (OK) imediatamente para a Pluggy confirmar a entrega do webhook
    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Erro no processamento do webhook:', error.message);
    return Response.json({ error: 'Erro interno ao processar webhook' }, { status: 500 });
  }
}

// Funções auxiliares assíncronas para processamento em background:

async function handleItemCreated(itemId: string) {
  console.log(`[Pluggy Webhook] Processando criação do Item ID: ${itemId}`);
  // TODO: Aqui você inicializa a chamada ao PluggyClient para carregar as contas e
  // dívidas correspondentes a este itemId e salvá-las no MongoDB.
}

async function handleItemUpdated(itemId: string) {
  console.log(`[Pluggy Webhook] Processando atualização do Item ID: ${itemId}`);
  // TODO: Aqui você atualiza os saldos e faturas que mudaram no banco de dados.
}

async function handleItemError(itemId: string, error: any) {
  console.error(`[Pluggy Webhook] Erro reportado para o Item ID: ${itemId}`, error);
  // TODO: Aqui você atualiza o status de sincronização deste banco para "Erro" no MongoDB,
  // notificando o usuário para reconectar via Widget.
}
