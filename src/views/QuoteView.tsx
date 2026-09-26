import React, { useState } from 'react';
import { Product, ProductVariant, Quote, QuoteItem, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { ArtworkUpload } from '../components/ArtworkUpload';
import { SEOHead } from '../components/SEOHead';
import {
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  Trash2,
  Send,
  Calendar,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuoteViewProps {
  products: Product[];
  currentUser: UserProfile;
  initialItem?: { product: Product; variant?: ProductVariant; quantity: number };
  onNavigate: (view: string, param?: string) => void;
}

export const QuoteView: React.FC<QuoteViewProps> = ({
  products,
  currentUser,
  initialItem,
  onNavigate,
}) => {
  const [clientName, setClientName] = useState(currentUser.name || '');
  const [clientEmail, setClientEmail] = useState(currentUser.email || '');
  const [clientPhone, setClientPhone] = useState(currentUser.phone || '');
  const [clientCompany, setClientCompany] = useState(currentUser.company || '');
  const [clientCpfCnpj, setClientCpfCnpj] = useState(currentUser.cpfCnpj || '');
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [deliveryCityState, setDeliveryCityState] = useState('São Paulo - SP');
  const [notes, setNotes] = useState('');
  const [uploadedArtwork, setUploadedArtwork] = useState<{ name: string; url: string; size: string } | null>(null);

  // Quote items
  const [items, setItems] = useState<QuoteItem[]>(() => {
    if (initialItem) {
      return [
        {
          id: `qi-${Date.now()}`,
          productId: initialItem.product.id,
          productName: initialItem.product.name,
          productSku: initialItem.product.code,
          productImage: initialItem.product.images[0],
          variantName: initialItem.variant?.name,
          quantity: initialItem.quantity,
          customTechnique: initialItem.product.details.customTechniques[0] || 'Laser',
        },
      ];
    }
    const defaultProd = products[0];
    return [
      {
        id: `qi-${Date.now()}`,
        productId: defaultProd.id,
        productName: defaultProd.name,
        productSku: defaultProd.code,
        productImage: defaultProd.images[0],
        quantity: 50,
        customTechnique: defaultProd.details.customTechniques[0] || 'Laser',
      },
    ];
  });

  const [submittedQuote, setSubmittedQuote] = useState<Quote | null>(null);

  const handleAddItem = () => {
    const defaultProd = products[0];
    setItems([
      ...items,
      {
        id: `qi-${Date.now()}`,
        productId: defaultProd.id,
        productName: defaultProd.name,
        productSku: defaultProd.code,
        productImage: defaultProd.images[0],
        quantity: 50,
        customTechnique: defaultProd.details.customTechniques[0] || 'Laser',
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      alert('O orçamento deve conter pelo menos 1 item.');
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const handleItemProductChange = (index: number, productId: string) => {
    const selectedProd = products.find((p) => p.id === productId);
    if (!selectedProd) return;
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId: selectedProd.id,
      productName: selectedProd.name,
      productSku: selectedProd.code,
      productImage: selectedProd.images[0],
      customTechnique: selectedProd.details.customTechniques[0] || 'Laser',
      variantName: undefined,
    };
    setItems(newItems);
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, qty);
    setItems(newItems);
  };

  const handleItemTechniqueChange = (index: number, tech: string) => {
    const newItems = [...items];
    newItems[index].customTechnique = tech;
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName || !clientEmail || !clientPhone) {
      alert('Por favor preencha nome, e-mail e telefone de contato.');
      return;
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const quoteCode = `ORC-2026-${randomNum}`;

    const newQuote: Quote = {
      id: `orc-${Date.now()}`,
      code: quoteCode,
      clientId: currentUser.id,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      clientCpfCnpj,
      deliveryDeadline,
      deliveryCityState,
      items,
      notes,
      artworkName: uploadedArtwork?.name,
      artworkUrl: uploadedArtwork?.url,
      status: 'pendente',
      createdAt: new Date().toISOString(),
    };

    StorageService.addQuote(newQuote);
    setSubmittedQuote(newQuote);

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E6007E', '#00AEEF', '#FFDD00'],
      });
    } catch {}
  };

  if (submittedQuote) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E6007E]">
            Solicitação Recebida com Sucesso!
          </span>
          <h1 className="text-3xl font-extrabold uppercase font-heading text-slate-900">
            Cotação {submittedQuote.code} Registrada
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Obrigado, <strong>{submittedQuote.clientName}</strong>. Nossa equipe comercial já recebeu os detalhes e enviará a proposta formal com valores, prazo e simulação virtual para seu e-mail <strong>{submittedQuote.clientEmail}</strong> e WhatsApp.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-left max-w-md mx-auto space-y-3 shadow-xs">
          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Protocolo:</span>
            <span className="font-mono font-bold text-slate-900">{submittedQuote.code}</span>
          </div>
          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Total de Itens:</span>
            <span className="font-bold text-slate-900">
              {(submittedQuote.items || []).reduce((a, b) => a + (b?.quantity || 0), 0)} unidades em {(submittedQuote.items || []).length} produto(s)
            </span>
          </div>
          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Status Atual:</span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
              Em Análise Comercial
            </span>
          </div>
          {submittedQuote.artworkName && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Arte Anexada:</span>
              <span className="font-medium text-emerald-700">{submittedQuote.artworkName}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('customer-portal')}
            className="px-6 py-3 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center gap-2"
          >
            <span>Ver Meus Orçamentos (Minha Conta)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm border border-slate-200"
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="quote-request-page">
      <SEOHead
        title="Solicitar Orçamento Rápido de Brindes e Personalizados"
        description="Receba uma proposta comercial detalhada e sem compromisso para brindes corporativos, presentes e papelaria personalizada. Condições especiais para empresas e atacado."
        canonicalPath="/orcamento"
        breadcrumbs={[
          { name: 'Início', path: '/' },
          { name: 'Solicitar Orçamento', path: '/orcamento' },
        ]}
        keywords={[
          'orçamento brindes personalizados',
          'cotação presentes corporativos',
          'brindes atacado orçamento',
          'simulador de brindes',
          'MB Personaliza',
        ]}
      />

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-50 text-[#E6007E] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Cotação Rápida B2B & Personalizados
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase font-heading text-slate-900">
          Solicite seu Orçamento Personalizado
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Preencha os produtos e quantidades desejadas. Nossa equipe técnica formulará a melhor proposta com descontos progressivos por volume.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-8">
        {/* Section 1: Customer Info */}
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-[#00AEEF]" />
            1. Dados de Contato e Faturamento
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo *</label>
              <input
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="Ex: joao@empresa.com.br"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Telefone *</label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Empresa / Razão Social</label>
              <input
                type="text"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="Ex: Minha Empresa Ltda"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ ou CPF (Opcional p/ faturamento)</label>
              <input
                type="text"
                value={clientCpfCnpj}
                onChange={(e) => setClientCpfCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cidade / Estado de Entrega</label>
              <input
                type="text"
                value={deliveryCityState}
                onChange={(e) => setDeliveryCityState(e.target.value)}
                placeholder="Ex: São Paulo - SP"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Products & Customization */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-heading text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#E6007E]" />
              2. Itens do Orçamento
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs font-bold text-[#00AEEF] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Outro Produto
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const currentProd = products.find((p) => p.id === item.productId) || products[0];

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col md:flex-row items-start md:items-center gap-4"
                >
                  <img
                    src={item.productImage || currentProd.images[0]}
                    alt={item.productName}
                    className="w-16 h-16 object-cover rounded-xl border border-slate-200 flex-shrink-0"
                  />

                  {/* Product selector */}
                  <div className="flex-1 w-full space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">Produto</label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemProductChange(index, e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Technique selector */}
                  <div className="w-full md:w-48 space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">Gravação</label>
                    <select
                      value={item.customTechnique || ''}
                      onChange={(e) => handleItemTechniqueChange(index, e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                    >
                      {currentProd.details.customTechniques.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="w-full md:w-32 space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemQtyChange(index, parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-xs font-extrabold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                    />
                  </div>

                  {/* Remove action */}
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-2 self-end md:self-center transition-colors"
                      title="Remover item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Artwork & Deadline */}
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
            <Sparkles className="w-4 h-4 text-[#FFDD00]" />
            3. Logomarca e Prazo Desejado
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ArtworkUpload
                onArtworkUploaded={setUploadedArtwork}
                label="Envie seu Logotipo / Manual da Marca (Opcional)"
                helperText="Formatos: PDF, AI, CDR, PNG ou JPG. Usaremos para montar a simulação virtual 3D."
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data Limite Desejada para Entrega (Opcional)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações Adicionais ou Detalhes Especiais
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Gravação a laser em ambos os lados, embalagem de presente individual, faturamento para 28 dias..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit action */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#00AEEF]" />
            <span>Resposta formal por e-mail e WhatsApp em até 2 horas úteis.</span>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-[#E6007E] text-white font-extrabold text-sm rounded-xl transition-all shadow-lg hover:shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer"
            id="btn-submit-quote"
          >
            <Send className="w-4 h-4" />
            <span>Enviar Solicitação de Orçamento</span>
          </button>
        </div>
      </form>
    </div>
  );
};
