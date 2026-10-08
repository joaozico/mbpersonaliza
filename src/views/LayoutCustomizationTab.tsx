import React, { useState, useEffect } from 'react';
import {
  Palette,
  Eye,
  Save,
  Send,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Check,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
  Upload,
  AlertCircle,
  HelpCircle,
  Image as ImageIcon,
  Type,
  Layout,
  ExternalLink,
  Shield,
  Zap,
  Truck,
  CheckCircle,
  Clock,
  Sliders,
  X,
  Flame,
  Tag,
  Percent,
  Search,
  Calendar,
} from 'lucide-react';
import {
  SystemLayoutSettings,
  LayoutBlockConfig,
  LayoutColorSettings,
  LayoutSectionType,
  HeroTitlePart,
  OffersBannerSettings,
  OffersBannerProductConfig,
  OffersBannerTransition,
  Product,
} from '../types';
import { StorageService } from '../services/storage';
import { compressImageFile } from '../utils/imageOptimizer';
import { OffersBanner } from '../components/OffersBanner';

interface LayoutCustomizationTabProps {
  onRefreshData?: () => void;
  initialTab?: 'blocks' | 'colors' | 'hero' | 'offers_banner' | 'sections' | 'header_footer' | 'preview';
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const PRESET_PALETTES = [
  {
    name: 'MB Personaliza Original',
    desc: 'Rosa vibrante, azul ciano e amarelo industrial',
    colors: {
      primary: '#E6007E',
      secondary: '#00AEEF',
      accent: '#FFDD00',
      headerBg: '#FFFFFF',
      headerText: '#0F172A',
      topBannerBg: '#0F172A',
      topBannerText: '#F8FAFC',
      footerBg: '#0B0F17',
      footerText: '#94A3B8',
      bodyBg: '#F8FAFC',
      buttonPrimaryBg: '#E6007E',
      buttonPrimaryText: '#FFFFFF',
      priceColor: '#E6007E',
    },
  },
  {
    name: 'Corporativo Premium (Navy & Ouro)',
    desc: 'Azul marinho imponente com dourado refinado',
    colors: {
      primary: '#0F2744',
      secondary: '#D4AF37',
      accent: '#F59E0B',
      headerBg: '#FFFFFF',
      headerText: '#0F172A',
      topBannerBg: '#0B192C',
      topBannerText: '#F1F5F9',
      footerBg: '#0B192C',
      footerText: '#94A3B8',
      bodyBg: '#F8FAFC',
      buttonPrimaryBg: '#0F2744',
      buttonPrimaryText: '#FFFFFF',
      priceColor: '#D4AF37',
    },
  },
  {
    name: 'Modern Industrial (Esmeralda & Carvão)',
    desc: 'Verde esmeralda sofisticado com fundo limpo',
    colors: {
      primary: '#059669',
      secondary: '#0284C7',
      accent: '#FBBF24',
      headerBg: '#FFFFFF',
      headerText: '#0F172A',
      topBannerBg: '#064E3B',
      topBannerText: '#ECFDF5',
      footerBg: '#064E3B',
      footerText: '#A7F3D0',
      bodyBg: '#F8FAFC',
      buttonPrimaryBg: '#059669',
      buttonPrimaryText: '#FFFFFF',
      priceColor: '#059669',
    },
  },
  {
    name: 'Minimal Dark Grafite',
    desc: 'Tons sóbrios de ardósia e grafite com toques de ciano',
    colors: {
      primary: '#2563EB',
      secondary: '#06B6D4',
      accent: '#F59E0B',
      headerBg: '#0F172A',
      headerText: '#F8FAFC',
      topBannerBg: '#020617',
      topBannerText: '#94A3B8',
      footerBg: '#020617',
      footerText: '#64748B',
      bodyBg: '#F1F5F9',
      buttonPrimaryBg: '#2563EB',
      buttonPrimaryText: '#FFFFFF',
      priceColor: '#2563EB',
    },
  },
];

const TITLE_COLOR_PRESETS = [
  { name: 'Branco', hex: '#FFFFFF' },
  { name: 'Grafite', hex: '#0F172A' },
  { name: 'Rosa MB', hex: '#E6007E' },
  { name: 'Ciano MB', hex: '#00AEEF' },
  { name: 'Amarelo MB', hex: '#FFDD00' },
  { name: 'Dourado', hex: '#F59E0B' },
  { name: 'Verde', hex: '#10B981' },
];

export const LayoutCustomizationTab: React.FC<LayoutCustomizationTabProps> = ({
  onRefreshData,
  initialTab,
}) => {
  const [settings, setSettings] = useState<SystemLayoutSettings>(() => {
    // Check if there is an existing draft first
    const draft = StorageService.getLayoutDraft();
    if (draft) return draft;
    return StorageService.getLayoutSettings();
  });

  const [activeTab, setActiveTab] = useState<
    'blocks' | 'colors' | 'hero' | 'offers_banner' | 'sections' | 'header_footer' | 'preview'
  >(initialTab || 'blocks');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [availableProducts, setAvailableProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [isAddingProductToBanner, setIsAddingProductToBanner] = useState<boolean>(false);
  const [bannerProductSearch, setBannerProductSearch] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(() => {
    return StorageService.getLayoutDraft() !== null;
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isUploadingShowcase, setIsUploadingShowcase] = useState<boolean>(false);
  const [isUploadingB2BBg, setIsUploadingB2BBg] = useState<boolean>(false);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Auto-save draft on changes safely in useEffect (not during state updater render)
  const updateSettings = (updater: (prev: SystemLayoutSettings) => SystemLayoutSettings) => {
    setSettings((prev) => updater(prev));
    setHasUnsavedChanges(true);
  };

  useEffect(() => {
    if (hasUnsavedChanges) {
      StorageService.saveLayoutDraft(settings);
    }
  }, [settings, hasUnsavedChanges]);

  // Publish
  const handlePublish = () => {
    const res = StorageService.publishLayout(settings);
    if (res.success) {
      setHasUnsavedChanges(false);
      showNotification('success', 'Layout publicado com sucesso! O site oficial foi atualizado.');
      if (onRefreshData) onRefreshData();
    } else {
      showNotification('error', res.error || 'Erro ao publicar.');
    }
  };

  // Save Draft explicitly
  const handleSaveDraft = () => {
    StorageService.saveLayoutDraft(settings);
    setHasUnsavedChanges(true);
    showNotification('info', 'Rascunho salvo localmente com sucesso.');
  };

  // Discard draft
  const handleDiscard = () => {
    if (!confirm('Deseja descartar as alterações não publicadas e recarregar o layout ativo?')) {
      return;
    }
    StorageService.discardLayoutDraft();
    const published = StorageService.getLayoutSettings();
    setSettings(published);
    setHasUnsavedChanges(false);
    showNotification('info', 'Alterações não salvas foram descartadas.');
  };

  // Reset to factory defaults
  const handleResetDefaults = () => {
    if (!confirm('Atenção: Deseja restaurar o layout para as configurações originais de fábrica?')) {
      return;
    }
    StorageService.resetLayoutSettings();
    const resetSettings = StorageService.getLayoutSettings();
    setSettings(resetSettings);
    setHasUnsavedChanges(false);
    showNotification('success', 'Layout restaurado para os padrões de fábrica.');
    if (onRefreshData) onRefreshData();
  };

  // Title Parts Management (Allow adding, editing, reordering, and deleting multiple parts)
  const currentTitleParts: HeroTitlePart[] =
    settings.hero.titleParts && settings.hero.titleParts.length > 0
      ? settings.hero.titleParts
      : [
          {
            id: 'part-1',
            text: settings.hero.titlePart1 || 'BRINDES CRIATIVOS, PAPELARIA',
            color: settings.hero.titlePart1Color || '#FFFFFF',
            isHighlight: false,
          },
          {
            id: 'part-2',
            text: settings.hero.titleHighlight || 'PERSONALIZADA',
            color: settings.hero.titleHighlightColor || '#FFDD00',
            isHighlight: true,
          },
          {
            id: 'part-3',
            text: settings.hero.titlePart2 || '& COMUNICAÇÃO VISUAL QUE VALORIZAM SUA MARCA',
            color: settings.hero.titlePart2Color || '#E6007E',
            isHighlight: false,
          },
        ];

  const updateTitlePartsList = (newParts: HeroTitlePart[]) => {
    updateSettings((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        titleParts: newParts,
        // Synchronize legacy fields for full backwards compatibility
        titlePart1: newParts[0]?.text || '',
        titlePart1Color: newParts[0]?.color || '#FFFFFF',
        titleHighlight: newParts.find((p) => p.isHighlight)?.text || newParts[1]?.text || '',
        titleHighlightColor: newParts.find((p) => p.isHighlight)?.color || newParts[1]?.color || '#E6007E',
        titlePart2: newParts.length > 2 ? newParts.slice(2).map((p) => p.text).join(' ') : (newParts[2]?.text || ''),
        titlePart2Color: newParts[2]?.color || '#FFFFFF',
      },
    }));
  };

  const handleAddTitlePart = () => {
    const nextIndex = currentTitleParts.length + 1;
    const newPart: HeroTitlePart = {
      id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: `Nova Parte ${nextIndex}`,
      color: nextIndex % 2 === 0 ? '#E6007E' : '#FFFFFF',
      isHighlight: false,
    };
    updateTitlePartsList([...currentTitleParts, newPart]);
    showNotification('success', `Parte ${nextIndex} incluída no título.`);
  };

  const handleUpdateTitlePart = (index: number, updates: Partial<HeroTitlePart>) => {
    const updated = currentTitleParts.map((p, i) => (i === index ? { ...p, ...updates } : p));
    updateTitlePartsList(updated);
  };

  const handleDeleteTitlePart = (index: number) => {
    if (currentTitleParts.length <= 1) {
      showNotification('info', 'O título deve conter pelo menos uma parte.');
      return;
    }
    const partName = currentTitleParts[index]?.text || `Parte ${index + 1}`;
    const updated = currentTitleParts.filter((_, i) => i !== index);
    updateTitlePartsList(updated);
    showNotification('info', `Parte "${partName}" excluída.`);
  };

  const handleMoveTitlePart = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentTitleParts.length) return;
    const updated = [...currentTitleParts];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateTitlePartsList(updated);
  };

  const handleDuplicateTitlePart = (index: number) => {
    const source = currentTitleParts[index];
    const duplicate: HeroTitlePart = {
      ...source,
      id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: `${source.text} (Cópia)`,
    };
    const updated = [...currentTitleParts];
    updated.splice(index + 1, 0, duplicate);
    updateTitlePartsList(updated);
    showNotification('success', 'Parte duplicada com sucesso.');
  };

  // Blocks management
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...settings.blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;

    // Update orders
    const reordered = newBlocks.map((b, i) => ({ ...b, order: i + 1 }));
    updateSettings((prev) => ({ ...prev, blocks: reordered }));
  };

  const toggleBlockVisibility = (blockId: string) => {
    updateSettings((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, isVisible: !b.isVisible } : b)),
    }));
  };

  const duplicateBlock = (block: LayoutBlockConfig) => {
    const newBlock: LayoutBlockConfig = {
      ...block,
      id: `block-${Date.now()}`,
      title: `${block.title} (Cópia)`,
      order: settings.blocks.length + 1,
    };
    updateSettings((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));
    showNotification('success', `Bloco "${block.title}" duplicado.`);
  };

  const removeBlock = (blockId: string) => {
    if (settings.blocks.length <= 1) {
      showNotification('error', 'A página inicial deve conter pelo menos 1 bloco.');
      return;
    }
    if (!confirm('Deseja excluir este bloco da página inicial?')) return;

    const filtered = settings.blocks
      .filter((b) => b.id !== blockId)
      .map((b, i) => ({ ...b, order: i + 1 }));
    updateSettings((prev) => ({ ...prev, blocks: filtered }));
    showNotification('info', 'Bloco removido com sucesso.');
  };

  const addCustomBannerBlock = () => {
    const newBlock: LayoutBlockConfig = {
      id: `banner-${Date.now()}`,
      type: 'custom_banner',
      title: 'Novo Banner Promocional',
      subtitle: 'Campanha especial ou lançamento de brindes',
      isVisible: true,
      order: settings.blocks.length + 1,
      customData: {
        bannerImageUrl:
          'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1200&auto=format&fit=crop&q=80',
        bannerLink: 'quote',
        buttonText: 'Aproveitar Condições Especiais',
        description: 'Tiragens promocionais para grandes volumes corporativos com frete cortesia para SP.',
        backgroundColor: '#0F172A',
      },
    };
    updateSettings((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));
    showNotification('success', 'Novo bloco de banner adicionado.');
  };

  // Offers Banner Management Handlers
  const handleAddProductToOffersBanner = (prod: Product) => {
    const existing = (settings.offersBanner?.items || []).find((i) => i.productId === prod.id);
    if (existing) {
      showNotification('info', `O produto "${prod.name}" já está vinculado ao banner de ofertas.`);
      return;
    }

    const defaultPromo = prod.promo_price || Math.round(prod.base_price * 0.85 * 100) / 100;
    const newItem: OffersBannerProductConfig = {
      productId: prod.id,
      order: (settings.offersBanner?.items?.length || 0) + 1,
      active: true,
      customTitle: prod.name,
      customDescription: prod.description,
      promoPrice: defaultPromo,
      badge: prod.offersBannerBadge || 'OFERTA ESPECIAL',
    };

    const updatedItems = [...(settings.offersBanner?.items || []), newItem];
    updateSettings((prev) => ({
      ...prev,
      offersBanner: {
        ...prev.offersBanner,
        items: updatedItems,
      },
    }));

    StorageService.toggleProductInOffersBanner(prod.id, true, defaultPromo, newItem.badge, newItem.order);
    setAvailableProducts(StorageService.getProducts());
    showNotification('success', `Produto "${prod.name}" adicionado ao banner de ofertas.`);
  };

  const handleRemoveProductFromOffersBanner = (productId: string) => {
    const updatedItems = (settings.offersBanner?.items || []).filter((i) => i.productId !== productId);
    updateSettings((prev) => ({
      ...prev,
      offersBanner: {
        ...prev.offersBanner,
        items: updatedItems,
      },
    }));

    StorageService.toggleProductInOffersBanner(productId, false);
    setAvailableProducts(StorageService.getProducts());
    showNotification('info', 'Produto desvinculado do banner de ofertas.');
  };

  const handleUpdateOfferItem = (index: number, updates: Partial<OffersBannerProductConfig>) => {
    const updatedItems = [...(settings.offersBanner?.items || [])];
    if (!updatedItems[index]) return;
    updatedItems[index] = { ...updatedItems[index], ...updates };

    updateSettings((prev) => ({
      ...prev,
      offersBanner: {
        ...prev.offersBanner,
        items: updatedItems,
      },
    }));
  };

  const handleMoveOfferItem = (index: number, direction: 'up' | 'down') => {
    const items = [...(settings.offersBanner?.items || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const reordered = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    updateSettings((prev) => ({
      ...prev,
      offersBanner: {
        ...prev.offersBanner,
        items: reordered,
      },
    }));
  };

  const handleOfferItemImageUpload = async (index: number, file: File) => {
    try {
      const res = await compressImageFile(file, 1200, 1200, 0.85);
      handleUpdateOfferItem(index, { customImage: res.dataUrl });
      showNotification('success', 'Imagem personalizada do banner carregada com sucesso.');
    } catch {
      showNotification('error', 'Falha ao processar a imagem do banner.');
    }
  };

  const handleSecondaryImageUpload = async (index: number, file: File) => {
    try {
      const res = await compressImageFile(file, 1200, 1200, 0.85);
      handleUpdateOfferItem(index, { secondaryImage: res.dataUrl });
      showNotification('success', 'Imagem do produto complementar carregada.');
    } catch {
      showNotification('error', 'Falha ao processar a imagem complementar.');
    }
  };

  const handleDuplicateOfferItem = (index: number) => {
    const items = [...(settings.offersBanner?.items || [])];
    const target = items[index];
    if (!target) return;

    const copy: OffersBannerProductConfig = {
      ...target,
      id: `slide-copy-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order: items.length + 1,
      customTitle: `${target.customTitle || 'Campanha'} (Cópia)`,
    };

    const updated = [...items, copy];
    updateSettings((prev) => ({
      ...prev,
      offersBanner: {
        ...prev.offersBanner,
        items: updated,
      },
    }));
    showNotification('success', 'Slide do banner duplicado com sucesso.');
  };

  // Drag & drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newBlocks = [...settings.blocks];
    const draggedItem = newBlocks[draggedIndex];
    newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(index, 0, draggedItem);

    const reordered = newBlocks.map((b, i) => ({ ...b, order: i + 1 }));
    setDraggedIndex(index);
    updateSettings((prev) => ({ ...prev, blocks: reordered }));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Upload helpers
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (url: string) => void,
    setLoading: (val: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('error', 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP ou SVG).');
      return;
    }

    try {
      setLoading(true);
      const optimized = await compressImageFile(file, 1280, 720, 0.82);
      onSuccess(optimized.dataUrl);
      showNotification('success', `Imagem carregada e otimizada (${optimized.sizeStr}).`);
    } catch (err: any) {
      showNotification('error', 'Erro ao processar imagem: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* STICKY TOP ACTION BAR */}
      <div className="sticky top-2 z-30 bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#E6007E] to-[#00AEEF] flex items-center justify-center text-white shadow-sm">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-heading font-black uppercase text-slate-900">
                Personalização do Sistema & Layout
              </h2>
              {hasUnsavedChanges ? (
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  Rascunho não publicado
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Publicado e Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Controle visual total: textos, imagens, banners, cores e ordem das seções da loja com prévia em tempo real.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Voltar para valores padrão de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar Padrão</span>
          </button>

          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleDiscard}
              className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Descartar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>Salvar Rascunho</span>
          </button>

          <button
            type="button"
            onClick={handlePublish}
            className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-[#E6007E] to-[#c9006e] hover:from-[#c9006e] hover:to-[#a00058] rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#FFDD00]" />
            <span>Publicar no Site Oficial</span>
          </button>
        </div>
      </div>

      {/* NOTIFICATION */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-sky-50 border border-sky-200 text-sky-800'
          }`}
        >
          {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
          {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          {notification.type === 'info' && <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('blocks')}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border-b-2 cursor-pointer ${
            activeTab === 'blocks'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Blocos & Ordem da Home ({settings.blocks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('colors')}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border-b-2 cursor-pointer ${
            activeTab === 'colors'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Cores & Identidade</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border-b-2 cursor-pointer ${
            activeTab === 'hero'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Hero & CTAs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('offers_banner')}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border-b-2 cursor-pointer ${
            activeTab === 'offers_banner'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Flame className="w-4 h-4 text-[#FFDD00]" />
          <span>Banner de Ofertas</span>
          {settings.offersBanner?.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border-b-2 cursor-pointer ${
            activeTab === 'sections'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Seções & Banners</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('header_footer')}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border-b-2 cursor-pointer ${
            activeTab === 'header_footer'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>Cabeçalho & Rodapé</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border-b-2 cursor-pointer bg-slate-900 text-white rounded-t-xl ml-auto ${
            activeTab === 'preview'
              ? 'border-[#FFDD00] text-[#FFDD00]'
              : 'border-transparent text-slate-300 hover:text-white'
          }`}
        >
          <Eye className="w-4 h-4 text-[#FFDD00]" />
          <span>Pré-Visualização ao Vivo</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: BLOCOS & ORDEM DA HOME
      ======================================================== */}
      {activeTab === 'blocks' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold uppercase text-slate-900">
                Organização & Ordem das Seções da Home
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Arraste os blocos ou utilize os botões para reordenar a vitrine. Oculte ou ative blocos instantaneamente sem perder as configurações.
              </p>
            </div>

            <button
              type="button"
              onClick={addCustomBannerBlock}
              className="px-4 py-2.5 text-xs font-extrabold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-[#FFDD00]" />
              <span>Adicionar Bloco de Banner</span>
            </button>
          </div>

          <div className="space-y-3">
            {settings.blocks.map((block, index) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  draggedIndex === index
                    ? 'border-[#E6007E] ring-2 ring-pink-100 opacity-60 shadow-lg'
                    : block.isVisible
                    ? 'border-slate-200 hover:border-slate-300 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="cursor-grab active:cursor-grabbing p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    title="Arraste para reordenar"
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">{block.title}</h4>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-100 text-slate-600">
                        {block.type}
                      </span>
                      {!block.isVisible && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-rose-100 text-rose-700">
                          Oculto
                        </span>
                      )}
                    </div>
                    {block.subtitle && <p className="text-xs text-slate-500 mt-0.5">{block.subtitle}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Visibility Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleBlockVisibility(block.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      block.isVisible
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    title={block.isVisible ? 'Clique para ocultar da Home' : 'Clique para exibir na Home'}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{block.isVisible ? 'Visível' : 'Oculto'}</span>
                  </button>

                  {/* Move Up */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveBlock(index, 'up')}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Subir posição"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    disabled={index === settings.blocks.length - 1}
                    onClick={() => moveBlock(index, 'down')}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Descer posição"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Duplicate */}
                  <button
                    type="button"
                    onClick={() => duplicateBlock(block)}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                    title="Duplicar bloco"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Delete (if custom banner or more than default) */}
                  {block.type === 'custom_banner' && (
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
                      title="Excluir bloco"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: CORES & IDENTIDADE VISUAL
      ======================================================== */}
      {activeTab === 'colors' && (
        <div className="space-y-6">
          {/* Preset Palettes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold uppercase text-slate-900">
                Paletas Rápidas & Temas Predefinidos
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Selecione uma combinação profissional ou ajuste as cores individualmente abaixo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {PRESET_PALETTES.map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => {
                    updateSettings((prev) => ({ ...prev, colors: { ...preset.colors } }));
                    showNotification('success', `Paleta "${preset.name}" aplicada.`);
                  }}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-[#E6007E] bg-slate-50 hover:bg-white transition-all cursor-pointer group shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900 group-hover:text-[#E6007E] transition-colors">
                      {preset.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-lg shadow-inner" style={{ backgroundColor: preset.colors.primary }} />
                    <div className="w-7 h-7 rounded-lg shadow-inner" style={{ backgroundColor: preset.colors.secondary }} />
                    <div className="w-7 h-7 rounded-lg shadow-inner" style={{ backgroundColor: preset.colors.accent }} />
                    <div className="w-7 h-7 rounded-lg shadow-inner" style={{ backgroundColor: preset.colors.topBannerBg }} />
                    <div className="w-7 h-7 rounded-lg shadow-inner" style={{ backgroundColor: preset.colors.footerBg }} />
                  </div>

                  <p className="text-[11px] text-slate-500 leading-tight">{preset.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Color Pickers Grid */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-extrabold uppercase text-slate-900">
                Ajuste Fino das Cores do Sistema
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure os tons exatos de botões, barras de navegação, rodapé e preços.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Primary Color */}
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Cor Primária da Marca</label>
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">{settings.colors.primary}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.colors.primary}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, primary: e.target.value, buttonPrimaryBg: e.target.value },
                      }))
                    }
                    className="w-12 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.colors.primary}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, primary: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Usada em botões principais, destaques e badges.</p>
              </div>

              {/* Secondary Color */}
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Cor Secundária (Ciano/Apoio)</label>
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">{settings.colors.secondary}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.colors.secondary}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, secondary: e.target.value },
                      }))
                    }
                    className="w-12 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.colors.secondary}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, secondary: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Ícones secundários, tags e bordas em foco.</p>
              </div>

              {/* Accent Color */}
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Cor de Acento (Amarelo Ouro)</label>
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">{settings.colors.accent}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.colors.accent}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, accent: e.target.value },
                      }))
                    }
                    className="w-12 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.colors.accent}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, accent: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Selos especiais, ícones de confiança e promoções.</p>
              </div>

              {/* Top Banner Background */}
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Fundo da Faixa Superior (Top Banner)</label>
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">{settings.colors.topBannerBg}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.colors.topBannerBg}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, topBannerBg: e.target.value },
                      }))
                    }
                    className="w-12 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.colors.topBannerBg}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, topBannerBg: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Header Background */}
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Fundo do Cabeçalho (Navbar)</label>
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">{settings.colors.headerBg}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.colors.headerBg}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, headerBg: e.target.value },
                      }))
                    }
                    className="w-12 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.colors.headerBg}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, headerBg: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Footer Background */}
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Fundo do Rodapé</label>
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">{settings.colors.footerBg}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.colors.footerBg}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, footerBg: e.target.value },
                      }))
                    }
                    className="w-12 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.colors.footerBg}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, footerBg: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: HERO & APRESENTAÇÃO PRINCIPAL
      ======================================================== */}
      {activeTab === 'hero' && (
        <div className="space-y-6">
          {/* Main Hero Texts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold uppercase text-slate-900">
                Textos do Hero (Banner Principal)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure a chamada de maior impacto da loja, visualizada imediatamente ao entrar.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selo de Destaque Superior (Tag)
                </label>
                <input
                  type="text"
                  value={settings.hero.badgeText}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, badgeText: e.target.value },
                    }))
                  }
                  placeholder="Ex: Parque Gráfico Próprio & Atendimento B2B"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              {/* Multi-part Title Header with Add Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Partes do Título Principal (Banner)
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {currentTitleParts.length} {currentTitleParts.length === 1 ? 'parte' : 'partes'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Inclua, edite, reordene e exclua quantas partes desejar, escolhendo a cor e estilo de cada uma.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddTitlePart}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer self-start sm:self-auto"
                  title="Incluir nova parte no título"
                  id="btn-add-title-part"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Incluir Nova Parte</span>
                </button>
              </div>

              {/* Dynamic Grid of Title Parts */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {currentTitleParts.map((part, index) => {
                  const isHighlight = Boolean(part.isHighlight);
                  const isFirst = index === 0;
                  const isLast = index === currentTitleParts.length - 1;

                  return (
                    <div
                      key={part.id || `part-${index}`}
                      className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                        isHighlight
                          ? 'border-pink-300 bg-pink-50/50 shadow-xs'
                          : 'border-slate-200 bg-white shadow-xs'
                      }`}
                    >
                      {/* Card Header with reorder & delete actions */}
                      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shadow-xs shrink-0"
                            style={{ backgroundColor: part.color || '#FFFFFF' }}
                          />
                          <span
                            className={`text-xs font-bold truncate ${
                              isHighlight ? 'text-[#E6007E]' : 'text-slate-800'
                            }`}
                          >
                            Parte {index + 1}
                          </span>
                          {isHighlight && (
                            <span className="text-[9px] font-bold bg-[#E6007E] text-white px-1.5 py-0.2 rounded shrink-0">
                              Destaque
                            </span>
                          )}
                        </div>

                        {/* Actions: Move Left, Move Right, Duplicate, Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveTitlePart(index, 'left')}
                            disabled={isFirst}
                            className={`p-1 rounded text-slate-500 hover:bg-slate-100 transition-colors ${
                              isFirst ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:text-slate-900'
                            }`}
                            title="Mover para esquerda / antes"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveTitlePart(index, 'right')}
                            disabled={isLast}
                            className={`p-1 rounded text-slate-500 hover:bg-slate-100 transition-colors ${
                              isLast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:text-slate-900'
                            }`}
                            title="Mover para direita / depois"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateTitlePart(index)}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Duplicar esta parte"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTitlePart(index)}
                            disabled={currentTitleParts.length <= 1}
                            className={`p-1 rounded transition-colors ${
                              currentTitleParts.length <= 1
                                ? 'opacity-30 text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                            }`}
                            title="Excluir esta parte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Text Input */}
                      <div>
                        <input
                          type="text"
                          value={part.text}
                          onChange={(e) => handleUpdateTitlePart(index, { text: e.target.value })}
                          placeholder={`Texto da Parte ${index + 1}`}
                          className={`w-full px-3 py-2 text-xs rounded-xl focus:outline-none transition-all ${
                            isHighlight
                              ? 'bg-white border border-pink-300 text-[#E6007E] font-bold focus:border-[#E6007E]'
                              : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-slate-900'
                          }`}
                        />
                      </div>

                      {/* Color Selector */}
                      <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-600">Cor do Texto:</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {part.color || '#FFFFFF'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={part.color || '#FFFFFF'}
                            onChange={(e) => handleUpdateTitlePart(index, { color: e.target.value })}
                            className="w-9 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5 bg-white shrink-0"
                            title="Escolher cor personalizada"
                          />
                          <input
                            type="text"
                            value={part.color || '#FFFFFF'}
                            onChange={(e) => handleUpdateTitlePart(index, { color: e.target.value })}
                            placeholder="#FFFFFF"
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none"
                          />
                        </div>

                        {/* Quick preset color circles */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {TITLE_COLOR_PRESETS.map((color) => (
                            <button
                              key={`p${index}-${color.hex}`}
                              type="button"
                              onClick={() => handleUpdateTitlePart(index, { color: color.hex })}
                              className="w-5 h-5 rounded-full border border-slate-300 shadow-xs hover:scale-115 transition-transform cursor-pointer relative"
                              style={{ backgroundColor: color.hex }}
                              title={`${color.name} (${color.hex})`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Highlight Style Toggle */}
                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
                        <label className="text-[11px] text-slate-600 cursor-pointer flex items-center gap-1.5 select-none">
                          <input
                            type="checkbox"
                            checked={isHighlight}
                            onChange={(e) => handleUpdateTitlePart(index, { isHighlight: e.target.checked })}
                            className="rounded border-slate-300 text-[#E6007E] focus:ring-[#E6007E] cursor-pointer"
                          />
                          <span>Marcar como destaque visual</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Instant Live Title Preview Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-2.5 shadow-xl border border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-[#FFDD00]" />
                    Pré-visualização do Título Combinado ({currentTitleParts.length} partes no Banner Principal)
                  </span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    Fundo Escuro do Banner
                  </span>
                </div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-black font-heading uppercase tracking-tight leading-tight">
                  {currentTitleParts.map((part, idx) => (
                    <React.Fragment key={part.id || idx}>
                      <span style={{ color: part.color || '#FFFFFF' }}>
                        {part.text || `[Parte ${idx + 1}]`}
                      </span>
                      {idx < currentTitleParts.length - 1 ? ' ' : ''}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição Comercial / Subtítulo
                </label>
                <textarea
                  rows={3}
                  value={settings.hero.description}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description: e.target.value },
                    }))
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900 leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* CTAs / Action Buttons */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold uppercase text-slate-900">
                Botões de Ação (CTAs) do Hero
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure os rótulos e a visibilidade de cada botão de navegação no banner principal.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Button 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">Botão Primário (Destaque)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={settings.hero.primaryCtaVisible}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, primaryCtaVisible: e.target.checked },
                        }))
                      }
                      className="rounded accent-[#E6007E]"
                    />
                    <span>Ativo</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={settings.hero.primaryCtaText}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, primaryCtaText: e.target.value },
                    }))
                  }
                  placeholder="Texto do botão"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              {/* Button 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">Botão Secundário (Cotação)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={settings.hero.secondaryCtaVisible}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, secondaryCtaVisible: e.target.checked },
                        }))
                      }
                      className="rounded accent-[#E6007E]"
                    />
                    <span>Ativo</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={settings.hero.secondaryCtaText}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, secondaryCtaText: e.target.value },
                    }))
                  }
                  placeholder="Texto do botão"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              {/* Button 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">Botão Terciário (Catálogo PDF)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={settings.hero.tertiaryCtaVisible}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, tertiaryCtaVisible: e.target.checked },
                        }))
                      }
                      className="rounded accent-[#E6007E]"
                    />
                    <span>Ativo</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={settings.hero.tertiaryCtaText}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, tertiaryCtaText: e.target.value },
                    }))
                  }
                  placeholder="Texto do botão"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Showcase Card & Image */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold uppercase text-slate-900">
                Card de Produto Destaque do Hero
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Altere a imagem, textos e preços do card promocional que flutua ao lado do Hero.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selo do Card</label>
                  <input
                    type="text"
                    value={settings.hero.showcaseBadge}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, showcaseBadge: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título do Produto</label>
                  <input
                    type="text"
                    value={settings.hero.showcaseTitle}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, showcaseTitle: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                  <input
                    type="text"
                    value={settings.hero.showcaseDescription}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, showcaseDescription: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Texto de Preço / Faixa</label>
                  <input
                    type="text"
                    value={settings.hero.showcasePriceText}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, showcasePriceText: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#E6007E] font-bold"
                  />
                </div>
              </div>

              {/* Image preview and upload */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Foto do Produto em Destaque</label>
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center group">
                  {settings.hero.showcaseImageUrl ? (
                    <img
                      src={settings.hero.showcaseImageUrl}
                      alt="Showcase Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  )}

                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 cursor-pointer">
                    <Upload className="w-6 h-6 text-[#FFDD00]" />
                    <span className="text-xs font-bold">Substituir Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageUpload(
                          e,
                          (url) =>
                            updateSettings((prev) => ({
                              ...prev,
                              hero: { ...prev.hero, showcaseImageUrl: url },
                            })),
                          setIsUploadingShowcase
                        )
                      }
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.hero.showcaseImageUrl}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, showcaseImageUrl: e.target.value },
                      }))
                    }
                    placeholder="Cole a URL da imagem externa..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold uppercase text-slate-900">
                Selos de Confiança (Badges da Barra do Hero)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure os 4 diferenciais que aparecem logo abaixo do banner principal.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {settings.hero.trustBadges.map((badge, idx) => (
                <div key={badge.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Selo #{idx + 1}</span>
                  <input
                    type="text"
                    value={badge.title}
                    onChange={(e) => {
                      const newBadges = [...settings.hero.trustBadges];
                      newBadges[idx] = { ...newBadges[idx], title: e.target.value };
                      updateSettings((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, trustBadges: newBadges },
                      }));
                    }}
                    placeholder="Título"
                    className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={badge.description}
                    onChange={(e) => {
                      const newBadges = [...settings.hero.trustBadges];
                      newBadges[idx] = { ...newBadges[idx], description: e.target.value };
                      updateSettings((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, trustBadges: newBadges },
                      }));
                    }}
                    placeholder="Descrição"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB: BANNER DE OFERTAS & CARROSSEL DE PRODUTOS
      ======================================================== */}
      {activeTab === 'offers_banner' && (
        <div className="space-y-6">
          {/* Status & Master Switch Header */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-gradient-to-br from-[#E6007E] to-rose-600 text-white shadow-md">
                <Flame className="w-6 h-6 text-[#FFDD00]" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold uppercase text-slate-900 tracking-tight">
                    Banner de Ofertas de Produtos
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      settings.offersBanner?.enabled
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {settings.offersBanner?.enabled ? 'Ativo na Loja' : 'Pausado'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Carrossel dinâmico na página principal com transições modernas, fotos de produtos reais e preços promocionais.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.offersBanner?.enabled ?? true}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      offersBanner: {
                        ...prev.offersBanner,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 rounded text-[#E6007E] focus:ring-[#E6007E]"
                />
                <span>Exibir Banner na Home</span>
              </label>

              <button
                type="button"
                onClick={() => setIsAddingProductToBanner(true)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 text-[#FFDD00]" />
                <span>Vincular Produto</span>
              </button>
            </div>
          </div>

          {/* 1. CONFIGURAÇÕES GERAIS DO BANNER */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h4 className="text-sm font-extrabold uppercase text-slate-900 tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#E6007E]" />
                <span>1. Configurações Gerais do Banner</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Personalize textos, dimensões, intervalos de tempo e controles de navegação do carrossel.
              </p>
            </div>

            {/* Titulo, Subtitulo, Selo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título Principal da Seção
                </label>
                <input
                  type="text"
                  value={settings.offersBanner?.title || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      offersBanner: { ...prev.offersBanner, title: e.target.value },
                    }))
                  }
                  placeholder="Ex: Super Ofertas & Destaques da Semana"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subtítulo Explicativo
                </label>
                <input
                  type="text"
                  value={settings.offersBanner?.subtitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      offersBanner: { ...prev.offersBanner, subtitle: e.target.value },
                    }))
                  }
                  placeholder="Ex: Preços promocionais por tempo limitado nos produtos mais desejados"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tag / Selo Superior
                </label>
                <input
                  type="text"
                  value={settings.offersBanner?.badgeText || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      offersBanner: { ...prev.offersBanner, badgeText: e.target.value },
                    }))
                  }
                  placeholder="Ex: OFERTA ESPECIAL"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl uppercase font-bold focus:bg-white focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {/* Dimensoes e Layout: Altura e Largura */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Altura do Banner
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'panoramic', label: 'Panorâmico (4:1)', desc: '~280px (Ideal)' },
                    { id: 'compact', label: 'Compacto', desc: '~220px' },
                    { id: 'normal', label: 'Médio / Padrão', desc: '~320px' },
                    { id: 'tall', label: 'Grande', desc: '~400px' },
                  ].map((h) => {
                    const isSelected = (settings.offersBanner?.height || 'panoramic') === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() =>
                          updateSettings((prev) => ({
                            ...prev,
                            offersBanner: {
                              ...prev.offersBanner,
                              height: h.id as 'panoramic' | 'compact' | 'normal' | 'tall',
                            },
                          }))
                        }
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#E6007E] bg-pink-50/60 text-[#E6007E] font-bold shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="text-xs">{h.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{h.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Largura & Comportamento na Página
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: { ...prev.offersBanner, fullWidth: false },
                      }))
                    }
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      !settings.offersBanner?.fullWidth
                        ? 'border-[#E6007E] bg-pink-50/60 text-[#E6007E] font-bold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="text-xs">Centralizado (Padrão)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Com margens seguras (max-w-7xl)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: { ...prev.offersBanner, fullWidth: true },
                      }))
                    }
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      settings.offersBanner?.fullWidth
                        ? 'border-[#E6007E] bg-pink-50/60 text-[#E6007E] font-bold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="text-xs">Largura Total</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Ocupa 100% da viewport</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Transicoes e Velocidades */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Tipos de Transição & Animação
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    id: 'fade',
                    label: 'Fade Suave',
                    desc: 'Desvanecimento sutil e elegante',
                  },
                  {
                    id: 'slide_horizontal',
                    label: 'Slide Horizontal',
                    desc: 'Deslizamento lateral dinâmico (Padrão)',
                  },
                  {
                    id: 'slide_vertical',
                    label: 'Slide Vertical',
                    desc: 'Deslizamento para cima / baixo',
                  },
                  {
                    id: 'zoom',
                    label: 'Zoom Suave',
                    desc: 'Aproximação suave com fade',
                  },
                ].map((trans) => {
                  const isSelected =
                    (settings.offersBanner?.transitionType || 'slide_horizontal') === trans.id;
                  return (
                    <button
                      key={trans.id}
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({
                          ...prev,
                          offersBanner: {
                            ...prev.offersBanner,
                            transitionType: trans.id as OffersBannerTransition,
                          },
                        }))
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#E6007E] bg-pink-50/60 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div
                        className={`text-xs font-bold ${
                          isSelected ? 'text-[#E6007E]' : 'text-slate-800'
                        }`}
                      >
                        {trans.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{trans.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Controles de Tempo: Intervalo e Velocidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tempo por Slide (Autoplay)
                  </label>
                  <select
                    value={settings.offersBanner?.intervalMs || 5000}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: {
                          ...prev.offersBanner,
                          intervalMs: parseInt(e.target.value) || 5000,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={3000}>3 segundos (Rápido)</option>
                    <option value={5000}>5 segundos (Recomendado)</option>
                    <option value={7000}>7 segundos (Mais leitura)</option>
                    <option value={10000}>10 segundos (Tranquilo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Velocidade da Transição
                  </label>
                  <select
                    value={settings.offersBanner?.transitionSpeedMs || 500}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: {
                          ...prev.offersBanner,
                          transitionSpeedMs: parseInt(e.target.value) || 500,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={300}>300ms (Transição Ágil)</option>
                    <option value={500}>500ms (Padrão Suave)</option>
                    <option value={800}>800ms (Transição Lenta/Elegante)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Critério de Ordenação
                  </label>
                  <select
                    value={settings.offersBanner?.autoOrderCriteria || 'custom'}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: {
                          ...prev.offersBanner,
                          autoOrderCriteria: e.target.value as any,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="custom">Manual (Ordem dos Produtos)</option>
                    <option value="discount_desc">Maior Desconto (% OFF)</option>
                    <option value="featured">Produtos em Destaque</option>
                    <option value="newest">Mais Recentes (Lançamentos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Limite Máximo de Slides
                  </label>
                  <select
                    value={settings.offersBanner?.maxSlides || 0}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: {
                          ...prev.offersBanner,
                          maxSlides: parseInt(e.target.value) || undefined,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={0}>Todos os produtos vinculados</option>
                    <option value={3}>Máximo de 3 slides</option>
                    <option value={5}>Máximo de 5 slides</option>
                    <option value={8}>Máximo de 8 slides</option>
                    <option value={10}>Máximo de 10 slides</option>
                  </select>
                </div>
              </div>

              {/* Toggles de Controles de Interface */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.offersBanner?.autoplay ?? true}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: { ...prev.offersBanner, autoplay: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded text-[#E6007E]"
                  />
                  <span>Reprodução Automática</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.offersBanner?.showArrows ?? true}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: { ...prev.offersBanner, showArrows: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded text-[#E6007E]"
                  />
                  <span>Exibir Setas Laterais</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.offersBanner?.showDots ?? true}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: { ...prev.offersBanner, showDots: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded text-[#E6007E]"
                  />
                  <span>Exibir Indicadores (Bolinhas)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.offersBanner?.showProgressBar ?? true}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: { ...prev.offersBanner, showProgressBar: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded text-[#E6007E]"
                  />
                  <span>Barra de Progresso</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.offersBanner?.showCtaButton ?? true}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        offersBanner: { ...prev.offersBanner, showCtaButton: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded text-[#E6007E]"
                  />
                  <span>Exibir Botão de Ação</span>
                </label>

                {settings.offersBanner?.showCtaButton && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Texto do Botão:</span>
                    <input
                      type="text"
                      value={settings.offersBanner?.ctaButtonText || 'COMPRAR AGORA'}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          offersBanner: { ...prev.offersBanner, ctaButtonText: e.target.value },
                        }))
                      }
                      className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-bold uppercase text-slate-800 w-36"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. GERENCIAMENTO DOS PRODUTOS DO BANNER */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold uppercase text-slate-900 tracking-wider">
                    2. Produtos Vinculados ao Banner ({settings.offersBanner?.items?.length || 0})
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Catálogo Oficial da Loja
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Gerencie quais produtos cadastrados aparecem no carrossel, reordene sua prioridade e defina preços promocionais.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingProductToBanner(true)}
                className="px-4 py-2 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Produto ao Banner</span>
              </button>
            </div>

            {/* List of Products currently in the banner */}
            {(!settings.offersBanner?.items || settings.offersBanner.items.length === 0) ? (
              <div className="p-10 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3 bg-slate-50/50">
                <Tag className="w-10 h-10 text-slate-300 mx-auto" />
                <h5 className="font-bold text-sm text-slate-700">Nenhum produto vinculado ao banner</h5>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Clique no botão abaixo para escolher produtos já cadastrados no catálogo e transformá-los em destaques no carrossel de ofertas.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingProductToBanner(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Selecionar Produtos do Catálogo
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {settings.offersBanner.items.map((item, index) => {
                  const product = availableProducts.find((p) => p.id === item.productId);
                  const isFirst = index === 0;
                  const isLast = index === (settings.offersBanner?.items?.length || 1) - 1;
                  const basePrice = product?.base_price || 0;
                  const promoPrice = item.promoPrice ?? product?.promo_price ?? basePrice;
                  const hasDiscount = promoPrice > 0 && promoPrice < basePrice;
                  const discountPct = hasDiscount
                    ? Math.round(((basePrice - promoPrice) / basePrice) * 100)
                    : 0;

                  // Status of dates
                  const now = new Date();
                  let dateStatus: 'active' | 'scheduled' | 'expired' = 'active';
                  if (item.startDate) {
                    const start = new Date(item.startDate);
                    if (now < start) dateStatus = 'scheduled';
                  }
                  if (item.endDate) {
                    const end = new Date(item.endDate);
                    if (item.endDate.length <= 10) end.setHours(23, 59, 59, 999);
                    if (now > end) dateStatus = 'expired';
                  }

                  const effectiveImage =
                    item.customImage ||
                    (product?.images && product.images.length > 0 ? product.images[0] : '') ||
                    '';

                  return (
                    <div
                      key={`banner-item-${item.productId}-${index}`}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        item.active
                          ? 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                          : 'border-slate-200 bg-slate-50/70 opacity-60'
                      }`}
                    >
                      {/* Top Bar of item: Thumbnail, Order, Title, Status & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Image preview */}
                          <div className="relative w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {effectiveImage ? (
                              <img
                                src={effectiveImage}
                                alt={item.customTitle || product?.name || 'Produto'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-400" />
                            )}
                            {item.customImage && (
                              <span
                                className="absolute bottom-0 right-0 w-3 h-3 bg-[#E6007E] rounded-tl-sm"
                                title="Imagem específica configurada para o banner"
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">
                                #{index + 1}
                              </span>
                              <h5 className="font-bold text-xs text-slate-900 truncate max-w-xs sm:max-w-md">
                                {item.customTitle || product?.name || 'Produto Desconhecido'}
                              </h5>
                              {product?.code && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  SKU: {product.code}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                              <span>Preço Catálogo: R$ {basePrice.toFixed(2)}</span>
                              <span>•</span>
                              <span className="font-bold text-[#E6007E]">
                                Oferta: R$ {promoPrice.toFixed(2)}
                              </span>
                              {hasDiscount && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {discountPct}% OFF
                                </span>
                              )}
                              <span>•</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  dateStatus === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : dateStatus === 'scheduled'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {dateStatus === 'active'
                                  ? 'Oferta Ativa'
                                  : dateStatus === 'scheduled'
                                  ? 'Programada'
                                  : 'Expirada'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Top Actions: Move Up, Move Down, Duplicate, Toggle Active, Delete */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveOfferItem(index, 'up')}
                            disabled={isFirst}
                            className={`p-1.5 rounded-lg border border-slate-200 text-slate-500 transition-colors ${
                              isFirst
                                ? 'opacity-30 cursor-not-allowed'
                                : 'hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                            }`}
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveOfferItem(index, 'down')}
                            disabled={isLast}
                            className={`p-1.5 rounded-lg border border-slate-200 text-slate-500 transition-colors ${
                              isLast
                                ? 'opacity-30 cursor-not-allowed'
                                : 'hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                            }`}
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicateOfferItem(index)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Duplicar este banner / slide"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateOfferItem(index, { active: !item.active })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              item.active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {item.active ? 'Ativo' : 'Pausado'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveProductFromOffersBanner(item.productId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remover produto do banner"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Theme Presets Selector (Matching reference video campaign styles) */}
                      <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 space-y-1.5">
                        <label className="block text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">
                          Estilo Visual & Fundo da Campanha (Referência Vídeo)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          {[
                            { id: 'industrial_light', label: 'Studio Claro', desc: 'Campeões de Vendas', color: 'bg-slate-200 text-slate-900 border-slate-300' },
                            { id: 'holiday_festive', label: 'Festivo Fim de Ano', desc: 'Verde & Dourado', color: 'bg-[#183125] text-emerald-200 border-emerald-600' },
                            { id: 'dark_tech', label: 'Grafite Dark Tech', desc: 'Upgrade na Marca', color: 'bg-[#22252B] text-amber-300 border-slate-600' },
                            { id: 'modern_lavender', label: 'Lavanda Tech', desc: 'Tech no seu Bolso', color: 'bg-[#E6E8F7] text-indigo-950 border-indigo-200' },
                            { id: 'vibrant_green', label: 'Verde E-commerce', desc: 'Frete Grátis', color: 'bg-[#00A650] text-white border-green-600' },
                            { id: 'corporate_pink', label: 'Rosa Corporativo', desc: 'Identidade MB', color: 'bg-[#2A0C38] text-pink-300 border-pink-700' },
                            { id: 'custom', label: 'Personalizado', desc: 'Cor livre', color: 'bg-white text-slate-800 border-slate-300' },
                          ].map((theme) => {
                            const isSelected = (item.backgroundTheme || 'industrial_light') === theme.id;
                            return (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() => handleUpdateOfferItem(index, { backgroundTheme: theme.id as any })}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'ring-2 ring-[#E6007E] font-bold shadow-xs ' + theme.color
                                    : 'hover:border-slate-300 ' + theme.color
                                }`}
                              >
                                <div className="text-[11px] leading-tight truncate">{theme.label}</div>
                                <div className="text-[9px] opacity-75 truncate">{theme.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detail inputs for this offer slide */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Título Principal de Impacto
                          </label>
                          <input
                            type="text"
                            value={item.customTitle || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { customTitle: e.target.value })
                            }
                            placeholder={product?.name || 'Ex: CAMPEÕES DE VENDAS'}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Selo de Desconto (% OFF)
                          </label>
                          <input
                            type="text"
                            value={item.badge || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { badge: e.target.value })
                            }
                            placeholder="Ex: ATÉ 50% OFF"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 uppercase focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Selo de Benefício (Envio Rápido)
                          </label>
                          <input
                            type="text"
                            value={item.benefitBadge || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { benefitBadge: e.target.value })
                            }
                            placeholder="Ex: ⚡ FULL ENVIOS RÁPIDOS"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 uppercase focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Row 2: Subtitle, Second Benefit, Validity, and CTA */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Subtítulo / Descrição Curta
                          </label>
                          <input
                            type="text"
                            value={item.customSubtitle || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { customSubtitle: e.target.value })
                            }
                            placeholder="Ex: Os brindes mais desejados para o seu negócio"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Texto de Validade / Disclaimer
                          </label>
                          <input
                            type="text"
                            value={item.validityText || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { validityText: e.target.value })
                            }
                            placeholder="Ex: Válido até 30/09/2026. Ver mais em..."
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Botão CTA (Chamada de Ação)
                          </label>
                          <input
                            type="text"
                            value={item.ctaText || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { ctaText: e.target.value })
                            }
                            placeholder="Ex: COMPRE AGORA ou VER OFERTA"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold uppercase focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Link de Destino / Rota
                          </label>
                          <input
                            type="text"
                            value={item.targetLink || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { targetLink: e.target.value })
                            }
                            placeholder="Ex: /produtos/copo-termico ou /catalogo"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-600 focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Row 3: Preço Promocional e Período */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Preço Promocional (R$)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.promoPrice ?? ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleUpdateOfferItem(index, {
                                  promoPrice: !isNaN(val) && val > 0 ? val : undefined,
                                });
                              }}
                              placeholder={basePrice.toFixed(2)}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-pink-600 focus:bg-white"
                            />
                            {hasDiscount && (
                              <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                                -{discountPct}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Selo de Benefício 2 (Opcional)
                          </label>
                          <input
                            type="text"
                            value={item.benefitBadge2 || ''}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, { benefitBadge2: e.target.value })
                            }
                            placeholder="Ex: ENVIO MAIS RÁPIDO DO BRASIL"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 uppercase focus:bg-white"
                          />
                        </div>

                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Período de Publicação (Início e Término)
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="date"
                              value={item.startDate || ''}
                              onChange={(e) =>
                                handleUpdateOfferItem(index, { startDate: e.target.value })
                              }
                              className="px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg"
                              title="Data de Início da Oferta"
                            />
                            <input
                              type="date"
                              value={item.endDate || ''}
                              onChange={(e) =>
                                handleUpdateOfferItem(index, { endDate: e.target.value })
                              }
                              className="px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg"
                              title="Data de Término da Oferta"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Primary Product Image + Secondary Combo Product Image */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
                        {/* Imagem Principal */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                            <span>Imagem Principal do Produto (Recorte)</span>
                            {item.customImage && (
                              <button
                                type="button"
                                onClick={() => handleUpdateOfferItem(index, { customImage: undefined })}
                                className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                              >
                                Usar Foto Original
                              </button>
                            )}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.customImage || ''}
                              onChange={(e) =>
                                handleUpdateOfferItem(index, { customImage: e.target.value })
                              }
                              placeholder="URL ou envie arquivo"
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-600 focus:bg-white"
                            />
                            <label className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0" title="Carregar foto principal">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleOfferItemImageUpload(index, file);
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Imagem Secundária (Combo) */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                            <span>Imagem do Produto Complementar (Combo de 2 Itens)</span>
                            {item.secondaryImage && (
                              <button
                                type="button"
                                onClick={() => handleUpdateOfferItem(index, { secondaryImage: undefined })}
                                className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                              >
                                Remover Combo
                              </button>
                            )}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.secondaryImage || ''}
                              onChange={(e) =>
                                handleUpdateOfferItem(index, { secondaryImage: e.target.value })
                              }
                              placeholder="URL de foto complementar (ex: furadeira + lavadora)"
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-600 focus:bg-white"
                            />
                            <label className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0" title="Carregar produto complementar">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleSecondaryImageUpload(index, file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Row 5: Posicionamento e Proteção contra Distorção das Imagens */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Alinhamento Horizontal
                          </label>
                          <select
                            value={item.imagePositionHorizontal || 'center'}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, {
                                imagePositionHorizontal: e.target.value as 'left' | 'center' | 'right',
                              })
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                          >
                            <option value="center">Centro (Recomendado)</option>
                            <option value="left">Esquerda</option>
                            <option value="right">Direita</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Alinhamento Vertical
                          </label>
                          <select
                            value={item.imagePositionVertical || 'center'}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, {
                                imagePositionVertical: e.target.value as 'top' | 'center' | 'bottom',
                              })
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                          >
                            <option value="center">Centro Vertical</option>
                            <option value="bottom">Baixo / Chão (Padrão E-commerce)</option>
                            <option value="top">Topo</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Proteção de Proporção
                          </label>
                          <select
                            value={item.imageFit || 'contain'}
                            onChange={(e) =>
                              handleUpdateOfferItem(index, {
                                imageFit: e.target.value as 'contain' | 'cover',
                              })
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                          >
                            <option value="contain">Sem Distorção (Contém 100% Proporcional)</option>
                            <option value="cover">Preencher Área (Cover)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. PRÉ-VISUALIZAÇÃO AO VIVO INTEGRADA */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold uppercase text-slate-900 tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#FFDD00]" />
                  <span>3. Pré-Visualização Interativa do Banner</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Teste a transição automática, passe o mouse para pausar e veja a renderização idêntica à página da loja.
                </p>
              </div>

              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                Modo: {settings.offersBanner?.transitionType || 'slide_horizontal'} • {settings.offersBanner?.intervalMs || 5000}ms
              </span>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-slate-100/80 border border-slate-200/80">
              <OffersBanner
                products={availableProducts}
                settings={settings.offersBanner}
                onNavigate={() => {}}
                isLivePreview={true}
              />
            </div>
          </div>
        </div>
      )}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          {/* Categories Section Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Seção de Categorias em Destaque
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Título da Seção</label>
                <input
                  type="text"
                  value={settings.categoriesSection.title}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      categoriesSection: { ...prev.categoriesSection, title: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantidade de Cards</label>
                <input
                  type="number"
                  min={3}
                  max={12}
                  value={settings.categoriesSection.limit}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      categoriesSection: { ...prev.categoriesSection, limit: Number(e.target.value) },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={settings.categoriesSection.subtitle}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      categoriesSection: { ...prev.categoriesSection, subtitle: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Featured Products Section Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Seção de Produtos Mais Pedidos & Vitrine
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Título da Seção</label>
                <input
                  type="text"
                  value={settings.featuredSection.title}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      featuredSection: { ...prev.featuredSection, title: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Limite de Itens</label>
                <input
                  type="number"
                  min={4}
                  max={24}
                  value={settings.featuredSection.limit}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      featuredSection: { ...prev.featuredSection, limit: Number(e.target.value) },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={settings.featuredSection.subtitle}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      featuredSection: { ...prev.featuredSection, subtitle: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* B2B Promotional Banner Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Banner Promocional Corporativo (B2B Call to Action)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Selo Superior</label>
                <input
                  type="text"
                  value={settings.b2bBanner.badge}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      b2bBanner: { ...prev.b2bBanner, badge: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título de Impacto</label>
                <input
                  type="text"
                  value={settings.b2bBanner.title}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      b2bBanner: { ...prev.b2bBanner, title: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={settings.b2bBanner.description}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      b2bBanner: { ...prev.b2bBanner, description: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* 3 Benefits */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Benefícios em Destaque (Lista com check)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {settings.b2bBanner.benefits.map((benefit, bIdx) => (
                    <input
                      key={bIdx}
                      type="text"
                      value={benefit}
                      onChange={(e) => {
                        const newBenefits = [...settings.b2bBanner.benefits];
                        newBenefits[bIdx] = e.target.value;
                        updateSettings((prev) => ({
                          ...prev,
                          b2bBanner: { ...prev.b2bBanner, benefits: newBenefits },
                        }));
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Texto do Botão de Cotação</label>
                  <input
                    type="text"
                    value={settings.b2bBanner.buttonText}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        b2bBanner: { ...prev.b2bBanner, buttonText: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Texto do Botão WhatsApp</label>
                  <input
                    type="text"
                    value={settings.b2bBanner.secondaryButtonText}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        b2bBanner: { ...prev.b2bBanner, secondaryButtonText: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Why Choose MB Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Seção "Por que escolher a MB Personaliza?"
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título da Seção</label>
                <input
                  type="text"
                  value={settings.whyChoose.title}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      whyChoose: { ...prev.whyChoose, title: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={settings.whyChoose.subtitle}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      whyChoose: { ...prev.whyChoose, subtitle: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {settings.whyChoose.items.map((item, idx) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Pilar #{idx + 1}</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const newItems = [...settings.whyChoose.items];
                      newItems[idx] = { ...newItems[idx], title: e.target.value };
                      updateSettings((prev) => ({
                        ...prev,
                        whyChoose: { ...prev.whyChoose, items: newItems },
                      }));
                    }}
                    placeholder="Título do pilar"
                    className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg"
                  />
                  <textarea
                    rows={3}
                    value={item.description}
                    onChange={(e) => {
                      const newItems = [...settings.whyChoose.items];
                      newItems[idx] = { ...newItems[idx], description: e.target.value };
                      updateSettings((prev) => ({
                        ...prev,
                        whyChoose: { ...prev.whyChoose, items: newItems },
                      }));
                    }}
                    placeholder="Descrição detalhada"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 5: CABEÇALHO & RODAPÉ
      ======================================================== */}
      {activeTab === 'header_footer' && (
        <div className="space-y-6">
          {/* Header & Top Banner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Configurações do Cabeçalho (Header)
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800">Exibir Faixa Superior de Aviso (Top Banner)</span>
                  <p className="text-[11px] text-slate-500">Faixa fina acima do menu com recados institucionais</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.header.showTopBanner}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      header: { ...prev.header, showTopBanner: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded accent-[#E6007E] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Texto da Faixa Superior
                </label>
                <input
                  type="text"
                  value={settings.header.topBannerText}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      header: { ...prev.header, topBannerText: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.header.showCatalogPdfLink}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        header: { ...prev.header, showCatalogPdfLink: e.target.checked },
                      }))
                    }
                    className="rounded accent-[#E6007E]"
                  />
                  <span className="text-xs font-bold text-slate-700">Link Catálogo PDF</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.header.showAboutLink}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        header: { ...prev.header, showAboutLink: e.target.checked },
                      }))
                    }
                    className="rounded accent-[#E6007E]"
                  />
                  <span className="text-xs font-bold text-slate-700">Link Sobre a MB</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.header.showSearchAutocomplete}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        header: { ...prev.header, showSearchAutocomplete: e.target.checked },
                      }))
                    }
                    className="rounded accent-[#E6007E]"
                  />
                  <span className="text-xs font-bold text-slate-700">Busca Instantânea</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Configurações do Rodapé (Footer)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Texto Institucional "Sobre a Empresa"
                </label>
                <textarea
                  rows={3}
                  value={settings.footer.aboutText}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, aboutText: e.target.value },
                    }))
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Texto de Copyright / Direitos Reservados
                </label>
                <input
                  type="text"
                  value={settings.footer.copyrightText}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, copyrightText: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.footer.showPaymentBadges}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, showPaymentBadges: e.target.checked },
                      }))
                    }
                    className="rounded accent-[#E6007E]"
                  />
                  <span className="text-xs font-bold text-slate-700">Badges de Pagamento (PIX, Visa)</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.footer.showSecurityBadge}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, showSecurityBadge: e.target.checked },
                      }))
                    }
                    className="rounded accent-[#E6007E]"
                  />
                  <span className="text-xs font-bold text-slate-700">Selo de Segurança SSL</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.footer.showSocialLinks}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, showSocialLinks: e.target.checked },
                      }))
                    }
                    className="rounded accent-[#E6007E]"
                  />
                  <span className="text-xs font-bold text-slate-700">Ícones de Redes Sociais</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 6: PRÉ-VISUALIZAÇÃO AO VIVO (DESKTOP | TABLET | MOBILE)
      ======================================================== */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          {/* Device Switcher Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-xs font-extrabold uppercase text-[#FFDD00]">Modo de Visualização:</span>
              <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setDeviceMode('desktop')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    deviceMode === 'desktop'
                      ? 'bg-[#E6007E] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Desktop (1200px)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeviceMode('tablet')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    deviceMode === 'tablet'
                      ? 'bg-[#E6007E] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Tablet className="w-4 h-4" />
                  <span>Tablet (768px)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeviceMode('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    deviceMode === 'mobile'
                      ? 'bg-[#E6007E] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Mobile (375px)</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePublish}
                className="px-4 py-2 text-xs font-black text-white bg-[#E6007E] hover:bg-[#c9006e] rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-[#FFDD00]" />
                <span>Aprovar & Publicar Agora</span>
              </button>
            </div>
          </div>

          {/* Interactive Preview Canvas */}
          <div className="bg-slate-200/80 p-4 sm:p-8 rounded-2xl flex justify-center overflow-x-auto min-h-[600px] border border-slate-300">
            <div
              className={`bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 border border-slate-300 flex flex-col ${
                deviceMode === 'desktop'
                  ? 'w-full max-w-[1200px]'
                  : deviceMode === 'tablet'
                  ? 'w-[768px] shrink-0'
                  : 'w-[375px] shrink-0'
              }`}
            >
              {/* Fake Browser Chrome */}
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 max-w-md mx-auto bg-white text-[11px] text-slate-500 py-1 px-3 rounded-lg border border-slate-200 text-center font-mono truncate">
                  https://mbpersonaliza.com.br
                </div>
              </div>

              {/* Simulated Render Content */}
              <div className="overflow-y-auto max-h-[750px] divide-y divide-slate-100">
                {/* Top Banner */}
                {settings.header.showTopBanner && (
                  <div
                    className="py-1.5 px-4 text-center text-xs font-bold"
                    style={{
                      backgroundColor: settings.colors.topBannerBg,
                      color: settings.colors.topBannerText,
                    }}
                  >
                    {settings.header.topBannerText}
                  </div>
                )}

                {/* Simulated Header Navbar */}
                <div
                  className="px-4 py-3 flex items-center justify-between border-b border-slate-200"
                  style={{ backgroundColor: settings.colors.headerBg }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="font-heading font-black text-xl tracking-tight"
                      style={{ color: settings.colors.primary }}
                    >
                      MB <span style={{ color: settings.colors.secondary }}>PERSONALIZA</span>
                    </span>
                  </div>

                  <div className="hidden md:flex items-center gap-4 text-xs font-extrabold text-slate-700">
                    <span className="hover:text-slate-900 cursor-pointer">Início</span>
                    <span className="hover:text-slate-900 cursor-pointer">Catálogo</span>
                    {settings.header.showCatalogPdfLink && (
                      <span className="hover:text-slate-900 cursor-pointer">Catálogo PDF</span>
                    )}
                    <span className="hover:text-slate-900 cursor-pointer">Orçamento</span>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-extrabold text-white rounded-xl shadow-xs"
                    style={{ backgroundColor: settings.colors.buttonPrimaryBg }}
                  >
                    Fazer Cotação
                  </button>
                </div>

                {/* Simulated Dynamic Home Blocks in configured order */}
                {settings.blocks
                  .filter((b) => b.isVisible)
                  .map((block) => {
                    if (block.type === 'hero') {
                      return (
                        <div
                          key={block.id}
                          className="p-6 sm:p-10 relative overflow-hidden"
                          style={{ backgroundColor: settings.colors.bodyBg }}
                        >
                          <div className="max-w-4xl mx-auto space-y-6">
                            <div className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-pink-100 text-[#E6007E]">
                              {settings.hero.badgeText}
                            </div>

                            <h1 className="text-2xl sm:text-4xl font-heading font-black uppercase text-slate-900 leading-tight">
                              {currentTitleParts.map((part, idx) => (
                                <React.Fragment key={part.id || idx}>
                                  <span style={{ color: part.color || '#0F172A' }}>
                                    {part.text}
                                  </span>
                                  {idx < currentTitleParts.length - 1 ? ' ' : ''}
                                </React.Fragment>
                              ))}
                            </h1>

                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                              {settings.hero.description}
                            </p>

                            <div className="flex flex-wrap gap-3 pt-2">
                              {settings.hero.primaryCtaVisible && (
                                <button
                                  type="button"
                                  className="px-5 py-2.5 text-xs font-black text-white rounded-xl shadow-md"
                                  style={{ backgroundColor: settings.colors.buttonPrimaryBg }}
                                >
                                  {settings.hero.primaryCtaText}
                                </button>
                              )}
                              {settings.hero.secondaryCtaVisible && (
                                <button
                                  type="button"
                                  className="px-5 py-2.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl"
                                >
                                  {settings.hero.secondaryCtaText}
                                </button>
                              )}
                            </div>

                            {/* Trust Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-200">
                              {settings.hero.trustBadges.map((badge) => (
                                <div key={badge.id} className="text-left space-y-0.5">
                                  <p className="font-extrabold text-xs text-slate-900">{badge.title}</p>
                                  <p className="text-[10px] text-slate-500">{badge.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'categories') {
                      return (
                        <div key={block.id} className="p-6 sm:p-8 bg-white text-center space-y-4">
                          <div>
                            <h2 className="text-lg sm:text-xl font-heading font-black uppercase text-slate-900">
                              {settings.categoriesSection.title}
                            </h2>
                            <p className="text-xs text-slate-500">{settings.categoriesSection.subtitle}</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {['Copos Térmicos', 'Canetas Metal', 'Mochilas', 'Agendas', 'Squeezes', 'Eletrônicos'].map(
                              (cat, i) => (
                                <div
                                  key={i}
                                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-center font-bold text-xs text-slate-800"
                                >
                                  {cat}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'featured_products') {
                      return (
                        <div key={block.id} className="p-6 sm:p-8 bg-slate-50 text-center space-y-4">
                          <div>
                            <h2 className="text-lg sm:text-xl font-heading font-black uppercase text-slate-900">
                              {settings.featuredSection.title}
                            </h2>
                            <p className="text-xs text-slate-500">{settings.featuredSection.subtitle}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[1, 2, 3].map((p) => (
                              <div
                                key={p}
                                className="bg-white rounded-xl border border-slate-200 p-4 text-left space-y-2"
                              >
                                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">
                                  Produto Destaque #{p}
                                </div>
                                <h4 className="font-extrabold text-xs text-slate-900">Brinde Corporativo Premium</h4>
                                <p className="text-[11px] font-bold" style={{ color: settings.colors.priceColor }}>
                                  A partir de R$ 24,90 / un
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'b2b_banner') {
                      return (
                        <div
                          key={block.id}
                          className="p-6 sm:p-10 text-white"
                          style={{ backgroundColor: settings.colors.topBannerBg }}
                        >
                          <div className="max-w-3xl mx-auto space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#FFDD00]">
                              {settings.b2bBanner.badge}
                            </span>
                            <h3 className="text-lg sm:text-2xl font-black uppercase">
                              {settings.b2bBanner.title}
                            </h3>
                            <p className="text-xs text-slate-300">{settings.b2bBanner.description}</p>
                            <div className="pt-2">
                              <button
                                type="button"
                                className="px-5 py-2.5 text-xs font-black text-white rounded-xl shadow-md"
                                style={{ backgroundColor: settings.colors.buttonPrimaryBg }}
                              >
                                {settings.b2bBanner.buttonText}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'why_choose') {
                      return (
                        <div key={block.id} className="p-6 sm:p-8 bg-white space-y-4">
                          <div className="text-center">
                            <h2 className="text-lg sm:text-xl font-heading font-black uppercase text-slate-900">
                              {settings.whyChoose.title}
                            </h2>
                            <p className="text-xs text-slate-500">{settings.whyChoose.subtitle}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {settings.whyChoose.items.map((item) => (
                              <div key={item.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                                <h4 className="font-bold text-xs text-slate-900">{item.title}</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">{item.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'custom_banner' && block.customData) {
                      return (
                        <div
                          key={block.id}
                          className="p-6 sm:p-8 text-white text-center space-y-2"
                          style={{ backgroundColor: block.customData.backgroundColor || '#0F172A' }}
                        >
                          <h3 className="text-lg font-black uppercase">{block.title}</h3>
                          {block.customData.description && (
                            <p className="text-xs text-slate-300 max-w-xl mx-auto">
                              {block.customData.description}
                            </p>
                          )}
                          {block.customData.buttonText && (
                            <button
                              type="button"
                              className="mt-2 px-4 py-2 text-xs font-extrabold text-white rounded-xl shadow-md"
                              style={{ backgroundColor: settings.colors.buttonPrimaryBg }}
                            >
                              {block.customData.buttonText}
                            </button>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}

                {/* Simulated Footer */}
                <div
                  className="p-6 text-center space-y-2"
                  style={{
                    backgroundColor: settings.colors.footerBg,
                    color: settings.colors.footerText,
                  }}
                >
                  <p className="text-xs max-w-xl mx-auto">{settings.footer.aboutText}</p>
                  <p className="text-[11px] opacity-75">{settings.footer.copyrightText}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELECIONAR PRODUTOS DO CATÁLOGO PARA O BANNER DE OFERTAS */}
      {isAddingProductToBanner && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-pink-100 text-[#E6007E]">
                  <Flame className="w-5 h-5 text-[#E6007E]" />
                </span>
                <div>
                  <h3 className="font-extrabold uppercase text-base text-slate-900 tracking-tight">
                    Vincular Produto ao Banner de Ofertas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione um produto existente no catálogo da loja para criar um slide promocional
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddingProductToBanner(false);
                  setBannerProductSearch('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bannerProductSearch}
                onChange={(e) => setBannerProductSearch(e.target.value)}
                placeholder="Buscar por nome do produto ou código SKU..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                autoFocus
              />
            </div>

            {/* List of Products */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 pr-1">
              {availableProducts
                .filter((p) => {
                  if (!p.is_active) return false;
                  if (!bannerProductSearch) return true;
                  const term = bannerProductSearch.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(term) ||
                    (p.code && p.code.toLowerCase().includes(term))
                  );
                })
                .map((product) => {
                  const alreadyInBanner = (settings.offersBanner?.items || []).some(
                    (i) => i.productId === product.id
                  );
                  const suggestedPromo =
                    product.promo_price || Math.round(product.base_price * 0.85 * 100) / 100;

                  return (
                    <div
                      key={`modal-prod-${product.id}`}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={product.images && product.images[0] ? product.images[0] : ''}
                          alt={product.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 truncate max-w-sm">
                              {product.name}
                            </span>
                            {product.code && (
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {product.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <span>Preço Base: R$ {product.base_price.toFixed(2)}</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-semibold">
                              Sugestão com 15% OFF: R$ {suggestedPromo.toFixed(2)}
                            </span>
                            <span>•</span>
                            <span>Estoque: {product.stock_qty} un</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {alreadyInBanner ? (
                          <span className="px-3 py-1.5 rounded-xl bg-pink-100 text-[#E6007E] font-bold text-xs inline-flex items-center gap-1 border border-pink-200">
                            <Check className="w-3.5 h-3.5" />
                            <span>Já Vinculado</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleAddProductToOffersBanner(product);
                              setIsAddingProductToBanner(false);
                              setBannerProductSearch('');
                            }}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-[#E6007E] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar ao Banner</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddingProductToBanner(false);
                  setBannerProductSearch('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
