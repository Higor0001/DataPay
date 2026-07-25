import QRCode from 'qrcode';

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
  const cleanKey = key ? key.trim() : 'financeiro@datapay.com';
  const cleanName = (name || 'DATAPAY').normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase().trim();
  const cleanCity = (city || 'SAO PAULO').normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15).toUpperCase().trim();
  const valStr = (amount || 0).toFixed(2);

  const merchantAccountInfo = `0014br.gov.bcb.pix01${cleanKey.length.toString().padStart(2, '0')}${cleanKey}`;
  
  let payload = '000201';
  payload += `26${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}`;
  payload += '52040000';
  payload += '5303986';
  if (amount > 0) {
    payload += `54${valStr.length.toString().padStart(2, '0')}${valStr}`;
  }
  payload += '5802BR';
  payload += `59${cleanName.length.toString().padStart(2, '0')}${cleanName}`;
  payload += `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}`;
  payload += '62070503***';
  payload += '6304';

  const crc = crc16ccitt(payload);
  return payload + crc;
}

/**
 * Converte exatamente a chave ou texto fornecido no formato de Payload EMV oficial se for chave simples,
 * ou mantém o texto bruto se já for um payload/linha digitável.
 */
export function ensureAuthenticPixEMV(inputStr: string, amount = 10, keyOrName = 'DataPay'): string {
  if (!inputStr || !inputStr.trim()) {
    return getStaticPixPayload(amount, 'financeiro@datapay.com', keyOrName, 'SAO PAULO');
  }

  const clean = inputStr.trim();

  // Se já for um payload EMV Pix completo (começa com 000201)
  if (clean.startsWith('000201')) {
    return clean;
  }

  // Se for uma Linha Digitável de Boleto (números puros de 44 a 48 dígitos)
  const digitsOnly = clean.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 44 && digitsOnly.length <= 48) {
    return clean;
  }

  // Caso contrário, se for chave simples (e-mail, CPF, celular, etc), gera EMV estático
  return getStaticPixPayload(amount, clean, keyOrName, 'SAO PAULO');
}

/**
 * Pega exatamente o texto bruto passado e converte DIRETA E FIELMENTE em uma imagem PNG de QR Code.
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
 * Gera uma string SVG limpa codificando EXATAMENTE o texto bruto.
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
 * Retorna o código Pix estático para a chave fornecida
 */
export function getPixCopyPasteCode(amount: number, description = 'DataPay', pixKey?: string): string {
  const targetKey = pixKey && pixKey.trim() ? pixKey.trim() : 'financeiro@datapay.com';
  return getStaticPixPayload(amount, targetKey, description, 'SAO PAULO');
}
