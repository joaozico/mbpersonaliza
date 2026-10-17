import React, { useState } from 'react';
import {
  DeliveryAndShippingSettings,
  ServiceCoverageType,
  ShippingMethodItem,
  CoverageExceptionItem,
} from '../types';
import { StorageService } from '../services/storage';
import {
  cleanCep,
  formatCep,
  lookupAddressByCep,
} from '../utils/shippingUtils';
import {
  Truck,
  Globe2,
  MapPin,
  Building,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  ArrowUpDown,
  Search,
  RotateCcw,
  Save,
  Package,
  Calendar,
  DollarSign,
  ShieldAlert,
  HelpCircle,
  Clock,
  Sparkles,
  Info,
  Check,
  X,
} from 'lucide-react';

interface DeliverySettingsTabProps {
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DeliverySettingsTab: React.FC<DeliverySettingsTabProps> = ({ onNotify }) => {
  const [settings, setSettings] = useState<DeliveryAndShippingSettings>(() =>
    StorageService.getDeliverySettings()
  );

  const [activeSubTab, setActiveSubTab] = useState<'region' | 'methods' | 'correios' | 'carriers' | 'simulator'>('region');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal de edição / criação de método de entrega
  const [editingMethod, setEditingMethod] = useState<ShippingMethodItem | null>(null);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);

  // Nova transportadora
  const [newCarrierName, setNewCarrierName] = useState('');

  // Nova exceção geográfica
  const [newExceptionCity, setNewExceptionCity] = useState('');
  const [newExceptionState, setNewExceptionState] = useState('SP');
  const [newExceptionType, setNewExceptionType] = useState<'allow_city' | 'allow_zip_range' | 'block_city'>('allow_city');
  const [newExceptionStartZip, setNewExceptionStartZip] = useState('');
  const [newExceptionEndZip, setNewExceptionEndZip] = useState('');

  // Simulador de Frete
  const [simCep, setSimCep] = useState('01310-200');
  const [simWeight, setSimWeight] = useState(1.5);
  const [simLength, setSimLength] = useState(20);
  const [simWidth, setSimWidth] = useState(15);
  const [simHeight, setSimHeight] = useState(10);
  const [simSubtotal, setSimSubtotal] = useState(350);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Lista dos 27 estados do Brasil
  const brazilianStates = [
    { uf: 'AC', name: 'Acre' },
    { uf: 'AL', name: 'Alagoas' },
    { uf: 'AP', name: 'Amapá' },
    { uf: 'AM', name: 'Amazonas' },
    { uf: 'BA', name: 'Bahia' },
    { uf: 'CE', name: 'Ceará' },
    { uf: 'DF', name: 'Distrito Federal' },
    { uf: 'ES', name: 'Espírito Santo' },
    { uf: 'GO', name: 'Goiás' },
    { uf: 'MA', name: 'Maranhão' },
    { uf: 'MT', name: 'Mato Grosso' },
    { uf: 'MS', name: 'Mato Grosso do Sul' },
    { uf: 'MG', name: 'Minas Gerais' },
    { uf: 'PA', name: 'Pará' },
    { uf: 'PB', name: 'Paraíba' },
    { uf: 'PR', name: 'Paraná' },
    { uf: 'PE', name: 'Pernambuco' },
    { uf: 'PI', name: 'Piauí' },
    { uf: 'RJ', name: 'Rio de Janeiro' },
    { uf: 'RN', name: 'Rio Grande do Norte' },
    { uf: 'RS', name: 'Rio Grande do Sul' },
    { uf: 'RO', name: 'Rondônia' },
    { uf: 'RR', name: 'Roraima' },
    { uf: 'SC', name: 'Santa Catarina' },
    { uf: 'SP', name: 'São Paulo' },
    { uf: 'SE', name: 'Sergipe' },
    { uf: 'TO', name: 'Tocantins' },
  ];

  const handleSaveAll = () => {
    const res = StorageService.saveDeliverySettings(settings);
    if (res.success) {
      setSaveSuccess(true);
      setErrorMessage(null);
      if (onNotify) onNotify('Configurações de atendimento e entrega salvas com sucesso!', 'success');
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setErrorMessage(res.error || 'Erro ao salvar configurações.');
      if (onNotify) onNotify(res.error || 'Erro ao salvar', 'error');
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja redefinir todas as configurações de atendimento e entrega para os padrões do sistema?')) {
      StorageService.resetDeliverySettings();
      setSettings(StorageService.getDeliverySettings());
      if (onNotify) onNotify('Configurações redefinidas para o padrão.', 'info');
    }
  };

  // Métodos de Entrega Helpers
  const handleToggleMethod = (methodId: string) => {
    const updated = {
      ...settings,
      methods: settings.methods.map((m) =>
        m.id === methodId ? { ...m, enabled: !m.enabled } : m
      ),
    };
    setSettings(updated);
    StorageService.saveDeliverySettings(updated);
  };

  const handleMoveMethodOrder = (methodId: string, direction: 'up' | 'down') => {
    const sorted = [...settings.methods].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((m) => m.id === methodId);
    if (index < 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap order values
    const currentOrder = sorted[index].order;
    sorted[index].order = sorted[targetIndex].order;
    sorted[targetIndex].order = currentOrder;

    const updated = {
      ...settings,
      methods: sorted,
    };
    setSettings(updated);
    StorageService.saveDeliverySettings(updated);
  };

  const handleOpenEditMethod = (method: ShippingMethodItem) => {
    setEditingMethod({ ...method });
    setIsMethodModalOpen(true);
  };

  const handleOpenNewMethod = () => {
    const newMethod: ShippingMethodItem = {
      id: `sm-custom-${Date.now()}`,
      name: 'Entrega Expressa Regional',
      description: 'Entrega rápida via frota própria ou parceiro local.',
      type: 'personalizado',
      enabled: true,
      order: settings.methods.length + 1,
      coverageScope: 'inherit',
      fixedPrice: 35.0,
      estimatedDays: 2,
      freeShippingAbove: 600,
      rulesNotes: 'Disponível em dias úteis.',
    };
    setEditingMethod(newMethod);
    setIsMethodModalOpen(true);
  };

  const handleSaveEditingMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMethod) return;

    const exists = settings.methods.some((m) => m.id === editingMethod.id);
    let updatedMethods: ShippingMethodItem[];

    if (exists) {
      updatedMethods = settings.methods.map((m) =>
        m.id === editingMethod.id ? editingMethod : m
      );
    } else {
      updatedMethods = [...settings.methods, editingMethod];
    }

    const updated = {
      ...settings,
      methods: updatedMethods,
    };
    setSettings(updated);
    StorageService.saveDeliverySettings(updated);
    setIsMethodModalOpen(false);
    setEditingMethod(null);
  };

  const handleDeleteMethod = (methodId: string) => {
    if (confirm('Tem certeza que deseja remover esta modalidade de entrega?')) {
      const updated = {
        ...settings,
        methods: settings.methods.filter((m) => m.id !== methodId),
      };
      setSettings(updated);
      StorageService.saveDeliverySettings(updated);
    }
  };

  // Transportadoras Helpers
  const handleAddCarrier = () => {
    const name = newCarrierName.trim();
    if (!name) return;
    if (settings.carriersList.includes(name)) {
      setErrorMessage('Esta transportadora já está cadastrada.');
      if (onNotify) onNotify('Esta transportadora já está cadastrada.', 'error');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    const updated = {
      ...settings,
      carriersList: [...settings.carriersList, name],
    };
    setSettings(updated);
    StorageService.saveDeliverySettings(updated);
    setNewCarrierName('');
  };

  const handleRemoveCarrier = (name: string) => {
    if (confirm(`Remover "${name}" da lista de transportadoras parceiras?`)) {
      const updated = {
        ...settings,
        carriersList: settings.carriersList.filter((c) => c !== name),
      };
      setSettings(updated);
      StorageService.saveDeliverySettings(updated);
    }
  };

  // Exceções Geográficas Helpers
  const handleAddException = (target: 'municipal' | 'estadual') => {
    const newItem: CoverageExceptionItem = {
      id: `exc-${Date.now()}`,
      type: newExceptionType,
      name:
        newExceptionType === 'allow_zip_range'
          ? `Faixa de CEP ${newExceptionStartZip} até ${newExceptionEndZip}`
          : `${newExceptionCity} (${newExceptionState})`,
      state: newExceptionState,
      city: newExceptionCity.trim() || undefined,
      startZip: newExceptionStartZip ? cleanCep(newExceptionStartZip) : undefined,
      endZip: newExceptionEndZip ? cleanCep(newExceptionEndZip) : undefined,
    };

    if (newExceptionType === 'allow_zip_range') {
      if (!newExceptionStartZip || !newExceptionEndZip) {
        setErrorMessage('Informe o CEP inicial e o CEP final para a faixa.');
        if (onNotify) onNotify('Informe o CEP inicial e o CEP final para a faixa.', 'error');
        setTimeout(() => setErrorMessage(null), 4000);
        return;
      }
    } else {
      if (!newExceptionCity.trim()) {
        setErrorMessage('Informe o nome do município.');
        if (onNotify) onNotify('Informe o nome do município.', 'error');
        setTimeout(() => setErrorMessage(null), 4000);
        return;
      }
    }

    let updated: DeliveryAndShippingSettings;
    if (target === 'municipal') {
      updated = {
        ...settings,
        serviceRegion: {
          ...settings.serviceRegion,
          municipalConfig: {
            ...settings.serviceRegion.municipalConfig,
            exceptions: [...settings.serviceRegion.municipalConfig.exceptions, newItem],
          },
        },
      };
    } else {
      updated = {
        ...settings,
        serviceRegion: {
          ...settings.serviceRegion,
          stateConfig: {
            ...settings.serviceRegion.stateConfig,
            exceptions: [...settings.serviceRegion.stateConfig.exceptions, newItem],
          },
        },
      };
    }

    setSettings(updated);
    StorageService.saveDeliverySettings(updated);
    setNewExceptionCity('');
    setNewExceptionStartZip('');
    setNewExceptionEndZip('');
  };

  const handleRemoveException = (target: 'municipal' | 'estadual', exceptionId: string) => {
    let updated: DeliveryAndShippingSettings;
    if (target === 'municipal') {
      updated = {
        ...settings,
        serviceRegion: {
          ...settings.serviceRegion,
          municipalConfig: {
            ...settings.serviceRegion.municipalConfig,
            exceptions: settings.serviceRegion.municipalConfig.exceptions.filter(
              (e) => e.id !== exceptionId
            ),
          },
        },
      };
    } else {
      updated = {
        ...settings,
        serviceRegion: {
          ...settings.serviceRegion,
          stateConfig: {
            ...settings.serviceRegion.stateConfig,
            exceptions: settings.serviceRegion.stateConfig.exceptions.filter(
              (e) => e.id !== exceptionId
            ),
          },
        },
      };
    }
    setSettings(updated);
    StorageService.saveDeliverySettings(updated);
  };

  // Simulador de Frete
  const handleRunSimulation = async () => {
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);

    try {
      const cleanTargetCep = cleanCep(simCep);
      if (cleanTargetCep.length !== 8) {
        throw new Error('Informe um CEP válido com 8 dígitos para a simulação.');
      }

      // 1. Consulta CEP via ViaCEP oficial
      const addr = await lookupAddressByCep(cleanTargetCep);
      if (!addr.valid) {
        throw new Error(addr.error || 'CEP não encontrado na base dos Correios.');
      }

      // Mock de produto montado para testar
      const mockCartItem: any = {
        id: 'sim-cart-item',
        product: {
          id: 'prod-sim',
          name: 'Produto de Teste Simulador',
          code: 'SIM-001',
          shippingDimensions: {
            weightKg: simWeight,
            lengthCm: simLength,
            widthCm: simWidth,
            heightCm: simHeight,
            specialPackaging: false,
          },
        },
        quantity: 1,
        calculatedUnitPrice: simSubtotal,
      };

      const { getAvailableShippingOptions } = await import('../utils/shippingUtils');
      const result = getAvailableShippingOptions({
        destination: {
          city: addr.city,
          state: addr.state,
          cep: addr.cep,
        },
        cart: [mockCartItem],
        subtotal: simSubtotal,
        deliverySettings: settings,
      });

      setSimResult({
        address: addr,
        ...result,
      });
    } catch (err: any) {
      setSimError(err.message || 'Falha ao processar simulação.');
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#00AEEF] to-[#E6007E] flex items-center justify-center text-white shadow-md">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-slate-900 uppercase tracking-tight">
                Configurações de Atendimento e Entrega
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-[#00AEEF]">
                Logística & Frete
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina a abrangência geográfica de atendimento, integre com Correios (SEDEX/PAC), cadastre transportadoras a combinar e retirada na fábrica.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Redefinir para valores padrões de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redefinir Padrões
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            id="btn-save-delivery-settings"
          >
            <Save className="w-3.5 h-3.5 text-[#FFDD00]" />
            Salvar Alterações
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">
            Configurações atualizadas com sucesso! As novas regras de abrangência e frete já estão em vigor na loja virtual.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-800 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-bold">{errorMessage}</span>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('region')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'region'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe2 className="w-4 h-4 text-[#00AEEF]" />
          1. Região de Atendimento
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 uppercase">
            {settings.serviceRegion.coverageType}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('methods')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'methods'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4 text-[#E6007E]" />
          2. Formas de Entrega ({settings.methods.filter((m) => m.enabled).length}/{settings.methods.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('correios')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'correios'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4 text-[#FFDD00]" />
          3. Integração Correios (CWS / WebService)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('carriers')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'carriers'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4 text-emerald-500" />
          4. Transportadoras & Frete a Combinar
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('simulator')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'simulator'
              ? 'bg-[#E6007E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#FFDD00]" />
          5. Simulador de Frete & Testes
        </button>
      </div>

      {/* ======================================================== */}
      {/* SUBTAB 1: REGIÃO DE ATENDIMENTO */}
      {/* ======================================================== */}
      {activeSubTab === 'region' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-[#00AEEF]" />
                Abrangência Geográfica de Atendimento
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Escolha a amplitude geográfica em que a MB Personaliza aceita pedidos. Pedidos fora da área selecionada serão bloqueados no checkout ou redirecionados para retirada balcão.
              </p>
            </div>

            {/* 3 Coverage Cards (Options 1, 2, 3) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Municipal */}
              <div
                onClick={() =>
                  setSettings({
                    ...settings,
                    serviceRegion: { ...settings.serviceRegion, coverageType: 'municipal' },
                  })
                }
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  settings.serviceRegion.coverageType === 'municipal'
                    ? 'border-[#00AEEF] bg-sky-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#00AEEF] flex items-center justify-center font-bold">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="coverageType"
                    checked={settings.serviceRegion.coverageType === 'municipal'}
                    onChange={() => {}}
                    className="w-4 h-4 text-[#00AEEF]"
                  />
                </div>
                <h4 className="font-heading text-sm font-bold text-slate-900">
                  Opção 1 — Atendimento Municipal
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Atende estritamente no município configurado (e cidades vizinhas autorizadas por exceção). Bloqueia compras fora da localidade.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-[#00AEEF]">
                  Atualmente: {settings.serviceRegion.municipalConfig.city} - {settings.serviceRegion.municipalConfig.state}
                </div>
              </div>

              {/* Option 2: Estadual */}
              <div
                onClick={() =>
                  setSettings({
                    ...settings,
                    serviceRegion: { ...settings.serviceRegion, coverageType: 'estadual' },
                  })
                }
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  settings.serviceRegion.coverageType === 'estadual'
                    ? 'border-[#E6007E] bg-pink-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-100 text-[#E6007E] flex items-center justify-center font-bold">
                    <Building className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="coverageType"
                    checked={settings.serviceRegion.coverageType === 'estadual'}
                    onChange={() => {}}
                    className="w-4 h-4 text-[#E6007E]"
                  />
                </div>
                <h4 className="font-heading text-sm font-bold text-slate-900">
                  Opção 2 — Atendimento Estadual
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Atende todos os municípios do estado selecionado. Valida se o endereço do cliente pertence à UF autorizada.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-[#E6007E]">
                  Atualmente: Todo o Estado de {settings.serviceRegion.stateConfig.state}
                </div>
              </div>

              {/* Option 3: Nacional */}
              <div
                onClick={() =>
                  setSettings({
                    ...settings,
                    serviceRegion: { ...settings.serviceRegion, coverageType: 'nacional' },
                  })
                }
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  settings.serviceRegion.coverageType === 'nacional'
                    ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    <Globe2 className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="coverageType"
                    checked={settings.serviceRegion.coverageType === 'nacional'}
                    onChange={() => {}}
                    className="w-4 h-4 text-emerald-600"
                  />
                </div>
                <h4 className="font-heading text-sm font-bold text-slate-900">
                  Opção 3 — Atendimento Nacional
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Atende todos os 26 estados + Distrito Federal. Clientes de qualquer região do Brasil podem comprar com entrega via Correios e Transportadora.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-emerald-600">
                  Cobertura em todo o território nacional
                </div>
              </div>
            </div>

            {/* Configuração Específica da Opção Selecionada */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              {settings.serviceRegion.coverageType === 'municipal' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00AEEF]" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase">
                      Configuração do Município Sede Atendido
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Estado (UF) *
                      </label>
                      <select
                        value={settings.serviceRegion.municipalConfig.state}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            serviceRegion: {
                              ...settings.serviceRegion,
                              municipalConfig: {
                                ...settings.serviceRegion.municipalConfig,
                                state: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                      >
                        {brazilianStates.map((st) => (
                          <option key={st.uf} value={st.uf}>
                            {st.uf} — {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Município Atendido *
                      </label>
                      <input
                        type="text"
                        value={settings.serviceRegion.municipalConfig.city}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            serviceRegion: {
                              ...settings.serviceRegion,
                              municipalConfig: {
                                ...settings.serviceRegion.municipalConfig,
                                city: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="Ex: São Paulo"
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  {/* Exceções Municipais */}
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">
                          Exceções de Atendimento Municipal (Cidades Vizinhas ou Faixas de CEP)
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Permita que bairros limítrofes ou municípios da região metropolitana também recebam entregas
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <select
                          value={newExceptionType}
                          onChange={(e) => setNewExceptionType(e.target.value as any)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <option value="allow_city">Autorizar Município Vizinho</option>
                          <option value="allow_zip_range">Autorizar Faixa de CEP</option>
                        </select>
                      </div>

                      {newExceptionType === 'allow_city' ? (
                        <>
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={newExceptionCity}
                              onChange={(e) => setNewExceptionCity(e.target.value)}
                              placeholder="Nome do município (ex: Guarulhos)"
                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                            />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleAddException('municipal')}
                              className="w-full py-1.5 bg-[#00AEEF] hover:bg-[#009bd6] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <input
                              type="text"
                              value={newExceptionStartZip}
                              onChange={(e) => setNewExceptionStartZip(e.target.value)}
                              placeholder="CEP Inicial"
                              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={newExceptionEndZip}
                              onChange={(e) => setNewExceptionEndZip(e.target.value)}
                              placeholder="CEP Final"
                              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                            />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleAddException('municipal')}
                              className="w-full py-1.5 bg-[#00AEEF] hover:bg-[#009bd6] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Exceptions List */}
                    <div className="space-y-1.5">
                      {settings.serviceRegion.municipalConfig.exceptions.map((exc) => (
                        <div
                          key={exc.id}
                          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-bold text-slate-800">{exc.name}</span>
                            <span className="text-[10px] text-slate-400">
                              {exc.type === 'allow_zip_range'
                                ? `CEPs ${formatCep(exc.startZip || '')} a ${formatCep(exc.endZip || '')}`
                                : `UF: ${exc.state}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveException('municipal', exc.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            title="Remover exceção"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {settings.serviceRegion.municipalConfig.exceptions.length === 0 && (
                        <div className="text-center py-3 text-slate-400 text-xs italic">
                          Nenhuma exceção cadastrada. Apenas o município principal receberá entregas.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {settings.serviceRegion.coverageType === 'estadual' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#E6007E]" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase">
                      Configuração do Estado (UF) Autorizado
                    </h4>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Unidade Federativa Atendida *
                    </label>
                    <select
                      value={settings.serviceRegion.stateConfig.state}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          serviceRegion: {
                            ...settings.serviceRegion,
                            stateConfig: {
                              ...settings.serviceRegion.stateConfig,
                              state: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full sm:w-80 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      {brazilianStates.map((st) => (
                        <option key={st.uf} value={st.uf}>
                          {st.uf} — {st.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Todos os municípios pertencentes ao estado selecionado poderão realizar compras. Pedidos para outras UFs serão bloqueados.
                    </p>
                  </div>
                </div>
              )}

              {settings.serviceRegion.coverageType === 'nacional' && (
                <div className="flex items-center gap-3 p-4 bg-emerald-100/50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Atendimento Nacional Ativo:</span> Todos os clientes do Brasil têm permissão para finalizar compras na loja virtual. As opções de entrega disponíveis dependerão das modalidades ativas (Correios, Transportadora ou Retirada).
                  </div>
                </div>
              )}

              {/* Opções Gerais de Política Logística */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.serviceRegion.allowPickupOutOfCoverage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        serviceRegion: {
                          ...settings.serviceRegion,
                          allowPickupOutOfCoverage: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 rounded text-slate-900 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Permitir "Retirada no Estabelecimento" mesmo quando o cliente estiver fora da região de atendimento
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Se ativado, um cliente de outro município ou estado poderá comprar caso opte por buscar pessoalmente os produtos na sede da MB Personaliza.
                    </p>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mensagem Personalizada quando o CEP/Endereço estiver fora da área atendida
                  </label>
                  <textarea
                    rows={2}
                    value={settings.serviceRegion.blockedMessageCustom || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        serviceRegion: {
                          ...settings.serviceRegion,
                          blockedMessageCustom: e.target.value,
                        },
                      })
                    }
                    placeholder="Ex: Atenção: No momento, a MB Personaliza atende pedidos para entrega apenas na nossa região configurada..."
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 2: FORMAS DE ENTREGA (MÉTODOS) */}
      {/* ======================================================== */}
      {activeSubTab === 'methods' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#E6007E]" />
                  Cadastro e Gestão das Formas de Entrega
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ative, desative, altere a ordem e configure as regras de cada modalidade exibida na finalização de compra.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenNewMethod}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FFDD00]" />
                Nova Modalidade de Entrega
              </button>
            </div>

            {/* Methods Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 w-16 text-center">Ordem</th>
                    <th className="px-4 py-3">Modalidade</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Abrangência</th>
                    <th className="px-4 py-3">Prazo Estimado</th>
                    <th className="px-4 py-3">Valor do Frete</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...settings.methods]
                    .sort((a, b) => a.order - b.order)
                    .map((method, idx) => (
                      <tr key={method.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-bold text-slate-700 w-4 text-center">
                              {method.order}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => handleMoveMethodOrder(method.id, 'up')}
                                disabled={idx === 0}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                title="Subir ordem"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveMethodOrder(method.id, 'down')}
                                disabled={idx === settings.methods.length - 1}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                title="Descer ordem"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{method.name}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{method.description}</p>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              method.type === 'correios'
                                ? 'bg-amber-100 text-amber-800'
                                : method.type === 'transportadora'
                                ? 'bg-blue-100 text-blue-800'
                                : method.type === 'retirada'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {method.type}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {method.coverageScope === 'inherit' && 'Herda Região Geral'}
                          {method.coverageScope === 'municipal' && 'Apenas Municipal'}
                          {method.coverageScope === 'estadual' && 'Apenas Estadual'}
                          {method.coverageScope === 'nacional' && 'Nacional'}
                          {method.coverageScope === 'custom_states' &&
                            `Estados: ${(method.allowedStates || []).join(', ')}`}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {method.type === 'correios' ? (
                            <span className="text-[11px] font-semibold text-amber-700">
                              Calculado via CEP + {method.correiosAdditionalDays || 0} dias
                            </span>
                          ) : method.estimatedDays ? (
                            `${method.estimatedDays} dias úteis`
                          ) : (
                            'A combinar'
                          )}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {method.type === 'correios' ? (
                            <span className="text-[11px] text-slate-600">
                              Calculado na consulta por CEP
                            </span>
                          ) : method.type === 'transportadora' ? (
                            <span className="text-[11px] text-blue-700 font-bold">
                              A combinar após pedido
                            </span>
                          ) : method.type === 'retirada' ? (
                            <span className="text-[11px] text-emerald-600 font-bold">
                              Grátis (R$ 0,00)
                            </span>
                          ) : (
                            `R$ ${(method.fixedPrice || 0).toFixed(2)}`
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleMethod(method.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                              method.enabled
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {method.enabled ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMethod(method)}
                              className="p-1.5 text-slate-500 hover:text-[#00AEEF] hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                              title="Editar modalidade"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMethod(method.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir modalidade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 3: INTEGRAÇÃO CORREIOS */}
      {/* ======================================================== */}
      {activeSubTab === 'correios' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#FFDD00]" />
                  Integração Oficial com os Correios
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulação e cálculo de frete por CEP em tempo real para modalidades SEDEX e PAC, respeitando dimensões, cubagem e peso dos produtos.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={settings.correiosConfig.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      correiosConfig: {
                        ...settings.correiosConfig,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 rounded text-slate-900"
                />
                <span className="text-xs font-bold text-slate-800">
                  Integração Ativa
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CEP de Origem da MB Personaliza *
                </label>
                <input
                  type="text"
                  value={settings.correiosConfig.originZip}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      correiosConfig: {
                        ...settings.correiosConfig,
                        originZip: e.target.value,
                      },
                    })
                  }
                  placeholder="05303-000"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  CEP do centro de distribuição / galpão da MB Personaliza de onde saem as encomendas.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dias Adicionais de Manuseio / Postagem
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.correiosConfig.additionalHandlingDays ?? 1}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      correiosConfig: {
                        ...settings.correiosConfig,
                        additionalHandlingDays: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Prazo extra somado ao prazo oficial dos Correios para embalagem e postagem do pedido.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código de Serviço SEDEX
                </label>
                <input
                  type="text"
                  value={settings.correiosConfig.serviceSedexCode || '04014'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      correiosConfig: {
                        ...settings.correiosConfig,
                        serviceSedexCode: e.target.value,
                      },
                    })
                  }
                  placeholder="04014 (À vista) ou código contratual"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código de Serviço PAC
                </label>
                <input
                  type="text"
                  value={settings.correiosConfig.servicePacCode || '04510'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      correiosConfig: {
                        ...settings.correiosConfig,
                        servicePacCode: e.target.value,
                      },
                    })
                  }
                  placeholder="04510 (À vista) ou código contratual"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Contrato dos Correios (CWS / Meu Correios) */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase">
                    Contrato Comercial com os Correios (Opcional)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Se sua empresa possui contrato empresarial (CWS / SIGEP Web), preencha as credenciais para aplicar tarifas diferenciadas.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.correiosConfig.useContract}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        correiosConfig: {
                          ...settings.correiosConfig,
                          useContract: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 rounded text-slate-900"
                  />
                  <span className="text-xs font-bold text-slate-700">Usar Contrato Corporativo</span>
                </label>
              </div>

              {settings.correiosConfig.useContract && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Usuário CWS / Meu Correios
                    </label>
                    <input
                      type="text"
                      value={settings.correiosConfig.user || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          correiosConfig: {
                            ...settings.correiosConfig,
                            user: e.target.value,
                          },
                        })
                      }
                      placeholder="Identificador do usuário CWS"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Token CWS / Senha de Acesso
                    </label>
                    <input
                      type="password"
                      value={settings.correiosConfig.passwordOrToken || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          correiosConfig: {
                            ...settings.correiosConfig,
                            passwordOrToken: e.target.value,
                          },
                        })
                      }
                      placeholder="••••••••••••••••"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Número do Contrato
                    </label>
                    <input
                      type="text"
                      value={settings.correiosConfig.contractNumber || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          correiosConfig: {
                            ...settings.correiosConfig,
                            contractNumber: e.target.value,
                          },
                        })
                      }
                      placeholder="9912345678"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cartão de Postagem
                    </label>
                    <input
                      type="text"
                      value={settings.correiosConfig.postageCard || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          correiosConfig: {
                            ...settings.correiosConfig,
                            postageCard: e.target.value,
                          },
                        })
                      }
                      placeholder="0067891234"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 4: TRANSPORTADORAS & FRETE A COMBINAR */}
      {/* ======================================================== */}
      {activeSubTab === 'carriers' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-500" />
                Transportadoras Parceiras & Frete a Combinar
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastre as transportadoras homologadas para cotação de grandes tiragens e cargas fracionadas/fechadas.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newCarrierName}
                onChange={(e) => setNewCarrierName(e.target.value)}
                placeholder="Nome da transportadora (ex: Jadlog, Braspress, Jamef, Rodonaves)"
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
              <button
                type="button"
                onClick={handleAddCarrier}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Adicionar Transportadora
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {settings.carriersList.map((carrier) => (
                <div
                  key={carrier}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-xs text-slate-800">{carrier}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCarrier(carrier)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    title="Remover transportadora"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Informações da modalidade Retirada */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Modalidade "Retirada no Estabelecimento"
              </div>
              <p className="text-xs text-emerald-800">
                A retirada física no balcão da MB Personaliza não gera cobrança de frete (R$ 0,00). O endereço oficial de retirada, horários de atendimento e instruções são configurados diretamente na aba "Formas de Entrega".
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 5: SIMULADOR DE FRETE & TESTES */}
      {/* ======================================================== */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#E6007E]" />
                Simulador de Cálculo e Validação de Frete
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Faça simulações em tempo real para verificar se as regras de abrangência, exceções municipais/estaduais e custos dos Correios estão operando conforme esperado.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  CEP de Destino *
                </label>
                <input
                  type="text"
                  value={simCep}
                  onChange={(e) => setSimCep(e.target.value)}
                  placeholder="01310-200"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={simWeight}
                  onChange={(e) => setSimWeight(parseFloat(e.target.value) || 0.1)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Comprimento (cm)
                </label>
                <input
                  type="number"
                  min="16"
                  value={simLength}
                  onChange={(e) => setSimLength(parseInt(e.target.value) || 16)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Largura (cm)
                </label>
                <input
                  type="number"
                  min="11"
                  value={simWidth}
                  onChange={(e) => setSimWidth(parseInt(e.target.value) || 11)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  min="2"
                  value={simHeight}
                  onChange={(e) => setSimHeight(parseInt(e.target.value) || 2)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Subtotal do Carrinho (R$)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={simSubtotal}
                  onChange={(e) => setSimSubtotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-4 flex items-end">
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={simLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {simLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Consultando ViaCEP e calculando...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-[#FFDD00]" />
                      <span>Simular Cotação e Validar Abrangência</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {simError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{simError}</span>
              </div>
            )}

            {simResult && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Endereço Retornado */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                    <h5 className="font-bold text-slate-900 uppercase text-[10px]">
                      Endereço Localizado (ViaCEP)
                    </h5>
                    <div className="text-slate-700">
                      <strong>Logradouro:</strong> {simResult.address.street || 'Não informado'}
                    </div>
                    <div className="text-slate-700">
                      <strong>Bairro:</strong> {simResult.address.neighborhood || 'Não informado'}
                    </div>
                    <div className="text-slate-700">
                      <strong>Cidade / UF:</strong> {simResult.address.city} - {simResult.address.state}
                    </div>
                    <div className="text-slate-700">
                      <strong>CEP:</strong> {formatCep(simResult.address.cep)}
                    </div>
                  </div>

                  {/* Diagnóstico da Abrangência */}
                  <div
                    className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                      simResult.coverage.allowed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <h5 className="font-bold uppercase text-[10px]">
                      Diagnóstico de Abrangência
                    </h5>
                    <div>
                      <strong>Status:</strong>{' '}
                      {simResult.coverage.allowed ? (
                        <span className="font-bold text-emerald-700">Dentro da Área Atendida</span>
                      ) : (
                        <span className="font-bold text-rose-700">Fora da Área Atendida</span>
                      )}
                    </div>
                    <div>
                      <strong>Regra Ativa:</strong> Abrangência {simResult.coverage.coverageType.toUpperCase()}
                    </div>
                    {simResult.coverage.reason && (
                      <div className="text-[11px] mt-1 pt-1 border-t border-rose-200">
                        <strong>Motivo:</strong> {simResult.coverage.reason}
                      </div>
                    )}
                    {simResult.coverage.allowPickup && !simResult.coverage.allowed && (
                      <div className="text-[11px] font-bold text-blue-700">
                        • Retirada no Estabelecimento permitida como exceção
                      </div>
                    )}
                  </div>
                </div>

                {/* Opções Retornadas */}
                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase mb-2">
                    Modalidades Retornadas para o Cliente ({simResult.options.length})
                  </h5>
                  <div className="space-y-2">
                    {simResult.options.map((opt: any) => (
                      <div
                        key={opt.methodId}
                        className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{opt.name}</span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {opt.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{opt.description}</p>
                          {opt.pickupAddress && (
                            <p className="text-[10px] text-emerald-700 font-semibold">
                              Retirada: {opt.pickupAddress}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          {opt.isQuoteRequired ? (
                            <span className="text-xs font-bold text-blue-600 block">
                              A Combinar
                            </span>
                          ) : (
                            <span className="text-sm font-bold text-slate-900 font-heading block">
                              {opt.cost === 0 ? 'Grátis' : `R$ ${opt.cost.toFixed(2)}`}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 block">
                            Prazo: {opt.estimatedDays} {opt.estimatedDays === 1 ? 'dia' : 'dias'}
                          </span>
                        </div>
                      </div>
                    ))}

                    {simResult.options.length === 0 && (
                      <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                        Nenhuma modalidade de entrega disponível para este CEP com as regras atuais.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Edição de Modalidade de Entrega */}
      {isMethodModalOpen && editingMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
                {settings.methods.some((m) => m.id === editingMethod.id)
                  ? 'Editar Modalidade de Entrega'
                  : 'Nova Modalidade de Entrega'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMethodModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditingMethod} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome da Modalidade *
                </label>
                <input
                  type="text"
                  required
                  value={editingMethod.name}
                  onChange={(e) => setEditingMethod({ ...editingMethod, name: e.target.value })}
                  placeholder="Ex: Correios SEDEX, Motoboy Expresso, Retirada Fábrica"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição Apresentada ao Cliente *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editingMethod.description}
                  onChange={(e) =>
                    setEditingMethod({ ...editingMethod, description: e.target.value })
                  }
                  placeholder="Explique como funciona a entrega..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Entrega *
                  </label>
                  <select
                    value={editingMethod.type}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="correios">Correios (SEDEX / PAC)</option>
                    <option value="transportadora">Transportadora (Frete a Combinar)</option>
                    <option value="retirada">Retirada no Estabelecimento</option>
                    <option value="personalizado">Personalizado (Taxa Fixa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ordem de Exibição *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingMethod.order}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, order: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              {editingMethod.type === 'personalizado' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Valor Fixo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingMethod.fixedPrice ?? 0}
                      onChange={(e) =>
                        setEditingMethod({
                          ...editingMethod,
                          fixedPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Prazo Estimado (Dias Úteis)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingMethod.estimatedDays ?? 1}
                      onChange={(e) =>
                        setEditingMethod({
                          ...editingMethod,
                          estimatedDays: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {editingMethod.type === 'retirada' && (
                <div className="space-y-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Endereço de Retirada
                    </label>
                    <input
                      type="text"
                      value={editingMethod.pickupAddress || ''}
                      onChange={(e) =>
                        setEditingMethod({ ...editingMethod, pickupAddress: e.target.value })
                      }
                      placeholder="Rua / Galpão / Bairro / Cidade / CEP"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Horário de Funcionamento para Retirada
                    </label>
                    <input
                      type="text"
                      value={editingMethod.pickupHours || ''}
                      onChange={(e) =>
                        setEditingMethod({ ...editingMethod, pickupHours: e.target.value })
                      }
                      placeholder="Segunda a Sexta, das 09h às 17h30"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Instruções para Retirada
                    </label>
                    <textarea
                      rows={2}
                      value={editingMethod.pickupInstructions || ''}
                      onChange={(e) =>
                        setEditingMethod({ ...editingMethod, pickupInstructions: e.target.value })
                      }
                      placeholder="Apresentar documento com foto..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {editingMethod.type === 'transportadora' && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs">
                  <span className="font-bold text-blue-900 block mb-1">
                    Transportadora — Frete a Combinar
                  </span>
                  <p className="text-[11px] text-blue-800">
                    Nesta modalidade, o pedido é finalizado sem cobrança imediata de frete. O administrador cota com a transportadora parceira e envia o valor acordado para aprovação do cliente.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Regras e Observações Internas
                </label>
                <textarea
                  rows={2}
                  value={editingMethod.rulesNotes || ''}
                  onChange={(e) =>
                    setEditingMethod({ ...editingMethod, rulesNotes: e.target.value })
                  }
                  placeholder="Observações administrativas..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editingMethod.enabled}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, enabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-slate-900"
                  />
                  Modalidade Ativa no Checkout
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMethodModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Salvar Modalidade
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
