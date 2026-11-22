import React, { useState, useRef } from 'react';
import { CompanySettings, WhatsAppContact, UserProfile, MaintenanceSettings, PriceVisibilityMode } from '../types';
import { StorageService } from '../services/storage';
import { INITIAL_MAINTENANCE_SETTINGS } from '../data/initialData';
import { compressImageFile } from '../utils/imageOptimizer';
import { Logo } from '../components/Logo';
import {
  Building2,
  Save,
  CheckCircle2,
  Image as ImageIcon,
  Phone,
  Mail,
  MapPin,
  Globe,
  CreditCard,
  Clock,
  Sparkles,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Check,
  FileText,
  UploadCloud,
  Trash2,
  Palette,
  Sun,
  Moon,
  Laptop,
  Eye,
  FileCheck,
  Layers,
  HelpCircle,
  FileImage,
  MessageSquare,
  Plus,
  Edit2,
  ExternalLink,
  Star,
  Copy,
  ShoppingBag,
  Briefcase,
  Headphones,
  X,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Wrench,
  AlertTriangle,
  Power,
  History,
  Server,
  Rocket,
  Cog,
  ShieldAlert,
} from 'lucide-react';

interface CompanySettingsTabProps {
  currentUser?: UserProfile;
  onNavigate?: (view: string, param?: string) => void;
  initialSubSection?: 'geral' | 'whatsapp' | 'logo' | 'fiscal' | 'pagamento' | 'manutencao';
}

export const CompanySettingsTab: React.FC<CompanySettingsTabProps> = ({
  currentUser,
  onNavigate,
  initialSubSection = 'geral',
}) => {
  const [settings, setSettings] = useState<CompanySettings>(() => StorageService.getCompanySettings());
  const [priceVisibilityMode, setPriceVisibilityMode] = useState<PriceVisibilityMode>(() =>
    StorageService.getPriceVisibilityMode()
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };
  const [activeSubSection, setActiveSubSection] = useState<
    'geral' | 'whatsapp' | 'logo' | 'fiscal' | 'pagamento' | 'manutencao'
  >(initialSubSection);

  // WhatsApp Multi-Contact Management States
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [editingWhatsAppContact, setEditingWhatsAppContact] = useState<WhatsAppContact | null>(null);
  const [whatsAppFormData, setWhatsAppFormData] = useState<Partial<WhatsAppContact>>({
    name: '',
    number: '',
    department: 'Comercial',
    hours: 'Seg a Sex: 08:30 às 18:30',
    customMessage: 'Olá! Gostaria de mais informações sobre os produtos da MB Personaliza.',
    isDefault: false,
    active: true,
  });
  const [copiedNumberId, setCopiedNumberId] = useState<string | null>(null);

  // File Upload States
  const [logoDragOver, setLogoDragOver] = useState(false);
  const [darkLogoDragOver, setDarkLogoDragOver] = useState(false);
  const [faviconDragOver, setFaviconDragOver] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [previewSurface, setPreviewSurface] = useState<'light' | 'dark' | 'navbar' | 'doc'>('light');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const darkFileInputRef = useRef<HTMLInputElement>(null);
  const faviconFileInputRef = useRef<HTMLInputElement>(null);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleOpenAddWhatsApp = (preset?: Partial<WhatsAppContact>) => {
    setEditingWhatsAppContact(null);
    setWhatsAppFormData({
      name: preset?.name || '',
      number: preset?.number || '',
      department: preset?.department || 'Comercial',
      hours: preset?.hours || 'Seg a Sex: 08:30 às 18:30',
      customMessage: preset?.customMessage || 'Olá! Gostaria de falar com a equipe da MB Personaliza.',
      isDefault: false,
      active: true,
    });
    setIsWhatsAppModalOpen(true);
  };

  const handleOpenEditWhatsApp = (contact: WhatsAppContact) => {
    setEditingWhatsAppContact(contact);
    setWhatsAppFormData({ ...contact });
    setIsWhatsAppModalOpen(true);
  };

  const handleSaveWhatsAppContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsAppFormData.name?.trim() || !whatsAppFormData.number?.trim()) {
      showError('Por favor preencha o Nome e o Número de WhatsApp.');
      return;
    }

    const currentContacts: WhatsAppContact[] =
      settings.whatsappContacts && settings.whatsappContacts.length > 0
        ? [...settings.whatsappContacts]
        : [
            {
              id: 'default',
              name: 'Vendas & Orçamentos',
              number: settings.whatsapp || '(11) 98765-4321',
              department: 'Comercial',
              hours: 'Seg a Sex: 08:30 às 18:30',
              customMessage: 'Olá! Gostaria de um orçamento.',
              isDefault: true,
              active: true,
            },
          ];

    let updatedContacts: WhatsAppContact[];

    if (editingWhatsAppContact) {
      updatedContacts = currentContacts.map((c) => {
        if (c.id === editingWhatsAppContact.id) {
          return {
            ...c,
            ...whatsAppFormData,
            name: whatsAppFormData.name!.trim(),
            number: whatsAppFormData.number!.trim(),
          } as WhatsAppContact;
        }
        if (whatsAppFormData.isDefault) {
          return { ...c, isDefault: false };
        }
        return c;
      });
    } else {
      const newContact: WhatsAppContact = {
        id: `wa-${Date.now()}`,
        name: whatsAppFormData.name!.trim(),
        number: whatsAppFormData.number!.trim(),
        department: whatsAppFormData.department?.trim() || 'Comercial',
        hours: whatsAppFormData.hours?.trim() || 'Seg a Sex: 08:30 às 18:30',
        customMessage: whatsAppFormData.customMessage?.trim() || 'Olá! Gostaria de falar com a equipe.',
        isDefault: !!whatsAppFormData.isDefault,
        active: whatsAppFormData.active !== false,
      };

      if (newContact.isDefault) {
        updatedContacts = currentContacts.map((c) => ({ ...c, isDefault: false }));
        updatedContacts.push(newContact);
      } else {
        updatedContacts = [...currentContacts, newContact];
      }
    }

    if (!updatedContacts.some((c) => c.isDefault) && updatedContacts.length > 0) {
      updatedContacts[0].isDefault = true;
    }

    const defaultContact = updatedContacts.find((c) => c.isDefault) || updatedContacts[0];

    setSettings((prev) => ({
      ...prev,
      whatsappContacts: updatedContacts,
      whatsapp: defaultContact ? defaultContact.number : prev.whatsapp,
    }));

    setIsWhatsAppModalOpen(false);
    setSaveSuccess(false);
  };

  const handleDeleteWhatsAppContact = (id: string) => {
    const current = settings.whatsappContacts || [];
    if (current.length <= 1) {
      showError('A empresa precisa manter pelo menos 1 número de WhatsApp configurado.');
      return;
    }

    if (!window.confirm('Tem certeza de que deseja remover este número de WhatsApp?')) {
      return;
    }

    const filtered = current.filter((c) => c.id !== id);
    if (!filtered.some((c) => c.isDefault) && filtered.length > 0) {
      filtered[0].isDefault = true;
    }

    const defaultContact = filtered.find((c) => c.isDefault) || filtered[0];

    setSettings((prev) => ({
      ...prev,
      whatsappContacts: filtered,
      whatsapp: defaultContact ? defaultContact.number : prev.whatsapp,
    }));
    setSaveSuccess(false);
  };

  const handleSetDefaultWhatsAppContact = (id: string) => {
    const current = settings.whatsappContacts || [];
    const updated = current.map((c) => ({
      ...c,
      isDefault: c.id === id,
    }));
    const defaultContact = updated.find((c) => c.id === id);

    setSettings((prev) => ({
      ...prev,
      whatsappContacts: updated,
      whatsapp: defaultContact ? defaultContact.number : prev.whatsapp,
    }));
    setSaveSuccess(false);
  };

  const handleToggleWhatsAppActive = (id: string) => {
    const current = settings.whatsappContacts || [];
    const updated = current.map((c) => {
      if (c.id === id) {
        return { ...c, active: c.active === false ? true : false };
      }
      return c;
    });

    setSettings((prev) => ({
      ...prev,
      whatsappContacts: updated,
    }));
    setSaveSuccess(false);
  };

  const handleCopyNumber = (id: string, num: string) => {
    navigator.clipboard.writeText(num.replace(/\D/g, ''));
    setCopiedNumberId(id);
    setTimeout(() => setCopiedNumberId(null), 2000);
  };

  const handleInputChange = (field: keyof CompanySettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveSuccess(false);
  };

  const handleAddressChange = (field: keyof CompanySettings['address'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      address: {
        ...(prev.address || {}),
        [field]: value,
      },
    }));
    setSaveSuccess(false);
  };

  const handleSocialChange = (field: keyof CompanySettings['socialLinks'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      socialLinks: {
        ...(prev.socialLinks || {}),
        [field]: value,
      },
    }));
    setSaveSuccess(false);
  };

  const handleBankChange = (field: keyof CompanySettings['bankInfo'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      bankInfo: {
        ...(prev.bankInfo || {}),
        [field]: value,
      },
    }));
    setSaveSuccess(false);
  };

  // Helper to process and optimize device image file into lightweight base64 Data URL
  const processImageFile = async (file: File, target: 'main' | 'dark' | 'favicon') => {
    if (!file.type.startsWith('image/')) {
      showError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP ou GIF).');
      return;
    }

    setIsProcessingFile(true);

    try {
      const maxWidth = target === 'favicon' ? 128 : target === 'dark' ? 600 : 700;
      const maxHeight = target === 'favicon' ? 128 : 350;

      const { dataUrl, sizeStr } = await compressImageFile(file, maxWidth, maxHeight);

      if (target === 'main') {
        setSettings((prev) => ({
          ...prev,
          logoUrl: dataUrl,
          logoFileName: file.name,
          logoFileSize: sizeStr,
          logoType: 'custom_image',
        }));
      } else if (target === 'dark') {
        setSettings((prev) => ({
          ...prev,
          logoDarkUrl: dataUrl,
          logoDarkFileName: file.name,
        }));
      } else if (target === 'favicon') {
        setSettings((prev) => ({
          ...prev,
          faviconUrl: dataUrl,
        }));
      }

      setSaveSuccess(false);
    } catch (err: any) {
      console.error('Erro ao processar imagem:', err);
      showError('Não foi possível processar a imagem do dispositivo. Tente outro arquivo.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent, target: 'main' | 'dark' | 'favicon') => {
    e.preventDefault();
    if (target === 'main') setLogoDragOver(false);
    if (target === 'dark') setDarkLogoDragOver(false);
    if (target === 'favicon') setFaviconDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0], target);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | 'dark' | 'favicon') => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0], target);
    }
  };

  const handleRemoveMainLogo = () => {
    setSettings((prev) => ({
      ...prev,
      logoUrl: '',
      logoFileName: undefined,
      logoFileSize: undefined,
      logoType: 'default_svg',
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSaveSuccess(false);
  };

  const handleRemoveDarkLogo = () => {
    setSettings((prev) => ({
      ...prev,
      logoDarkUrl: '',
      logoDarkFileName: undefined,
    }));
    if (darkFileInputRef.current) darkFileInputRef.current.value = '';
    setSaveSuccess(false);
  };

  const handleRemoveFavicon = () => {
    setSettings((prev) => ({
      ...prev,
      faviconUrl: '',
    }));
    if (faviconFileInputRef.current) faviconFileInputRef.current.value = '';
    setSaveSuccess(false);
  };

  // Color preset templates
  const COLOR_PALETTES = [
    {
      name: 'MB Oficial (CMYK Gráfico)',
      primary: '#E6007E',
      secondary: '#00AEEF',
      accent: '#FFDD00',
    },
    {
      name: 'Elegance Blue & Gold',
      primary: '#0284C7',
      secondary: '#0F172A',
      accent: '#F59E0B',
    },
    {
      name: 'Eco Nature Sustentável',
      primary: '#059669',
      secondary: '#10B981',
      accent: '#FBBF24',
    },
    {
      name: 'Luxury Noir Black Edition',
      primary: '#18181B',
      secondary: '#E6007E',
      accent: '#38BDF8',
    },
    {
      name: 'Creative Tech Purple',
      primary: '#7C3AED',
      secondary: '#06B6D4',
      accent: '#F43F5E',
    },
  ];

  const handleApplyPalette = (palette: { primary: string; secondary: string; accent: string }) => {
    setSettings((prev) => ({
      ...prev,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      accentColor: palette.accent,
    }));
    setSaveSuccess(false);
  };

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    setErrorMessage(null);

    // Validate essential fields
    if (!settings.name?.trim()) {
      setErrorMessage('Por favor, preencha o Nome Fantasia da empresa na aba Informações Gerais.');
      setActiveSubSection('geral');
      return;
    }
    if (!settings.whatsapp?.trim()) {
      setErrorMessage('Por favor, informe o número de WhatsApp da empresa.');
      setActiveSubSection('geral');
      return;
    }
    if (!settings.email?.trim()) {
      setErrorMessage('Por favor, informe o E-mail de atendimento da empresa.');
      setActiveSubSection('geral');
      return;
    }
    if (!settings.cnpj?.trim()) {
      setErrorMessage('Por favor, informe o CNPJ da empresa na aba Dados Fiscais.');
      setActiveSubSection('fiscal');
      return;
    }

    const result = StorageService.saveCompanySettings(settings);
    const visResult = await StorageService.savePriceVisibilityMode(priceVisibilityMode);

    if (result.success && visResult.success) {
      setSaveSuccess(true);
      setErrorMessage(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
    } else if (!visResult.success) {
      setErrorMessage(visResult.error || 'Erro ao salvar configuração de visibilidade dos preços.');
    } else {
      setErrorMessage(result.error || 'Erro ao salvar alterações no armazenamento.');
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Deseja restaurar as configurações padrão e logotipo original da MB Personaliza?')) {
      StorageService.resetCompanySettings();
      setSettings(StorageService.getCompanySettings());
      setSaveSuccess(true);
      setErrorMessage(null);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    }
  };

  // Maintenance Mode Management Handlers
  const currentMaint = settings.maintenance || INITIAL_MAINTENANCE_SETTINGS;

  const handleToggleMaintenanceMode = (enable: boolean) => {
    if (enable) {
      const confirmActivate = window.confirm(
        'Ao ativar o modo de manutenção, os usuários não administradores serão direcionados para a página de manutenção. Deseja continuar?'
      );
      if (!confirmActivate) return;
    } else {
      const confirmDeactivate = window.confirm(
        'Deseja desativar o modo de manutenção e liberar o acesso público ao sistema para todos os clientes?'
      );
      if (!confirmDeactivate) return;
    }

    const adminUser = currentUser || {
      id: 'admin',
      name: 'Administrador',
      email: 'admin@mbpersonaliza.com.br',
      role: 'admin' as const,
      active: true,
      createdAt: '',
    };

    const res = StorageService.toggleMaintenanceMode(enable, adminUser, currentMaint.returnAt);

    if (res.success) {
      const fresh = StorageService.getCompanySettings();
      setSettings(fresh);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      showError(res.error || 'Erro ao alterar o status do modo de manutenção.');
    }
  };

  const handleUpdateMaintenanceField = <K extends keyof MaintenanceSettings>(
    field: K,
    value: MaintenanceSettings[K]
  ) => {
    const updated: MaintenanceSettings = {
      ...currentMaint,
      [field]: value,
    };
    setSettings((prev) => ({
      ...prev,
      maintenance: updated,
    }));
  };

  const handleSaveMaintenanceConfig = () => {
    const adminUser = currentUser || {
      id: 'admin',
      name: 'Administrador',
      email: 'admin@mbpersonaliza.com.br',
      role: 'admin' as const,
      active: true,
      createdAt: '',
    };

    const res = StorageService.saveMaintenanceSettings(
      currentMaint,
      adminUser,
      'config_updated'
    );

    if (res.success) {
      const fresh = StorageService.getCompanySettings();
      setSettings(fresh);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      showError(res.error || 'Erro ao salvar configurações de manutenção.');
    }
  };

  const handleSetPresetReturnTime = (hoursAhead: number) => {
    const date = new Date(Date.now() + hoursAhead * 3600 * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formatted = `${day}/${month}/${year} às ${hours}:${minutes}`;
    handleUpdateMaintenanceField('returnAt', formatted);
  };

  const handleResetMaintenanceConfig = () => {
    if (
      window.confirm(
        'Deseja restaurar as mensagens, temas e ícones padrão da página de manutenção?'
      )
    ) {
      const adminUser = currentUser || {
        id: 'admin',
        name: 'Administrador',
        email: 'admin@mbpersonaliza.com.br',
        role: 'admin' as const,
        active: true,
        createdAt: '',
      };
      const resetMaint: MaintenanceSettings = {
        ...INITIAL_MAINTENANCE_SETTINGS,
        enabled: currentMaint.enabled,
        auditLog: currentMaint.auditLog,
      };
      const res = StorageService.saveMaintenanceSettings(
        resetMaint,
        adminUser,
        'config_updated'
      );
      if (res.success) {
        setSettings(StorageService.getCompanySettings());
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E6007E]/20 to-[#00AEEF]/20 flex items-center justify-center text-[#E6007E] border border-pink-200">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black uppercase text-slate-900">
              Configurações da Empresa & Identidade Visual
            </h2>
            <p className="text-xs text-slate-500">
              Gerencie dados cadastrais, logotipo exibido no site, canais de atendimento e dados bancários.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 text-xs font-extrabold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </div>

      {/* Success banner */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Configurações salvas com sucesso! O logotipo e os dados foram atualizados em todo o site.</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Sub Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubSection('geral')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubSection === 'geral'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Dados Gerais & Contato</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('whatsapp')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubSection === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-[#25D366]" />
          <span>WhatsApp & Multi-Atendimento</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeSubSection === 'whatsapp' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {settings.whatsappContacts?.length || 1}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('logo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubSection === 'logo'
              ? 'bg-[#E6007E] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Logotipo & Identidade Visual</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('fiscal')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubSection === 'fiscal'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-[#00AEEF]" />
          <span>Dados Fiscais & Endereço</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('pagamento')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubSection === 'pagamento'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4 text-[#FFDD00]" />
          <span>Chave PIX & Conta Bancária</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('manutencao')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubSection === 'manutencao'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-amber-200/60'
          }`}
        >
          <Wrench className="w-4 h-4 text-amber-500" />
          <span>Modo de Manutenção</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 ${
              settings.maintenance?.enabled
                ? 'bg-amber-400 text-amber-950 animate-pulse'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                settings.maintenance?.enabled ? 'bg-amber-950' : 'bg-emerald-600'
              }`}
            />
            {settings.maintenance?.enabled ? 'EM MANUTENÇÃO' : 'ONLINE'}
          </span>
        </button>
      </div>

      {/* FORM CONTENT */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SUBSECTION: GERAL & CONTATO */}
        {activeSubSection === 'geral' && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h3 className="text-base font-extrabold uppercase font-heading text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#E6007E]" />
              <span>Identificação & Comunicação</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Fantasia (Marca)</label>
                <input
                  type="text"
                  required
                  value={settings.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="MB Personaliza"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Slogan Comercial (Tagline)</label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="Brindes Corporativos, Presentes Exclusivos & Comunicação Visual"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">WhatsApp Principal / Vendas</label>
                  <button
                    type="button"
                    onClick={() => setActiveSubSection('whatsapp')}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Gerenciar {settings.whatsappContacts?.length || 1} Números &raquo;</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={settings.whatsapp}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    handleInputChange('whatsapp', formatted);
                    // Also sync the default contact if present
                    if (settings.whatsappContacts && settings.whatsappContacts.length > 0) {
                      const updated = settings.whatsappContacts.map((c) =>
                        c.isDefault ? { ...c, number: formatted } : c
                      );
                      setSettings((prev) => ({ ...prev, whatsappContacts: updated }));
                    }
                  }}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500 font-mono font-medium"
                  placeholder="(11) 98765-4321"
                />
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Este é o número principal exibido por padrão.</span>
                  <span className="text-emerald-600 font-semibold">{settings.whatsappContacts?.length || 1} canal(is) configurado(s)</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telefone Fixo / PABX</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="(11) 3222-1000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Atendimento Geral</label>
                <input
                  type="email"
                  required
                  value={settings.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="contato@mbpersonaliza.com.br"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Comercial (Orçamentos)</label>
                <input
                  type="email"
                  value={settings.salesEmail || ''}
                  onChange={(e) => handleInputChange('salesEmail', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="vendas@mbpersonaliza.com.br"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Financeiro</label>
                <input
                  type="email"
                  value={settings.financeEmail || ''}
                  onChange={(e) => handleInputChange('financeEmail', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="financeiro@mbpersonaliza.com.br"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Website Oficial</label>
                <input
                  type="text"
                  value={settings.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="https://mbpersonaliza.com.br"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instagram (@)</label>
                <input
                  type="text"
                  value={settings.socialLinks?.instagram || ''}
                  onChange={(e) => handleSocialChange('instagram', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="@mbpersonaliza"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Facebook</label>
                <input
                  type="text"
                  value={settings.socialLinks?.facebook || ''}
                  onChange={(e) => handleSocialChange('facebook', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="mbpersonalizabrindes"
                />
              </div>
            </div>

            {/* Operational settings */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider mb-3">
                Parâmetros Operacionais da Loja
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prazo Médio de Produção (Dias Úteis)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.standardProductionDays}
                    onChange={(e) => handleInputChange('standardProductionDays', parseInt(e.target.value) || 7)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valor Mínimo de Pedido (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.minOrderValue}
                    onChange={(e) => handleInputChange('minOrderValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observações de Envio / Retirada
                  </label>
                  <input
                    type="text"
                    value={settings.shippingNotes || ''}
                    onChange={(e) => handleInputChange('shippingNotes', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                    placeholder="Retirada grátis em nosso balcão ou envio via Sedex, PAC e transportadoras com seguro."
                  />
                </div>
              </div>
            </div>

            {/* VISIBILIDADE DOS PREÇOS DOS PRODUTOS */}
            <div className="pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#E6007E]" />
                    <span>VISIBILIDADE DOS PREÇOS DOS PRODUTOS</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Defina se os preços do catálogo são exibidos apenas para clientes cadastrados e autenticados ou para todos os visitantes da loja.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    priceVisibilityMode === 'registered_only'
                      ? 'bg-pink-100 text-[#E6007E]'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {priceVisibilityMode === 'registered_only'
                    ? 'Restrito a Clientes Cadastrados'
                    : 'Visível para Todos'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    priceVisibilityMode === 'registered_only'
                      ? 'border-[#E6007E] bg-pink-50/50 shadow-xs'
                      : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="priceVisibilityMode"
                    value="registered_only"
                    checked={priceVisibilityMode === 'registered_only'}
                    onChange={() => {
                      setPriceVisibilityMode('registered_only');
                      setSaveSuccess(false);
                    }}
                    className="mt-1 accent-[#E6007E]"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-900 uppercase">
                      OPÇÃO 1 – PREÇOS VISÍVEIS SOMENTE PARA CLIENTES CADASTRADOS
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Visitantes não autenticados navegam normalmente pelos produtos, imagens e descrições, porém os valores ficam ocultos até entrarem ou criarem uma conta.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    priceVisibilityMode === 'all'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="priceVisibilityMode"
                    value="all"
                    checked={priceVisibilityMode === 'all'}
                    onChange={() => {
                      setPriceVisibilityMode('all');
                      setSaveSuccess(false);
                    }}
                    className="mt-1 accent-emerald-600"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-900 uppercase">
                      OPÇÃO 2 – PREÇOS VISÍVEIS PARA TODOS
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Todos os visitantes e clientes cadastrados visualizam os preços, faixas de desconto e valores diretamente na vitrine pública.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION: WHATSAPP & MULTI-ATENDIMENTO */}
        {activeSubSection === 'whatsapp' && (
          <div className="space-y-6">
            {/* Header & Quick Action Card */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100 text-[#25D366] flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                    </span>
                    <h3 className="text-base font-extrabold uppercase font-heading text-slate-900">
                      Canais de Atendimento WhatsApp (Multi-números)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                    Configure mais de um número de WhatsApp para atender seus clientes com agilidade (Vendas, Suporte, Grandes Contas PJ, Financeiro etc.). Os visitantes poderão escolher com quem falar em qualquer parte da loja.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAddWhatsApp()}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Número WhatsApp</span>
                </button>
              </div>

              {/* Quick Presets row */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
                <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Adicionar canal rapidamente usando modelo:</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      name: 'Vendas & Cotações Rápidas',
                      department: 'Comercial',
                      hours: 'Seg a Sex: 08:30 às 18:30',
                      customMessage: 'Olá! Gostaria de fazer uma cotação de brindes personalizados na MB Personaliza.',
                    },
                    {
                      name: 'Suporte & Acompanhamento de Pedidos',
                      department: 'Pós-Venda',
                      hours: 'Seg a Sex: 08:30 às 18:00',
                      customMessage: 'Olá! Preciso de suporte sobre meu pedido ou entrega.',
                    },
                    {
                      name: 'Grandes Contas Corporativas (PJ)',
                      department: 'Corporativo B2B',
                      hours: 'Seg a Sex: 09:00 às 18:00',
                      customMessage: 'Olá! Sou de uma empresa e gostaria de solicitar uma proposta especial para grandes quantidades.',
                    },
                    {
                      name: 'Financeiro & Faturamento',
                      department: 'Financeiro',
                      hours: 'Seg a Sex: 09:00 às 17:00',
                      customMessage: 'Olá! Falo a respeito de nota fiscal, faturamento ou boleto.',
                    },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOpenAddWhatsApp(preset)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100/70 hover:border-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Configured WhatsApp Numbers Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Números Cadastrados ({settings.whatsappContacts?.length || 1})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    O número marcado como <strong>Principal</strong> é sincronizado com o rodapé e cabeçalho padrão.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(settings.whatsappContacts || [
                    {
                      id: 'default',
                      name: 'Atendimento & Vendas',
                      number: settings.whatsapp || '(11) 98765-4321',
                      department: 'Comercial',
                      hours: 'Seg a Sex: 08:30 às 18:30',
                      customMessage: 'Olá! Gostaria de um orçamento.',
                      isDefault: true,
                      active: true,
                    },
                  ]).map((contact) => {
                    const cleanNum = contact.number.replace(/\D/g, '');
                    const testUrl = `https://wa.me/55${cleanNum}?text=${encodeURIComponent(
                      contact.customMessage || 'Olá! Gostaria de informações.'
                    )}`;

                    return (
                      <div
                        key={contact.id}
                        className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all ${
                          contact.isDefault
                            ? 'bg-gradient-to-br from-emerald-50/50 via-white to-white border-emerald-300 shadow-xs'
                            : contact.active === false
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        {/* Top info */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                                <MessageSquare className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="text-sm font-bold text-slate-900">{contact.name}</h5>
                                  {contact.isDefault && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-2xs">
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      Principal
                                    </span>
                                  )}
                                </div>
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                  Setor: {contact.department || 'Geral'}
                                </span>
                              </div>
                            </div>

                            {/* Active toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleWhatsAppActive(contact.id)}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                                contact.active !== false
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-slate-100 border-slate-300 text-slate-500'
                              }`}
                              title="Clique para ativar/pausar este número no site"
                            >
                              <span className={`w-2 h-2 rounded-full ${contact.active !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                              {contact.active !== false ? 'Ativo' : 'Pausado'}
                            </button>
                          </div>

                          {/* Phone Number Display */}
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                                Número WhatsApp
                              </span>
                              <span className="text-sm font-mono font-bold text-slate-900">
                                {contact.number}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyNumber(contact.id, contact.number)}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title="Copiar número"
                            >
                              {copiedNumberId === contact.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Hours & Message */}
                          <div className="space-y-1.5 text-xs text-slate-600">
                            {contact.hours && (
                              <p className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{contact.hours}</span>
                              </p>
                            )}
                            {contact.customMessage && (
                              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 italic">
                                &ldquo;{contact.customMessage}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions footer */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={testUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                              title="Abrir WhatsApp Web para testar este número"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Testar Conversa</span>
                            </a>

                            {!contact.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultWhatsAppContact(contact.id)}
                                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Tornar este o número principal da loja"
                              >
                                Tornar Principal
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleOpenEditWhatsApp(contact)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Editar este canal de WhatsApp"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWhatsAppContact(contact.id)}
                              disabled={(settings.whatsappContacts?.length || 1) <= 1}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer"
                              title={(settings.whatsappContacts?.length || 1) <= 1 ? 'Mínimo de 1 número necessário' : 'Remover este número'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Interactive Customer Preview Simulator Card */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#00AEEF]" />
                  <h4 className="text-xs font-extrabold uppercase font-heading text-slate-900">
                    Simulador: Como o Cliente Visualiza no Site
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Visualização em tempo real dos canais ativos
                </span>
              </div>

              <div className="bg-slate-950 rounded-2xl p-6 text-white space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block">
                      Topo do Site (Barra de Contatos)
                    </span>
                    <p className="text-xs text-slate-300 mt-0.5">
                      O cliente vê o número principal com indicador de multi-atendimento:
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                    <span>WhatsApp: {settings.whatsapp || '(11) 98765-4321'}</span>
                    {(settings.whatsappContacts?.length || 1) > 1 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#25D366] text-black font-extrabold">
                        +{(settings.whatsappContacts?.length || 1) - 1} Canais
                      </span>
                    )}
                  </div>
                </div>

                {/* Popover simulation preview */}
                <div>
                  <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block mb-3">
                    Janela Modal / Seletor de Contatos
                  </span>
                  <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden text-slate-900 border border-slate-200">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <h5 className="text-sm font-bold">Falar pelo WhatsApp</h5>
                      </div>
                      <p className="text-[11px] text-emerald-100 mt-1">
                        Escolha um de nossos canais disponíveis para iniciar o atendimento:
                      </p>
                    </div>

                    <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
                      {(settings.whatsappContacts || []).filter(c => c.active !== false).map((c, i) => (
                        <div
                          key={c.id || i}
                          className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">{c.name}</span>
                              {c.isDefault && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                                  Principal
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-500">{c.number} • {c.department}</span>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-[#25D366] text-white text-[10px] font-bold">
                            Chamar
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal for Adding / Editing WhatsApp Contact */}
            {isWhatsAppModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-[#25D366]" />
                      </span>
                      <h4 className="text-sm font-extrabold uppercase font-heading text-slate-900">
                        {editingWhatsAppContact ? 'Editar Canal de WhatsApp' : 'Adicionar Novo Canal de WhatsApp'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsWhatsAppModalOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveWhatsAppContact} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome de Identificação do Canal / Atendente *
                      </label>
                      <input
                        type="text"
                        required
                        value={whatsAppFormData.name || ''}
                        onChange={(e) =>
                          setWhatsAppFormData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                        placeholder="Ex: Vendas Corporativas - Consultora Camila"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Número com DDD *
                        </label>
                        <input
                          type="text"
                          required
                          value={whatsAppFormData.number || ''}
                          onChange={(e) =>
                            setWhatsAppFormData((prev) => ({
                              ...prev,
                              number: formatPhoneNumber(e.target.value),
                            }))
                          }
                          className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500 font-mono font-medium"
                          placeholder="(11) 98765-4321"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Departamento / Setor
                        </label>
                        <input
                          type="text"
                          value={whatsAppFormData.department || ''}
                          onChange={(e) =>
                            setWhatsAppFormData((prev) => ({ ...prev, department: e.target.value }))
                          }
                          className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                          placeholder="Ex: Comercial, Suporte, PJ"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Horário de Atendimento
                      </label>
                      <input
                        type="text"
                        value={whatsAppFormData.hours || ''}
                        onChange={(e) =>
                          setWhatsAppFormData((prev) => ({ ...prev, hours: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                        placeholder="Ex: Seg a Sex: 08:30 às 18:30"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mensagem Pré-configurada ao Iniciar a Conversa
                      </label>
                      <textarea
                        rows={3}
                        value={whatsAppFormData.customMessage || ''}
                        onChange={(e) =>
                          setWhatsAppFormData((prev) => ({ ...prev, customMessage: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                        placeholder="Ex: Olá! Gostaria de falar com o time de vendas da MB Personaliza sobre brindes..."
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Esta mensagem será preenchida automaticamente na tela do WhatsApp do cliente quando ele clicar.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={whatsAppFormData.isDefault || false}
                          onChange={(e) =>
                            setWhatsAppFormData((prev) => ({ ...prev, isDefault: e.target.checked }))
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Definir este canal como o Principal da Loja</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={whatsAppFormData.active !== false}
                          onChange={(e) =>
                            setWhatsAppFormData((prev) => ({ ...prev, active: e.target.checked }))
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Canal Ativo (visível para os clientes no site)</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsWhatsAppModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-xs font-extrabold bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Salvar Canal</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBSECTION: LOGO & IDENTIDADE VISUAL */}
        {activeSubSection === 'logo' && (
          <div className="space-y-6">
            {/* Main Logo Card */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold uppercase font-heading text-slate-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-[#00AEEF]" />
                    <span>Logotipo & Identidade Visual</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Anexe o arquivo de imagem do seu computador/celular ou utilize o logotipo vetorial institucional.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-pink-50 text-[#E6007E] border border-pink-200">
                    {settings.logoType === 'custom_image' ? 'Imagem Customizada' : 'Logo Vetorial MB'}
                  </span>
                </div>
              </div>

              {/* Multi-surface Live Preview Simulator */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Simulador de Aplicação em Tempo Real
                    </span>
                  </div>

                  {/* Surface Selector Buttons */}
                  <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPreviewSurface('light')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        previewSurface === 'light'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>Fundo Claro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSurface('dark')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        previewSurface === 'dark'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Moon className="w-3 h-3 text-indigo-400" />
                      <span>Fundo Escuro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSurface('navbar')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        previewSurface === 'navbar'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Laptop className="w-3 h-3 text-sky-500" />
                      <span>Simulador Navbar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSurface('doc')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        previewSurface === 'doc'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3 h-3 text-[#E6007E]" />
                      <span>Folha Timbrada</span>
                    </button>
                  </div>
                </div>

                {/* Surface Display Area */}
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  {previewSurface === 'light' && (
                    <div className="bg-white p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Aplicação em Fundo Branco (Cabeçalhos / Loja):
                        </span>
                        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 inline-block">
                          <Logo size="lg" customSettings={settings} />
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Versão Compacta (Ícone):</span>
                        <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 inline-flex items-center justify-center ml-auto block">
                          <Logo size="md" layout="icon-only" customSettings={settings} />
                        </div>
                      </div>
                    </div>
                  )}

                  {previewSurface === 'dark' && (
                    <div className="bg-[#0F172A] p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-white">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Aplicação em Fundo Escuro (Rodapé / Painel Admin):
                        </span>
                        <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 inline-block">
                          <Logo size="lg" variant="dark" customSettings={settings} />
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Versão Compacta:</span>
                        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 inline-flex items-center justify-center ml-auto block">
                          <Logo size="md" layout="icon-only" variant="dark" customSettings={settings} />
                        </div>
                      </div>
                    </div>
                  )}

                  {previewSurface === 'navbar' && (
                    <div className="bg-white p-3 border-b border-slate-200">
                      <div className="bg-white/95 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-xs">
                        <Logo size="sm" customSettings={settings} />
                        <div className="hidden md:flex items-center gap-4 text-xs font-semibold text-slate-600">
                          <span className="text-[#E6007E] font-bold">Início</span>
                          <span>Catálogo</span>
                          <span>Brindes VIP</span>
                          <span>Orçamento Rápido</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-3 py-1 bg-[#E6007E] text-white rounded-lg shadow-xs">
                            Simular Pedido
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewSurface === 'doc' && (
                    <div className="bg-white p-6 border-b border-slate-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <Logo size="md" customSettings={settings} />
                        <div className="text-right text-[11px] text-slate-500">
                          <p className="font-bold text-slate-800">{settings.corporateName}</p>
                          <p>CNPJ: {settings.cnpj} | IE: {settings.stateRegistration || 'Isento'}</p>
                          <p>{settings.email} | {settings.phone}</p>
                        </div>
                      </div>
                      <div className="p-3 bg-pink-50/50 rounded-xl border border-pink-100 text-xs text-slate-700 flex items-center justify-between">
                        <span><strong>PROPOSTA COMERCIAL Nº:</strong> ORC-2026-0099</span>
                        <span className="text-[#E6007E] font-bold">LAYOUT HOMOLOGADO</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Logo Selection Mode */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Modo de Exibição do Logotipo
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label
                    className={`p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      settings.logoType === 'default_svg'
                        ? 'border-[#E6007E] bg-pink-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="logoType"
                      value="default_svg"
                      checked={settings.logoType === 'default_svg'}
                      onChange={() => handleInputChange('logoType', 'default_svg')}
                      className="mt-1 text-[#E6007E]"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Logo Vetorial Nativa MB Personaliza</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Emblema com xícara, caneta, caderno, camiseta e garrafa em alta resolução vetorial.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      settings.logoType === 'custom_image'
                        ? 'border-[#00AEEF] bg-sky-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="logoType"
                      value="custom_image"
                      checked={settings.logoType === 'custom_image'}
                      onChange={() => handleInputChange('logoType', 'custom_image')}
                      className="mt-1 text-[#00AEEF]"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Logotipo Customizado (Anexo do Dispositivo / Imagem)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Carregue um arquivo PNG transparente, SVG, WebP ou JPG diretamente do seu computador ou celular.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Main Logo Device Upload Dropzone */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-[#00AEEF]" />
                      <span>Anexar Arquivo de Imagem do Dispositivo (Logotipo Principal)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Arraste o arquivo ou clique para buscar no seu dispositivo. O arquivo é processado e salvo localmente.
                    </p>
                  </div>
                  {settings.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveMainLogo}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover Anexo</span>
                    </button>
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp, image/gif"
                  onChange={(e) => handleFileInputChange(e, 'main')}
                  className="hidden"
                  id="main-logo-file-input"
                />

                {/* Drop Area */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setLogoDragOver(true);
                  }}
                  onDragLeave={() => setLogoDragOver(false)}
                  onDrop={(e) => handleFileDrop(e, 'main')}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                    logoDragOver
                      ? 'border-[#00AEEF] bg-sky-50 scale-[1.01]'
                      : 'border-slate-300 hover:border-[#00AEEF] hover:bg-slate-50/80 bg-slate-50/40'
                  }`}
                >
                  {isProcessingFile ? (
                    <div className="py-4 flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-8 h-8 text-[#00AEEF] animate-spin" />
                      <p className="text-xs font-bold text-slate-700">Processando imagem do dispositivo...</p>
                    </div>
                  ) : settings.logoUrl ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                      {/* Thumbnail Preview with transparency checkerboard background */}
                      <div className="w-28 h-24 rounded-xl border border-slate-200 p-2 flex items-center justify-center bg-white shadow-xs relative group overflow-hidden">
                        <img
                          src={settings.logoUrl}
                          alt="Logotipo Anexado"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      <div className="text-left space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <FileCheck className="w-3 h-3" />
                            Arquivo Anexado com Sucesso
                          </span>
                          {settings.logoFileSize && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({settings.logoFileSize})
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900">
                          {settings.logoFileName || 'logotipo-personalizado.png'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Clique em qualquer lugar nesta caixa para substituir por outro arquivo de imagem.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-2">
                      <div className="w-12 h-12 rounded-2xl bg-sky-100 text-[#00AEEF] flex items-center justify-center shadow-xs">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Clique para selecionar do computador/celular ou arraste o arquivo até aqui
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Suporta PNG transparente, SVG, WebP, JPG ou GIF (Recomendado: 300x120px ou superior)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#00AEEF] hover:bg-[#009bd6] transition-all shadow-xs"
                      >
                        <FileImage className="w-3.5 h-3.5" />
                        <span>Selecionar Arquivo de Imagem</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Alternative URL Link input */}
                <div className="pt-2">
                  <details className="group">
                    <summary className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer select-none flex items-center gap-1">
                      <span>Ou se preferir, informar URL / Link externo da imagem</span>
                    </summary>
                    <div className="mt-3 space-y-2 pl-2 border-l-2 border-slate-200">
                      <label className="block text-xs font-bold text-slate-700">URL da Imagem na Web</label>
                      <input
                        type="url"
                        value={settings.logoUrl || ''}
                        onChange={(e) => {
                          handleInputChange('logoUrl', e.target.value);
                          if (e.target.value) handleInputChange('logoType', 'custom_image');
                        }}
                        placeholder="https://sua-empresa.com.br/imagens/logo.png"
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                      />
                    </div>
                  </details>
                </div>
              </div>

              {/* Secondary Assets: Dark Logo & Favicon */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                {/* Dark Logo Upload */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1">
                        <Moon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Logo para Fundo Escuro (Opcional)</span>
                      </h5>
                      <p className="text-[10px] text-slate-500">Versão com cores invertidas / branca para o rodapé escuro</p>
                    </div>
                    {settings.logoDarkUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveDarkLogo}
                        className="text-[10px] font-bold text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <input
                    ref={darkFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileInputChange(e, 'dark')}
                    className="hidden"
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDarkLogoDragOver(true);
                    }}
                    onDragLeave={() => setDarkLogoDragOver(false)}
                    onDrop={(e) => handleFileDrop(e, 'dark')}
                    onClick={() => darkFileInputRef.current?.click()}
                    className={`p-4 rounded-xl border border-dashed text-center cursor-pointer transition-all ${
                      darkLogoDragOver
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-slate-300 hover:border-indigo-400 bg-white'
                    }`}
                  >
                    {settings.logoDarkUrl ? (
                      <div className="flex items-center justify-center gap-3 bg-[#0F172A] p-2 rounded-lg">
                        <img
                          src={settings.logoDarkUrl}
                          alt="Logo Versão Escura"
                          className="h-8 object-contain"
                        />
                        <span className="text-[10px] text-slate-300 font-bold truncate max-w-[150px]">
                          {settings.logoDarkFileName || 'Logo Dark'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-600 flex flex-col items-center gap-1">
                        <UploadCloud className="w-4 h-4 text-indigo-500" />
                        <span>Clique para anexar arquivo para fundo escuro</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Favicon Upload */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Ícone / Favicon do Navegador (Opcional)</span>
                      </h5>
                      <p className="text-[10px] text-slate-500">Ícone quadrado (1:1) para a aba do navegador</p>
                    </div>
                    {settings.faviconUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveFavicon}
                        className="text-[10px] font-bold text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <input
                    ref={faviconFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileInputChange(e, 'favicon')}
                    className="hidden"
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setFaviconDragOver(true);
                    }}
                    onDragLeave={() => setFaviconDragOver(false)}
                    onDrop={(e) => handleFileDrop(e, 'favicon')}
                    onClick={() => faviconFileInputRef.current?.click()}
                    className={`p-4 rounded-xl border border-dashed text-center cursor-pointer transition-all ${
                      faviconDragOver
                        ? 'border-amber-500 bg-amber-50/50'
                        : 'border-slate-300 hover:border-amber-400 bg-white'
                    }`}
                  >
                    {settings.faviconUrl ? (
                      <div className="flex items-center justify-center gap-3 p-1">
                        <img
                          src={settings.faviconUrl}
                          alt="Favicon"
                          className="w-7 h-7 object-contain rounded-md shadow-xs"
                        />
                        <span className="text-[10px] text-slate-600 font-bold">Favicon Carregado</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-600 flex flex-col items-center gap-1">
                        <UploadCloud className="w-4 h-4 text-amber-500" />
                        <span>Clique para anexar ícone quadrado (.ico / .png)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Identity & Brand Color Palettes */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-extrabold uppercase font-heading text-slate-900 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-[#E6007E]" />
                  <span>Paleta Cromática & Slogan Institucional</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Configure as cores primária, secundária e destaque que compõem a identidade visual da empresa.
                </p>
              </div>

              {/* Color Preset Palette Cards */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Paletas Pré-configuradas da Empresa:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {COLOR_PALETTES.map((palette) => {
                    const isSelected =
                      (settings.primaryColor || '#E6007E') === palette.primary &&
                      (settings.secondaryColor || '#00AEEF') === palette.secondary;
                    return (
                      <button
                        key={palette.name}
                        type="button"
                        onClick={() => handleApplyPalette(palette)}
                        className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-[#E6007E] bg-pink-50/50 shadow-xs ring-1 ring-[#E6007E]'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-900">{palette.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: palette.primary }}
                              title="Cor Primária"
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: palette.secondary }}
                              title="Cor Secundária"
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: palette.accent }}
                              title="Cor Destaque"
                            />
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#E6007E]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Individual Custom Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Cor Primária (Destaque Principal)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor || '#E6007E'}
                      onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                      className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor || '#E6007E'}
                      onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#E6007E]"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Cor Secundária (Textos e Badges)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor || '#00AEEF'}
                      onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                      className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={settings.secondaryColor || '#00AEEF'}
                      onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#00AEEF]"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Cor de Acento (Alertas e Selos)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.accentColor || '#FFDD00'}
                      onChange={(e) => handleInputChange('accentColor', e.target.value)}
                      className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={settings.accentColor || '#FFDD00'}
                      onChange={(e) => handleInputChange('accentColor', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Tagline & Slogan Display Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Slogan / Subtítulo Institucional
                  </label>
                  <input
                    type="text"
                    value={settings.tagline}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    placeholder="Brindes Corporativos & Comunicação Visual"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  />
                </div>

                <div className="flex items-center justify-start sm:justify-center pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showLogoSubtitle ?? true}
                      onChange={(e) => handleInputChange('showLogoSubtitle', e.target.checked)}
                      className="rounded text-[#E6007E] focus:ring-[#E6007E] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Exibir Slogan / Subtítulo embaixo do Logotipo
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION: DADOS FISCAIS & ENDEREÇO */}
        {activeSubSection === 'fiscal' && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h3 className="text-base font-extrabold uppercase font-heading text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#00AEEF]" />
              <span>Dados Cadastrais & Fiscais da Empresa</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Razão Social (PJ)</label>
                <input
                  type="text"
                  required
                  value={settings.corporateName}
                  onChange={(e) => handleInputChange('corporateName', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  placeholder="MB Personaliza Brindes & Comunicação Visual Ltda"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  required
                  value={settings.cnpj}
                  onChange={(e) => handleInputChange('cnpj', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 font-mono"
                  placeholder="34.567.890/0001-12"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Inscrição Estadual (IE)</label>
                <input
                  type="text"
                  value={settings.stateRegistration || ''}
                  onChange={(e) => handleInputChange('stateRegistration', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 font-mono"
                  placeholder="123.456.789.110"
                />
              </div>
            </div>

            {/* Address */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#E6007E]" />
                <span>Endereço da Sede / Balcão de Retirada</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Logradouro / Rua</label>
                  <input
                    type="text"
                    value={settings.address.street}
                    onChange={(e) => handleAddressChange('street', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                    placeholder="Rua das Indústrias Criativas"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
                  <input
                    type="text"
                    value={settings.address.number}
                    onChange={(e) => handleAddressChange('number', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                    placeholder="450"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Complemento</label>
                  <input
                    type="text"
                    value={settings.address.complement || ''}
                    onChange={(e) => handleAddressChange('complement', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                    placeholder="Galpão 2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    value={settings.address.neighborhood}
                    onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                    placeholder="Vila Leopoldina"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={settings.address.city}
                    onChange={(e) => handleAddressChange('city', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                    placeholder="São Paulo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UF (Estado)</label>
                  <input
                    type="text"
                    value={settings.address.state}
                    onChange={(e) => handleAddressChange('state', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 uppercase"
                    placeholder="SP"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                  <input
                    type="text"
                    value={settings.address.zip}
                    onChange={(e) => handleAddressChange('zip', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 font-mono"
                    placeholder="05303-000"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION: PAGAMENTO & DADOS BANCÁRIOS */}
        {activeSubSection === 'pagamento' && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h3 className="text-base font-extrabold uppercase font-heading text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#FFDD00]" />
              <span>Recebimento via PIX & Dados Bancários PJ</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Chave PIX</label>
                <select
                  value={settings.pixKeyType}
                  onChange={(e) => handleInputChange('pixKeyType', e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                >
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone Celular</option>
                  <option value="random">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chave PIX Oficial</label>
                <input
                  type="text"
                  required
                  value={settings.pixKey}
                  onChange={(e) => handleInputChange('pixKey', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 font-mono"
                  placeholder="34.567.890/0001-12"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Banco / Instituição</label>
                <input
                  type="text"
                  value={settings.bankInfo.bank}
                  onChange={(e) => handleBankChange('bank', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  placeholder="Banco Itaú Unibanco (341)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Agência</label>
                <input
                  type="text"
                  value={settings.bankInfo.agency}
                  onChange={(e) => handleBankChange('agency', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 font-mono"
                  placeholder="0842"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Conta Corrente com Dígito</label>
                <input
                  type="text"
                  value={settings.bankInfo.account}
                  onChange={(e) => handleBankChange('account', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 font-mono"
                  placeholder="45890-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Titular da Conta</label>
                <input
                  type="text"
                  value={settings.bankInfo.holder}
                  onChange={(e) => handleBankChange('holder', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  placeholder="MB Personaliza Brindes Ltda"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION: MODO DE MANUTENÇÃO */}
        {activeSubSection === 'manutencao' && (
          <div className="space-y-6">
            {/* Main Status & Switch Control Card */}
            <div
              className={`p-6 sm:p-8 rounded-2xl border transition-all ${
                currentMaint.enabled
                  ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/10 border-amber-300 shadow-md'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                        currentMaint.enabled
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {currentMaint.enabled ? (
                        <AlertTriangle className="w-6 h-6 text-slate-950" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-heading font-black uppercase text-slate-900">
                          {currentMaint.enabled
                            ? '🟠 Sistema em Manutenção'
                            : '🟢 Sistema Funcionando Normalmente'}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide uppercase ${
                            currentMaint.enabled
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {currentMaint.enabled ? 'ATIVADO' : 'ONLINE'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {currentMaint.enabled
                          ? 'Visitantes e clientes veem exclusivamente a Página de Manutenção. Administradores e gerentes continuam com acesso total ao sistema.'
                          : 'Acesso público totalmente liberado. Loja virtual, PDV, orçamentos e pedidos operando em capacidade normal.'}
                      </p>
                    </div>
                  </div>

                  {currentMaint.updatedAt && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1 pl-10">
                      <span>Última alteração:</span>
                      <span className="font-mono font-medium">
                        {new Date(currentMaint.updatedAt).toLocaleString('pt-BR')}
                      </span>
                      {currentMaint.updatedBy && (
                        <span>por {currentMaint.updatedBy.name} ({currentMaint.updatedBy.email})</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Big Switch / Toggle Control */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentMaint.enabled) {
                          handleToggleMaintenanceMode(false);
                        }
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                        !currentMaint.enabled
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${!currentMaint.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span>DESATIVADO</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!currentMaint.enabled) {
                          handleToggleMaintenanceMode(true);
                        }
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                        currentMaint.enabled
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${currentMaint.enabled ? 'bg-slate-950 animate-pulse' : 'bg-slate-300'}`} />
                      <span>ATIVADO</span>
                    </button>
                  </div>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('maintenance')}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      title="Visualizar a página de manutenção como um visitante"
                    >
                      <Eye className="w-4 h-4 text-[#00AEEF]" />
                      <span>Ver Tela de Manutenção</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Customization Card */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-[#E6007E]" />
                  <div>
                    <h4 className="text-sm font-extrabold uppercase text-slate-900">
                      Personalização da Página de Manutenção
                    </h4>
                    <p className="text-xs text-slate-500">
                      Configure o visual, mensagens, contatos de emergência e previsão de retorno exibidos aos clientes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetMaintenanceConfig}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrões</span>
                </button>
              </div>

              {/* Previsão de Retorno */}
              <div className="space-y-2 bg-amber-50/60 p-4 rounded-xl border border-amber-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Previsão de Retorno (Opcional)</span>
                  </label>
                  <span className="text-[11px] text-slate-500 italic">
                    Se vazio, nenhuma previsão será exibida.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={currentMaint.returnAt || ''}
                    onChange={(e) => handleUpdateMaintenanceField('returnAt', e.target.value)}
                    placeholder="Ex: 18:00 ou 06/10/2026 às 08:00 ou Em breve"
                    className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                  />
                  {currentMaint.returnAt && (
                    <button
                      type="button"
                      onClick={() => handleUpdateMaintenanceField('returnAt', '')}
                      className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 cursor-pointer transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Atalhos rápidos:</span>
                  <button
                    type="button"
                    onClick={() => handleSetPresetReturnTime(1)}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white hover:bg-amber-100 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                  >
                    +1 Hora
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetReturnTime(2)}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white hover:bg-amber-100 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                  >
                    +2 Horas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateMaintenanceField('returnAt', 'Hoje às 18:00')}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white hover:bg-amber-100 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                  >
                    Hoje às 18:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateMaintenanceField('returnAt', 'Hoje às 20:00')}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white hover:bg-amber-100 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                  >
                    Hoje às 20:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateMaintenanceField('returnAt', 'Amanhã às 08:00')}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white hover:bg-amber-100 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                  >
                    Amanhã às 08:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateMaintenanceField('returnAt', 'Voltaremos em breve')}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white hover:bg-amber-100 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                  >
                    Voltaremos em breve
                  </button>
                </div>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Título Principal
                  </label>
                  <input
                    type="text"
                    value={currentMaint.title || ''}
                    onChange={(e) => handleUpdateMaintenanceField('title', e.target.value)}
                    placeholder="Sistema em Manutenção"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Exibido na aba do navegador e no cabeçalho do aviso.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Frase de Destaque (Headline)
                  </label>
                  <input
                    type="text"
                    value={currentMaint.headline || ''}
                    onChange={(e) => handleUpdateMaintenanceField('headline', e.target.value)}
                    placeholder="Estamos realizando algumas melhorias no sistema."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Frase principal em negrito abaixo do título.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mensagem Explicativa Detalhada
                </label>
                <textarea
                  rows={3}
                  value={currentMaint.message || ''}
                  onChange={(e) => handleUpdateMaintenanceField('message', e.target.value)}
                  placeholder="Nosso sistema está temporariamente indisponível para manutenção e atualização. Em breve estaremos de volta."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                />
              </div>

              {/* Theme & Icon Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Theme Style */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Tema Visual da Tela</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateMaintenanceField('themeStyle', 'brand_gradient')}
                      className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                        currentMaint.themeStyle === 'brand_gradient' || !currentMaint.themeStyle
                          ? 'border-[#E6007E] bg-pink-50/50 ring-2 ring-[#E6007E]/30'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-6 w-full rounded-md bg-gradient-to-r from-slate-950 via-[#0d1527] to-slate-950 mb-1.5 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-[#E6007E]" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block">Gradiente Neon</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateMaintenanceField('themeStyle', 'modern_dark')}
                      className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                        currentMaint.themeStyle === 'modern_dark'
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/30'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-6 w-full rounded-md bg-slate-950 mb-1.5 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block">Dark Moderno</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateMaintenanceField('themeStyle', 'clean_light')}
                      className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                        currentMaint.themeStyle === 'clean_light'
                          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/30'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-6 w-full rounded-md bg-slate-100 border border-slate-200 mb-1.5 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-slate-800" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block">Clean Light</span>
                    </button>
                  </div>
                </div>

                {/* Central Icon */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Ícone Central Ilustrativo</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: 'tools', label: 'Ferramenta', icon: Wrench },
                      { id: 'cog', label: 'Engrenagem', icon: Cog },
                      { id: 'server', label: 'Servidor', icon: Server },
                      { id: 'sparkles', label: 'Melhorias', icon: Sparkles },
                      { id: 'rocket', label: 'Foguete', icon: Rocket },
                    ].map((item) => {
                      const IconComp = item.icon;
                      const isSelected = (currentMaint.iconType || 'tools') === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleUpdateMaintenanceField('iconType', item.id as any)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#E6007E] bg-pink-50 ring-2 ring-[#E6007E]/30 text-[#E6007E]'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                          <span className="text-[10px] font-bold truncate max-w-full">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentMaint.showCompanyLogo !== false}
                    onChange={(e) => handleUpdateMaintenanceField('showCompanyLogo', e.target.checked)}
                    className="w-4 h-4 rounded text-[#E6007E] focus:ring-[#E6007E]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Exibir Logotipo da Empresa</span>
                    <span className="text-[11px] text-slate-500">Exibe a marca oficial configurada na aba Logotipo.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentMaint.showContacts !== false}
                    onChange={(e) => handleUpdateMaintenanceField('showContacts', e.target.checked)}
                    className="w-4 h-4 rounded text-[#E6007E] focus:ring-[#E6007E]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Exibir Canais de Atendimento</span>
                    <span className="text-[11px] text-slate-500">Exibe botão de WhatsApp de plantão e e-mail de contato.</span>
                  </div>
                </label>
              </div>

              {/* Save Specific Maintenance Config Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Salve para aplicar as customizações na página de manutenção.
                </span>
                <button
                  type="button"
                  onClick={handleSaveMaintenanceConfig}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#E6007E] hover:bg-[#c9006e] text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#FFDD00]" />
                  <span>Salvar Personalização da Manutenção</span>
                </button>
              </div>
            </div>

            {/* Audit Log Card */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-600" />
                  <h4 className="text-sm font-extrabold uppercase text-slate-900">
                    Histórico de Auditoria do Modo de Manutenção
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500">
                  Registros protegidos contra alteração
                </span>
              </div>

              {currentMaint.auditLog && currentMaint.auditLog.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Ação</th>
                        <th className="py-2.5 px-3">Data e Hora</th>
                        <th className="py-2.5 px-3">Administrador</th>
                        <th className="py-2.5 px-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentMaint.auditLog.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {entry.action === 'activated' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                ATIVAÇÃO
                              </span>
                            )}
                            {entry.action === 'deactivated' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                DESATIVAÇÃO
                              </span>
                            )}
                            {entry.action === 'config_updated' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                                <Sliders className="w-3 h-3" />
                                CONFIGURAÇÃO
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-slate-800 block">{entry.performedBy.name}</span>
                            <span className="text-[10px] text-slate-400">{entry.performedBy.email}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {entry.details || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  Nenhum registro de ativação/desativação registrado até o momento.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global Save Button in footer */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleSave}
            id="btn-save-all-company-settings"
            className="px-6 py-3 text-xs font-extrabold text-white bg-[#E6007E] hover:bg-[#c9006e] rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4 text-[#FFDD00]" />
            <span>Salvar Todas as Configurações da Empresa</span>
          </button>
        </div>
      </form>
    </div>
  );
};
