import { MercadoPagoConfig, Payment } from 'mercadopago';

export interface PixPaymentResponse {
  id: string;
  qrCodeBase64: string;
  qrCodeCopyPaste: string;
  status: 'Pendente' | 'Pago' | 'Expirado' | 'Cancelado';
}

export interface PaymentProvider {
  createPix(amount: number, description: string, payerEmail?: string): Promise<PixPaymentResponse>;
}

/**
 * Provedor Oficial do Mercado Pago utilizando o SDK Oficial
 */
export class MercadoPagoProvider implements PaymentProvider {
  private client: MercadoPagoConfig;

  constructor(token: string) {
    this.client = new MercadoPagoConfig({ accessToken: token });
  }

  async createPix(amount: number, description: string, payerEmail?: string): Promise<PixPaymentResponse> {
    const paymentClient = new Payment(this.client);
    
    // E-mail padrão de teste da sandbox caso não seja fornecido
    const emailToUse = payerEmail && payerEmail.trim() !== '' 
      ? payerEmail 
      : 'test_user_19653724@testuser.com';

    console.log(`[MercadoPagoProvider] Enviando Pix via SDK. Valor: R$ ${amount.toFixed(2)}, Email: ${emailToUse}...`);

    const response = await paymentClient.create({
      body: {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: emailToUse,
          first_name: 'Usuário',
          last_name: 'DataPay'
        }
      }
    });

    console.log(`[MercadoPagoProvider] Pix criado via SDK. ID: ${response.id}`);

    return {
      id: String(response.id),
      qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64 || '',
      qrCodeCopyPaste: response.point_of_interaction?.transaction_data?.qr_code || '',
      status: 'Pendente'
    };
  }
}

/**
 * Provedor Sandbox / Simulador
 */
export class SandboxPaymentProvider implements PaymentProvider {
  async createPix(amount: number, description: string, payerEmail?: string): Promise<PixPaymentResponse> {
    const mockId = 'sandbox_mp_' + Math.random().toString(36).substring(2, 9);
    const mockQrBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABFGoRRAAAABlBMVEUAAAD///+l2Z/dAAAAMklEQVR42mP8z8AARAwD/GfA/wy4n4H/GfA/A/5nwP8M+J8B/zPgfwaGgV4GfgoAoR8P4b3LwYcAAAAASUVORK5CYII=';
    const mockCopyPaste = `00020101021226930014br.gov.bcb.pix2571pix-qr.mercadopago.com/emv/v2/mock-transaction-datapay-reserve-4488349274294025a1339bc275515204000053039865405${amount.toFixed(2)}5802BR5907DataPay6009SAO PAULO62070503***6304E22A`;

    console.log(`[SandboxPaymentProvider] Criando Pix simulado para R$ ${amount.toFixed(2)} (Payer: ${payerEmail || 'N/A'})...`);

    return {
      id: mockId,
      qrCodeBase64: mockQrBase64,
      qrCodeCopyPaste: mockCopyPaste,
      status: 'Pendente'
    };
  }
}

/**
 * Fábrica de Provedores de Pagamento
 */
export class PaymentProviderFactory {
  static getProvider(): PaymentProvider {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (token && token.trim() !== '') {
      return new MercadoPagoProvider(token);
    }
    return new SandboxPaymentProvider();
  }
}
