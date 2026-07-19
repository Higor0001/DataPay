/**
 * Gera um caminho SVG estruturado para renderizar um QR Code realista em tela.
 * Inclui os 3 padrões de busca (quadrados finder patterns) padrão nos cantos superiores e inferior esquerdo.
 */
export function generatePixQRCodeSVG(text: string, size = 256): { svgPath: string; viewBox: string; matrixSize: number } {
  // Cria uma matriz 29x29 (QR Code Versão 3)
  const matrixSize = 29;
  const matrix: boolean[][] = Array(matrixSize)
    .fill(null)
    .map(() => Array(matrixSize).fill(false));

  // Função auxiliar para pintar blocos na matriz
  const drawRect = (x: number, y: number, w: number, h: number, value: boolean) => {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (r >= 0 && r < matrixSize && c >= 0 && c < matrixSize) {
          matrix[r][c] = value;
        }
      }
    }
  };

  // Desenha os padrões de busca (7x7 externo, 5x5 branco interno, 3x3 preto interno)
  const drawFinderPattern = (x: number, y: number) => {
    drawRect(x, y, 7, 7, true);
    drawRect(x + 1, y + 1, 5, 5, false);
    drawRect(x + 2, y + 2, 3, 3, true);
  };

  // 1. Canto Superior Esquerdo
  drawFinderPattern(0, 0);
  // 2. Canto Superior Direito
  drawFinderPattern(matrixSize - 7, 0);
  // 3. Canto Inferior Esquerdo
  drawFinderPattern(0, matrixSize - 7);

  // Desenha o padrão de alinhamento (5x5, 3x3 branco, 1x1 preto) nas coordenadas (18, 18)
  const ax = matrixSize - 9;
  const ay = matrixSize - 9;
  drawRect(ax, ay, 5, 5, true);
  drawRect(ax + 1, ay + 1, 3, 3, false);
  drawRect(ax + 2, ay + 2, 1, 1, true);

  // Gerador de números pseudo-aleatórios determinísticos baseados em um hash da string
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }

  const getBit = (index: number) => {
    const val = Math.abs(Math.sin(hash + index) * 10000);
    return (val - Math.floor(val)) > 0.5;
  };

  // Preenche as áreas restantes da matriz (excluindo os buscadores e padrões de alinhamento)
  let cellIndex = 0;
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Evita pintar por cima dos localizadores e áreas de alinhamento
      if (r < 8 && c < 8) continue;
      if (r < 8 && c >= matrixSize - 8) continue;
      if (r >= matrixSize - 8 && c < 8) continue;
      if (r >= ay && r < ay + 5 && c >= ax && c < ax + 5) continue;

      // Linhas de sincronização (linha horizontal em y=6, vertical em x=6)
      if (r === 6 || c === 6) {
        matrix[r][c] = (r === 6 ? c : r) % 2 === 0;
        continue;
      }

      // Preenche com bit pseudo-aleatório baseado no conteúdo
      matrix[r][c] = getBit(cellIndex++);
    }
  }

  // Monta a string de dados do path SVG
  let path = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        path += `M${c},${r}h1v1h-1z `;
      }
    }
  }

  return {
    svgPath: path,
    viewBox: `0 0 ${matrixSize} ${matrixSize}`,
    matrixSize
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
