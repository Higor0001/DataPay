/**
 * PARSER DE EXTRATO BANCÁRIO OFX (Open Financial Exchange)
 * Utilitário 100% gratuito e client-side para processar extratos bancários de bancos brasileiros.
 */

export interface OfxTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'DEBIT' | 'CREDIT' | 'OTHER';
}

export function extractBankFromOFX(ofxContent: string): string | null {
  const orgMatch = ofxContent.match(/<ORG>([^<\n\r]+)/i);
  if (orgMatch) {
    let org = orgMatch[1].trim();
    if (org.includes('</ORG>')) {
      org = org.split('</ORG>')[0].trim();
    }
    // Simplifica nomes conhecidos
    const upperOrg = org.toUpperCase();
    if (upperOrg.includes('ITAU')) return 'Itaú';
    if (upperOrg.includes('NUBANK')) return 'Nubank';
    if (upperOrg.includes('BRADESCO')) return 'Bradesco';
    if (upperOrg.includes('SANTANDER')) return 'Santander';
    if (upperOrg.includes('CAIXA')) return 'Caixa';
    if (upperOrg.includes('BRASIL')) return 'Banco do Brasil';
    if (upperOrg.includes('INTER')) return 'Banco Inter';
    if (upperOrg.includes('C6')) return 'C6 Bank';
    return org;
  }
  return null;
}

export function parseOFX(ofxContent: string): OfxTransaction[] {
  const transactions: OfxTransaction[] = [];
  
  // Captura os blocos de transações <STMTTRN>...</STMTTRN>
  const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = transactionRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    
    // Expressões regulares para capturar os valores das tags OFX
    // O padrão OFX pode ter tags que fecham (ex: <MEMO>texto</MEMO>) ou não (ex: <MEMO>texto)
    const trntype = extractTagValue(block, 'TRNTYPE');
    const dtposted = extractTagValue(block, 'DTPOSTED'); // Formato: YYYYMMDD...
    const trnamt = extractTagValue(block, 'TRNAMT');
    const fitid = extractTagValue(block, 'FITID');
    const memo = extractTagValue(block, 'MEMO') || extractTagValue(block, 'NAME') || 'Transação Bancária';

    if (dtposted && trnamt) {
      // Formata a data (YYYYMMDD para YYYY-MM-DD)
      const year = dtposted.substring(0, 4);
      const month = dtposted.substring(4, 6);
      const day = dtposted.substring(6, 8);
      const formattedDate = `${year}-${month}-${day}`;

      // Converte o valor numérico
      const amountValue = parseFloat(trnamt.replace(',', '.'));

      transactions.push({
        id: fitid || Math.random().toString(36).substring(2, 9),
        date: formattedDate,
        amount: amountValue,
        description: cleanString(memo),
        type: amountValue < 0 ? 'DEBIT' : 'CREDIT'
      });
    }
  }

  return transactions;
}

/**
 * Extrai o valor de uma tag OFX limpando tags de fechamento
 */
function extractTagValue(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\n\\r]+)`);
  const match = block.match(regex);
  if (!match) return null;
  
  let value = match[1].trim();
  
  // Limpa possíveis fechamentos de tag (ex: </MEMO>)
  if (value.includes(`</${tag}>`)) {
    value = value.split(`</${tag}>`)[0].trim();
  }
  
  return value;
}

/**
 * Remove caracteres especiais e espaços excessivos
 */
function cleanString(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
