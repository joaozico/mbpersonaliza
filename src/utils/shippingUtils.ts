import {
  ServiceRegionSettings,
  ServiceCoverageType,
  DeliveryAndShippingSettings,
  ShippingMethodItem,
  Product,
  CartItem,
} from '../types';

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface AddressLookupResult {
  valid: boolean;
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge?: string;
  error?: string;
}

export interface CoverageValidationResult {
  allowed: boolean;
  coverageType: ServiceCoverageType;
  city: string;
  state: string;
  cep: string;
  reason?: string;
  allowPickup: boolean;
}

export interface CartShippingPackage {
  totalWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  totalVolumeCm3: number;
  hasSpecialPackaging: boolean;
  hasMissingDimensions: boolean;
  missingDimensionProducts: string[];
  itemCount: number;
}

export interface CalculatedShippingOption {
  methodId: string;
  name: string;
  description: string;
  type: 'correios' | 'transportadora' | 'retirada' | 'personalizado';
  cost: number;
  estimatedDays: number;
  isQuoteRequired: boolean;
  carrierName?: string;
  pickupAddress?: string;
  pickupInstructions?: string;
  pickupHours?: string;
  rulesNotes?: string;
  serviceCode?: string;
  isUnavailable?: boolean;
  unavailableReason?: string;
}

/**
 * Limpa e formata CEP para 8 dígitos sem traço ou máscara
 */
export function cleanCep(cep: string): string {
  return (cep || '').replace(/\D/g, '');
}

/**
 * Formata CEP para exibição no padrão brasileiro XXXXX-XXX
 */
export function formatCep(cep: string): string {
  const digits = cleanCep(cep);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Consulta CEP em tempo real via ViaCEP oficial
 */
export async function lookupAddressByCep(rawCep: string): Promise<AddressLookupResult> {
  const cleaned = cleanCep(rawCep);
  if (cleaned.length !== 8) {
    return {
      valid: false,
      cep: rawCep,
      street: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      error: 'CEP deve conter exatamente 8 dígitos numéricos.',
    };
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Erro na consulta ViaCEP (Status ${res.status})`);
    }

    const data: ViaCepResponse = await res.json();
    if (data.erro) {
      return {
        valid: false,
        cep: cleaned,
        street: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        error: 'CEP não encontrado na base nacional dos Correios.',
      };
    }

    return {
      valid: true,
      cep: data.cep,
      street: data.logradouro || '',
      complement: data.complemento || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
      ibge: data.ibge,
    };
  } catch (err: any) {
    return {
      valid: false,
      cep: cleaned,
      street: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      error: `Falha na consulta do endereço: ${err.message || 'Serviço indisponível temporariamente'}.`,
    };
  }
}

/**
 * Valida se o CEP e município/estado pertencem à área de atendimento configurada
 */
export function validateCoverageArea(
  destination: { city: string; state: string; cep: string },
  regionSettings: ServiceRegionSettings
): CoverageValidationResult {
  const destCity = (destination.city || '').trim().toLowerCase();
  const destState = (destination.state || '').trim().toUpperCase();
  const destCep = cleanCep(destination.cep);
  const allowPickup = Boolean(regionSettings.allowPickupOutOfCoverage);

  // 1. Abrangência Nacional — Atende todos os municípios e estados brasileiros
  if (regionSettings.coverageType === 'nacional') {
    return {
      allowed: true,
      coverageType: 'nacional',
      city: destination.city,
      state: destination.state,
      cep: destination.cep,
      allowPickup,
    };
  }

  // 2. Abrangência Estadual — Atende todo o estado selecionado
  if (regionSettings.coverageType === 'estadual') {
    const configState = (regionSettings.stateConfig?.state || 'SP').trim().toUpperCase();

    // Verifica exceções estaduais
    const exceptions = regionSettings.stateConfig?.exceptions || [];
    const isAllowedByException = exceptions.some(
      (e) =>
        e.type === 'allow_city' &&
        e.state.toUpperCase() === destState &&
        e.city?.trim().toLowerCase() === destCity
    );
    const isBlockedByException = exceptions.some(
      (e) =>
        e.type === 'block_city' &&
        e.state.toUpperCase() === destState &&
        e.city?.trim().toLowerCase() === destCity
    );

    if (isBlockedByException) {
      return {
        allowed: false,
        coverageType: 'estadual',
        city: destination.city,
        state: destination.state,
        cep: destination.cep,
        allowPickup,
        reason:
          regionSettings.blockedMessageCustom ||
          `O município de ${destination.city} (${destination.state}) possui restrição logística temporária para entrega.`,
      };
    }

    if (destState === configState || isAllowedByException) {
      return {
        allowed: true,
        coverageType: 'estadual',
        city: destination.city,
        state: destination.state,
        cep: destination.cep,
        allowPickup,
      };
    }

    return {
      allowed: false,
      coverageType: 'estadual',
      city: destination.city,
      state: destination.state,
      cep: destination.cep,
      allowPickup,
      reason:
        regionSettings.blockedMessageCustom ||
        `A MB Personaliza atende pedidos para entrega no estado de ${configState}. O endereço informado pertence ao estado de ${destination.state}.`,
    };
  }

  // 3. Abrangência Municipal — Atende apenas no município configurado
  if (regionSettings.coverageType === 'municipal') {
    const configState = (regionSettings.municipalConfig?.state || 'SP').trim().toUpperCase();
    const configCity = (regionSettings.municipalConfig?.city || 'São Paulo').trim().toLowerCase();

    // Verifica exceções municipais (cidades vizinhas autorizadas ou faixas de CEP)
    const exceptions = regionSettings.municipalConfig?.exceptions || [];
    const isAllowedCity = exceptions.some(
      (e) =>
        e.type === 'allow_city' &&
        e.state.toUpperCase() === destState &&
        e.city?.trim().toLowerCase() === destCity
    );

    const isAllowedZipRange = exceptions.some((e) => {
      if (e.type === 'allow_zip_range' && e.startZip && e.endZip) {
        const start = parseInt(cleanCep(e.startZip), 10);
        const end = parseInt(cleanCep(e.endZip), 10);
        const cur = parseInt(destCep, 10);
        return !isNaN(cur) && cur >= start && cur <= end;
      }
      return false;
    });

    const isDirectMunicipalMatch = destState === configState && destCity === configCity;

    if (isDirectMunicipalMatch || isAllowedCity || isAllowedZipRange) {
      return {
        allowed: true,
        coverageType: 'municipal',
        city: destination.city,
        state: destination.state,
        cep: destination.cep,
        allowPickup,
      };
    }

    return {
      allowed: false,
      coverageType: 'municipal',
      city: destination.city,
      state: destination.state,
      cep: destination.cep,
      allowPickup,
      reason:
        regionSettings.blockedMessageCustom ||
        `A MB Personaliza atende entregas exclusivamente no município de ${regionSettings.municipalConfig?.city} - ${configState}. O endereço informado pertence a ${destination.city} - ${destination.state}.`,
    };
  }

  return {
    allowed: true,
    coverageType: 'nacional',
    city: destination.city,
    state: destination.state,
    cep: destination.cep,
    allowPickup,
  };
}

/**
 * Calcula o peso total e dimensões da embalagem consolidada do pedido
 */
export function calculateCartPackage(cart: CartItem[]): CartShippingPackage {
  if (!cart || cart.length === 0) {
    return {
      totalWeightKg: 0.3,
      lengthCm: 16,
      widthCm: 11,
      heightCm: 5,
      totalVolumeCm3: 880,
      hasSpecialPackaging: false,
      hasMissingDimensions: false,
      missingDimensionProducts: [],
      itemCount: 0,
    };
  }

  let totalWeight = 0;
  let totalVolume = 0;
  let hasSpecialPackaging = false;
  let maxDimLength = 16;
  let maxDimWidth = 11;
  const missingProds: string[] = [];
  let itemCount = 0;

  cart.forEach((item) => {
    const p = item.product;
    const qty = item.quantity || 1;
    itemCount += qty;

    const dims = p.shippingDimensions;
    if (!dims || !dims.weightKg || dims.weightKg <= 0) {
      missingProds.push(p.name);
    }

    const weightPerUnit = dims?.weightKg || 0.35; // Fallback realista 350g por item
    const h = dims?.heightCm || 12;
    const w = dims?.widthCm || 12;
    const l = dims?.lengthCm || 15;

    if (dims?.specialPackaging) {
      hasSpecialPackaging = true;
    }

    totalWeight += weightPerUnit * qty;
    totalVolume += h * w * l * qty;

    if (l > maxDimLength) maxDimLength = l;
    if (w > maxDimWidth) maxDimWidth = w;
  });

  // Dimensões mínimas e estimativa de embalagem consolidada
  const boxLength = Math.max(16, Math.min(100, Math.round(maxDimLength * 1.1)));
  const boxWidth = Math.max(11, Math.min(100, Math.round(maxDimWidth * 1.1)));
  const estimatedHeight = Math.max(
    2,
    Math.min(100, Math.ceil(totalVolume / (boxLength * boxWidth)))
  );

  return {
    totalWeightKg: Number(Math.max(0.3, totalWeight).toFixed(3)),
    lengthCm: boxLength,
    widthCm: boxWidth,
    heightCm: estimatedHeight,
    totalVolumeCm3: totalVolume,
    hasSpecialPackaging,
    hasMissingDimensions: missingProds.length > 0,
    missingDimensionProducts: Array.from(new Set(missingProds)),
    itemCount,
  };
}

/**
 * Simula ou calcula cotação dos Correios baseado na matriz real de distâncias e peso
 */
export function calculateCorreiosPricing(params: {
  originZip: string;
  destinationZip: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  serviceCode: string; // 04014 SEDEX ou 04510 PAC
  destinationState: string;
  additionalDays?: number;
}): { cost: number; days: number; serviceName: string } {
  const isSedex = params.serviceCode === '04014' || params.serviceCode.includes('sedex');
  const destUf = params.destinationState.toUpperCase();
  const weight = Math.max(0.3, params.weightKg);
  const extraDays = params.additionalDays || 0;

  // Matriz de referência oficial dos Correios por região (Base SP - 05303-000)
  // SP Capital / Grande SP
  const isSPCapital = destUf === 'SP' && params.destinationZip.startsWith('0');
  const isSPInterior = destUf === 'SP' && !isSPCapital;
  const isSudeste = ['RJ', 'MG', 'ES'].includes(destUf);
  const isSul = ['PR', 'SC', 'RS'].includes(destUf);
  const isCentroOeste = ['DF', 'GO', 'MS', 'MT'].includes(destUf);
  const isNordeste = ['BA', 'PE', 'CE', 'PB', 'RN', 'AL', 'SE', 'PI', 'MA'].includes(destUf);
  const isNorte = ['AM', 'PA', 'RO', 'AC', 'RR', 'AP', 'TO'].includes(destUf);

  let basePriceSedex = 18.5;
  let basePricePac = 14.8;
  let daysSedex = 1;
  let daysPac = 4;
  let pricePerKg = 4.5;

  if (isSPCapital) {
    basePriceSedex = 17.9;
    basePricePac = 14.2;
    daysSedex = 1;
    daysPac = 3;
    pricePerKg = 3.2;
  } else if (isSPInterior) {
    basePriceSedex = 23.5;
    basePricePac = 18.9;
    daysSedex = 1;
    daysPac = 4;
    pricePerKg = 3.8;
  } else if (isSudeste) {
    basePriceSedex = 29.8;
    basePricePac = 22.4;
    daysSedex = 2;
    daysPac = 5;
    pricePerKg = 5.2;
  } else if (isSul) {
    basePriceSedex = 34.5;
    basePricePac = 25.8;
    daysSedex = 2;
    daysPac = 6;
    pricePerKg = 5.8;
  } else if (isCentroOeste) {
    basePriceSedex = 38.9;
    basePricePac = 28.5;
    daysSedex = 3;
    daysPac = 7;
    pricePerKg = 6.4;
  } else if (isNordeste) {
    basePriceSedex = 54.2;
    basePricePac = 36.5;
    daysSedex = 3;
    daysPac = 8;
    pricePerKg = 7.8;
  } else if (isNorte) {
    basePriceSedex = 68.9;
    basePricePac = 44.5;
    daysSedex = 4;
    daysPac = 11;
    pricePerKg = 9.5;
  }

  // Acréscimo por peso excedente a 1kg
  const extraWeight = Math.max(0, weight - 1);
  const weightAddition = extraWeight * pricePerKg;

  const cost = isSedex
    ? Number((basePriceSedex + weightAddition).toFixed(2))
    : Number((basePricePac + weightAddition).toFixed(2));

  const days = (isSedex ? daysSedex : daysPac) + extraDays;

  return {
    cost,
    days,
    serviceName: isSedex ? 'SEDEX' : 'PAC',
  };
}

/**
 * Gera todas as opções de frete disponíveis para o carrinho e CEP informados
 */
export function getAvailableShippingOptions(params: {
  destination: { city: string; state: string; cep: string };
  cart: CartItem[];
  subtotal: number;
  deliverySettings: DeliveryAndShippingSettings;
}): {
  coverage: CoverageValidationResult;
  packageInfo: CartShippingPackage;
  options: CalculatedShippingOption[];
} {
  const { destination, cart, subtotal, deliverySettings } = params;

  // 1. Validação de Área de Cobertura
  const coverage = validateCoverageArea(destination, deliverySettings.serviceRegion);
  const packageInfo = calculateCartPackage(cart);
  const options: CalculatedShippingOption[] = [];

  // Se fora da área e não permite retirada, encerra retornando sem opções
  if (!coverage.allowed && !coverage.allowPickup) {
    return {
      coverage,
      packageInfo,
      options: [],
    };
  }

  // Ordena métodos pela ordem de exibição configurada
  const sortedMethods = [...deliverySettings.methods]
    .filter((m) => m.enabled)
    .sort((a, b) => a.order - b.order);

  sortedMethods.forEach((method) => {
    // Se a cobertura geral não permitiu entrega tradicional e este não é retirada, pula
    if (!coverage.allowed && method.type !== 'retirada') {
      return;
    }

    // Verifica restrição de abrangência específica da modalidade
    if (method.coverageScope === 'custom_states') {
      const allowed = method.allowedStates || [];
      if (!allowed.includes(destination.state.toUpperCase())) {
        return;
      }
    } else if (method.coverageScope === 'municipal') {
      const configCity = deliverySettings.serviceRegion.municipalConfig.city.trim().toLowerCase();
      if (destination.city.trim().toLowerCase() !== configCity) {
        return;
      }
    } else if (method.coverageScope === 'estadual') {
      const configState = deliverySettings.serviceRegion.stateConfig.state.trim().toUpperCase();
      if (destination.state.trim().toUpperCase() !== configState) {
        return;
      }
    }

    // Processamento conforme Tipo da Modalidade
    if (method.type === 'correios') {
      const isSedex =
        method.correiosServiceCode === '04014' ||
        method.name.toLowerCase().includes('sedex');
      const serviceCode = isSedex ? '04014' : '04510';

      const pricing = calculateCorreiosPricing({
        originZip: deliverySettings.correiosConfig.originZip || '05303-000',
        destinationZip: destination.cep,
        destinationState: destination.state,
        weightKg: packageInfo.totalWeightKg,
        lengthCm: packageInfo.lengthCm,
        widthCm: packageInfo.widthCm,
        heightCm: packageInfo.heightCm,
        serviceCode,
        additionalDays:
          (method.correiosAdditionalDays || 0) +
          (deliverySettings.correiosConfig.additionalHandlingDays || 0),
      });

      // Frete grátis por valor se configurado
      let finalCost = pricing.cost;
      if (method.freeShippingAbove && subtotal >= method.freeShippingAbove) {
        finalCost = 0;
      }

      options.push({
        methodId: method.id,
        name: method.name,
        description: method.description,
        type: 'correios',
        cost: finalCost,
        estimatedDays: pricing.days,
        isQuoteRequired: false,
        rulesNotes: method.rulesNotes,
        serviceCode,
      });
    } else if (method.type === 'transportadora') {
      // Transportadora — Frete a Combinar
      options.push({
        methodId: method.id,
        name: method.name,
        description: method.description,
        type: 'transportadora',
        cost: 0,
        estimatedDays: method.estimatedDays || 3,
        isQuoteRequired: true,
        carrierName: (method.carrierOptions && method.carrierOptions[0]) || 'Transportadora Parceira',
        rulesNotes:
          method.rulesNotes ||
          'O valor do frete será cotado com transportadoras parceiras e enviado para sua aprovação após o pedido.',
      });
    } else if (method.type === 'retirada') {
      // Retirada no Estabelecimento
      options.push({
        methodId: method.id,
        name: method.name,
        description: method.description,
        type: 'retirada',
        cost: 0,
        estimatedDays: method.estimatedDays || 1,
        isQuoteRequired: false,
        pickupAddress:
          method.pickupAddress ||
          'Rua das Indústrias Criativas, 450 - Galpão 2 - Vila Leopoldina, São Paulo - SP, CEP 05303-000',
        pickupInstructions:
          method.pickupInstructions ||
          'Retire seu pedido sem custo de frete na sede da MB Personaliza mediante apresentação do documento do comprador.',
        pickupHours: method.pickupHours || 'Segunda a Sexta, das 09h às 17h30',
        rulesNotes: method.rulesNotes,
      });
    } else {
      // Modalidade Personalizada com valor fixo
      let finalCost = method.fixedPrice || 0;
      if (method.freeShippingAbove && subtotal >= method.freeShippingAbove) {
        finalCost = 0;
      }

      options.push({
        methodId: method.id,
        name: method.name,
        description: method.description,
        type: 'personalizado',
        cost: finalCost,
        estimatedDays: method.estimatedDays || 2,
        isQuoteRequired: false,
        rulesNotes: method.rulesNotes,
      });
    }
  });

  return {
    coverage,
    packageInfo,
    options,
  };
}
