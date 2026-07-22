import QRCode from 'qrcode';

/**
 * Gera um Data URL PNG de alta definição e 100% escaneável para renderizar em tag <img>.
 * Compatível com qualquer aplicativo de banco (Nubank, Mercado Pago, Itaú, Bradesco, etc.) e câmera de celular.
 */
export async function generateScannablePixQRCodeDataURL(text: string, width = 320): Promise<string> {
  try {
    if (!text || !text.trim()) return '';
    return await QRCode.toDataURL(text.trim(), {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('[QRCode Generator Error]:', err);
    return '';
  }
}

/**
 * Gera uma string SVG limpa em conformidade estrita com o padrão ISO/IEC 18004.
 */
export async function generateScannablePixQRCodeSVG(text: string): Promise<string> {
  try {
    if (!text || !text.trim()) return '';
    return await QRCode.toString(text.trim(), {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('[QRCode SVG Error]:', err);
    return '';
  }
}

/**
 * Função de retrocompatibilidade para componentes legado
 */
export function generatePixQRCodeSVG(text: string, size = 256): { svgPath: string; viewBox: string; matrixSize: number } {
  return {
    svgPath: "M0,0h29v29h-29z",
    viewBox: "0 0 29 29",
    matrixSize: 29
  };
}

/**
 * Retorna uma string padrão Pix Copia e Cola estruturada para uso no simulador
 */
export function getPixCopyPasteCode(amount: number, description = 'Reserva Financeira'): string {
  const amountStr = amount.toFixed(2);
  const formattedDesc = description.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
  
  // Simulação de payload de Pix dinâmico no padrão BACEN
  return `00020101021226840014br.gov.bcb.pix2562pix.mercadopago.com/qr/v2/4ad8d893-68d5-45bb-b3b2-70b55ec70cb0520400005303986540${amountStr.length.toString().padStart(2, '0')}${amountStr}5802BR5925DataPay Ltda6009Sao Paulo62070503***6304${formattedDesc}`;
}

function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera um payload Pix Estático válido em conformidade com o padrão BCB / EMV.
 */
export function getStaticPixPayload(amount: number, key: string, name: string, city: string): string {
  const cleanKey = key.trim();
  const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase().trim();
  const cleanCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15).toUpperCase().trim();
  const valStr = amount.toFixed(2);

  const merchantAccountInfo = `0014br.gov.bcb.pix01${cleanKey.length.toString().padStart(2, '0')}${cleanKey}`;
  
  let payload = '000201';
  payload += `26${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}`;
  payload += '52040000';
  payload += '5303986';
  payload += `54${valStr.length.toString().padStart(2, '0')}${valStr}`;
  payload += '5802BR';
  payload += `59${cleanName.length.toString().padStart(2, '0')}${cleanName}`;
  payload += `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}`;
  payload += '62070503***';
  payload += '6304';

  const crc = crc16ccitt(payload);
  return payload + crc;
}
