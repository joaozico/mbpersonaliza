import { BoletoTitulo, BoletoBillingSettings } from '../types';

/**
 * Utilitário FEBRABAN para geração e validação de Boletos Bancários
 * Suporta emissão de Boletos à Vista e Faturados a Prazo vinculados
 */

// Módulo 10 para blocos da Linha Digitável
function modulo10(bloco: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = bloco.length - 1; i >= 0; i--) {
    let mul = parseInt(bloco.charAt(i), 10) * peso;
    if (mul > 9) {
      mul = Math.floor(mul / 10) + (mul % 10);
    }
    soma += mul;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

// Módulo 11 para o dígito verificador geral do Código de Barras
function modulo11(codigo43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = codigo43.length - 1; i >= 0; i--) {
    soma += parseInt(codigo43.charAt(i), 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

// Fator de vencimento FEBRABAN (dias desde a data base 07/10/1997)
export function calcularFatorVencimento(dataVencimentoStr: string): string {
  const dataBase = new Date(1997, 9, 7); // 07/10/1997
  const venc = new Date(dataVencimentoStr);
  const diffTime = venc.getTime() - dataBase.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1000, Math.min(9999, diffDays)).toString().padStart(4, '0');
}

/**
 * Gera Código de Barras (44 posições) e Linha Digitável (47 posições formatadas)
 */
export function gerarLinhaDigitavelEBarra(params: {
  bancoCodigo: string; // "341"
  moeda: string; // "9" (Real)
  fatorVencimento: string; // "9845"
  valorCentavos: number; // ex: 15000 (R$ 150,00)
  carteira: string; // "109"
  nossoNumero8Digitos: string; // ex: "98234123"
  agencia: string; // "1234"
  conta: string; // "56789"
}): { linhaDigitavel: string; codigoBarras: string } {
  const {
    bancoCodigo = '341',
    moeda = '9',
    fatorVencimento,
    valorCentavos,
    carteira = '109',
    nossoNumero8Digitos,
    agencia = '0104',
    conta = '35100',
  } = params;

  const valorFormatado = Math.round(valorCentavos).toString().padStart(10, '0');
  const campoLivre = `${carteira}${nossoNumero8Digitos}${agencia}${conta}0`;

  // Montagem do código de barras sem o DV geral (43 dígitos)
  const cbSemDv = `${bancoCodigo}${moeda}${fatorVencimento}${valorFormatado}${campoLivre}`;
  const dvGeral = modulo11(cbSemDv);
  // Código de barras completo de 44 posições
  const codigoBarras = `${bancoCodigo}${moeda}${dvGeral}${fatorVencimento}${valorFormatado}${campoLivre}`;

  // Montagem dos 3 campos da linha digitável com seus respectivos DVs módulo 10
  // Campo 1: Banco (3) + Moeda (1) + Primeiras 5 posições do campo livre + DV
  const campo1SemDv = `${bancoCodigo}${moeda}${campoLivre.substring(0, 5)}`;
  const dv1 = modulo10(campo1SemDv);
  const campo1 = `${campo1SemDv.substring(0, 5)}.${campo1SemDv.substring(5)}${dv1}`;

  // Campo 2: Posições 6 a 15 do campo livre + DV
  const campo2SemDv = campoLivre.substring(5, 15);
  const dv2 = modulo10(campo2SemDv);
  const campo2 = `${campo2SemDv.substring(0, 5)}.${campo2SemDv.substring(5)}${dv2}`;

  // Campo 3: Posições 16 a 25 do campo livre + DV
  const campo3SemDv = campoLivre.substring(15, 25);
  const dv3 = modulo10(campo3SemDv);
  const campo3 = `${campo3SemDv.substring(0, 5)}.${campo3SemDv.substring(5)}${dv3}`;

  // Campo 4: Dígito verificador geral (1 dígito)
  const campo4 = `${dvGeral}`;

  // Campo 5: Fator de vencimento (4) + Valor (10)
  const campo5 = `${fatorVencimento}${valorFormatado}`;

  const linhaDigitavel = `${campo1} ${campo2} ${campo3} ${campo4} ${campo5}`;

  return { linhaDigitavel, codigoBarras };
}

/**
 * Cria a data de vencimento adicionando dias corridos ou úteis
 */
export function calcularDataVencimento(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, dias));
  return d.toISOString().split('T')[0];
}

/**
 * Gera um título de Boleto completo conforme as regras da MB Personaliza
 */
export function criarBoletoTitulo(params: {
  orderId: string;
  orderCode: string;
  quoteId?: string;
  quoteCode?: string;
  customerName: string;
  customerCpfCnpj: string;
  customerEmail?: string;
  customerAddress?: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  installmentNumber: number;
  totalInstallments: number;
  conditionName: string;
  tipoCobranca: 'a_vista' | 'faturado_prazo';
  settings?: BoletoBillingSettings;
}): BoletoTitulo {
  const now = new Date();
  const idSeq = Math.floor(100000 + Math.random() * 900000);
  const boletoId = `bol-${now.getFullYear()}-${idSeq}`;

  // Identificação do Sacado (PF ou PJ)
  const cleanDoc = params.customerCpfCnpj.replace(/\D/g, '');
  const isPJ = cleanDoc.length > 11;
  const sacadoTipo: 'PF' | 'PJ' = isPJ ? 'PJ' : 'PF';

  // Configurações e Banco
  const bancoCodigo = params.settings?.defaultBankCode || '341';
  const bancoEmissor = params.settings?.defaultBankName || '341 - Banco Itaú Unibanco S.A.';
  const carteira = params.settings?.carteira || '109';
  const multaPercentual = params.settings?.finePercent ?? 2.0;
  const jurosMensalPercentual = params.settings?.monthlyInterestPercent ?? 1.0;

  // Nosso Número: 8 dígitos gerados + 1 DV
  const numRandom = Math.floor(10000000 + Math.random() * 90000000).toString();
  const dvNossoNumero = modulo10(`${carteira}${numRandom}`);
  const nossoNumero = `${carteira}/${numRandom}-${dvNossoNumero}`;

  const fatorVenc = calcularFatorVencimento(params.dueDate);
  const valorCentavos = Math.round(params.amount * 100);

  const { linhaDigitavel, codigoBarras } = gerarLinhaDigitavelEBarra({
    bancoCodigo,
    moeda: '9',
    fatorVencimento: fatorVenc,
    valorCentavos,
    carteira,
    nossoNumero8Digitos: numRandom,
    agencia: '0104',
    conta: '35100',
  });

  const instrucoes: string[] = [
    `Após o vencimento de ${params.dueDate.split('-').reverse().join('/')}, cobrar multa de ${multaPercentual.toFixed(1)}% e juros de mora de ${jurosMensalPercentual.toFixed(1)}% ao mês.`,
    params.tipoCobranca === 'faturado_prazo'
      ? `Faturamento a Prazo Autorizado vinculado à Proposta/Orçamento ${params.quoteCode || 'Comercial'}. Parcela ${params.installmentNumber} de ${params.totalInstallments}.`
      : 'Pagamento à vista exclusivo para liquidação de pedido de compras comuns.',
    'Não receber após 30 dias de vencimento. Pagável em qualquer agência bancária ou internet banking até o vencimento.',
  ];

  return {
    id: boletoId,
    nossoNumero,
    linhaDigitavel,
    codigoBarras,
    bancoEmissor,
    bancoCodigo,
    carteira,
    especieDoc: 'DM',
    aceite: 'N',
    dataEmissao: now.toISOString(),
    dataVencimento: params.dueDate,
    dataProcessamento: now.toISOString(),
    valorOriginal: Number(params.amount.toFixed(2)),
    saldoAberto: Number(params.amount.toFixed(2)),
    status: 'pendente',
    tipoCobranca: params.tipoCobranca,
    parcelaNumero: params.installmentNumber,
    totalParcelas: params.totalInstallments,
    condicaoPagamento: params.conditionName,
    orderId: params.orderId,
    orderCode: params.orderCode,
    quoteId: params.quoteId,
    quoteCode: params.quoteCode,
    sacadoNome: params.customerName,
    sacadoCpfCnpj: params.customerCpfCnpj,
    sacadoTipo,
    sacadoEndereco: params.customerAddress || 'Endereço Comercial / Cadastrado do Cliente',
    sacadoEmail: params.customerEmail,
    beneficiarioNome: 'MB Personaliza Brindes Corporativos Ltda',
    beneficiarioCnpj: '45.123.789/0001-88',
    beneficiarioEndereco: 'Rua das Flores, 123 - Centro, São Paulo - SP - CEP 01001-000',
    multaPercentual,
    jurosMensalPercentual,
    instrucoes,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
