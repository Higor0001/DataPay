import { EMVDecodedPayload } from '../types/centralPix';

/**
 * Calcula o CRC16-CCITT (Polinômio 0x1021, Valor Inicial 0xFFFF)
 * conforme a especificação oficial EMV do Banco Central do Brasil para Pix.
 */
export function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Faz o unpack de uma substring TLV (Type-Length-Value).
 */
function parseSubTags(payload: string): Record<string, string> {
  const result: Record<string, string> = {};
  let idx = 0;
  while (idx < payload.length - 3) {
    const tag = payload.substring(idx, idx + 2);
    const lenStr = payload.substring(idx + 2, idx + 4);
    const len = parseInt(lenStr, 10);
    if (isNaN(len) || idx + 4 + len > payload.length) {
      break;
    }
    const val = payload.substring(idx + 4, idx + 4 + len);
    result[tag] = val;
    idx += 4 + len;
  }
  return result;
}

/**
 * Super-Decoder EMV Pix ("Zero-Private-API").
 * Transforma uma string raw '000201...' numa Abstract Syntax Tree (AST) e estrutura de dados limpa.
 */
export function decodeEMVPix(rawPayload: string): { valid: boolean; error?: string; decoded: EMVDecodedPayload } {
  const cleanPayload = rawPayload.trim();

  // Validação básica do cabeçalho
  if (!cleanPayload.startsWith('000201') && !cleanPayload.includes('br.gov.bcb.pix')) {
    return {
      valid: false,
      error: 'Formato Pix EMV inválido. O payload deve começar com 000201.',
      decoded: {
        formatIndicator: '01',
        merchantInfo: {},
        currency: '986',
        countryCode: 'BR',
        merchantName: 'Desconhecido',
        merchantCity: 'Brasil',
        crc16: '',
        crcValid: false,
        isDynamic: false
      }
    };
  }

  // Iteração TLV principal
  const tags: Record<string, string> = {};
  let idx = 0;

  while (idx < cleanPayload.length) {
    if (idx + 4 > cleanPayload.length) break;
    const tag = cleanPayload.substring(idx, idx + 2);
    const lenStr = cleanPayload.substring(idx + 2, idx + 4);
    const len = parseInt(lenStr, 10);

    if (isNaN(len)) break;

    // Se for a tag 63 (CRC), pegamos apenas o valor especificado ou até o fim
    if (tag === '63') {
      tags['63'] = cleanPayload.substring(idx + 4, idx + 4 + len);
      break;
    }

    if (idx + 4 + len > cleanPayload.length) break;
    const value = cleanPayload.substring(idx + 4, idx + 4 + len);
    tags[tag] = value;
    idx += 4 + len;
  }

  // Verificação de CRC16
  let crcValid = false;
  const crcPos = cleanPayload.indexOf('6304');
  let expectedCrc = '';

  if (crcPos !== -1 && crcPos + 8 <= cleanPayload.length) {
    const payloadWithoutCrcValue = cleanPayload.substring(0, crcPos + 4);
    expectedCrc = cleanPayload.substring(crcPos + 4, crcPos + 8).toUpperCase();
    const calculatedCrc = calculateCRC16(payloadWithoutCrcValue);
    crcValid = calculatedCrc === expectedCrc;
  }

  // Decodifica Tag 26 (Merchant Account Information)
  const tag26 = tags['26'] || '';
  const subTag26 = parseSubTags(tag26);
  const gui = subTag26['00'];
  const key = subTag26['01'];
  const dynamicUrl = subTag26['25'];
  const isDynamic = Boolean(dynamicUrl);

  // Decodifica Tag 62 (Additional Data Field Template - TXID)
  const tag62 = tags['62'] || '';
  const subTag62 = parseSubTags(tag62);
  const txid = subTag62['05'];

  // Extração de Valor (Tag 54)
  let amount: number | undefined;
  if (tags['54']) {
    const parsedAmt = parseFloat(tags['54']);
    if (!isNaN(parsedAmt)) {
      amount = parsedAmt;
    }
  }

  const decoded: EMVDecodedPayload = {
    formatIndicator: tags['00'] || '01',
    merchantInfo: {
      gui,
      key,
      url: dynamicUrl,
      rawTag26: tag26
    },
    mcc: tags['52'],
    currency: tags['53'] || '986',
    amount,
    countryCode: tags['58'] || 'BR',
    merchantName: tags['59'] ? tags['59'].trim() : 'Recebedor Pix',
    merchantCity: tags['60'] ? tags['60'].trim() : 'Brasil',
    additionalData: {
      txid,
      rawTag62: tag62
    },
    crc16: expectedCrc || tags['63'] || '',
    crcValid,
    isDynamic
  };

  return {
    valid: true,
    decoded
  };
}
