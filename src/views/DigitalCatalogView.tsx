import React, { useState, useEffect } from 'react';
import { Product, Category, CompanySettings, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { Logo } from '../components/Logo';
import { SEOHead } from '../components/SEOHead';
import {
  Printer,
  Share2,
  Phone,
  Mail,
  MapPin,
  QrCode,
  CheckCircle,
  FileDown,
  Sparkles,
  Link,
  MessageSquare,
  ChevronRight,
  Filter,
  Lock,
} from 'lucide-react';

interface DigitalCatalogViewProps {
  products: Product[];
  categories: Category[];
  currentUser?: UserProfile;
  onNavigate: (view: string, param?: string) => void;
}

export const DigitalCatalogView: React.FC<DigitalCatalogViewProps> = ({
  products,
  categories,
  currentUser,
  onNavigate,
}) => {
  const canAccessCatalogPdf = StorageService.hasUserPermission(currentUser, 'canAccessCatalogPdf');
  const canViewPrices = StorageService.canViewPrices(currentUser);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [showPriceTiers, setShowPriceTiers] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() =>
    StorageService.getCompanySettings()
  );

  useEffect(() => {
    const handleUpdate = () => {
      setCompanySettings(StorageService.getCompanySettings());
    };

    window.addEventListener('mb_company_settings_updated', handleUpdate);
    window.addEventListener('mb_storage_updated', handleUpdate);

    return () => {
      window.removeEventListener('mb_company_settings_updated', handleUpdate);
      window.removeEventListener('mb_storage_updated', handleUpdate);
    };
  }, []);

  const activeProducts = products.filter((p) => p.is_active);
  const filteredProducts =
    selectedCat === 'all'
      ? activeProducts
      : activeProducts.filter((p) => p.categoryId === selectedCat);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const cleanPhone = companySettings.whatsapp?.replace(/\D/g, '') || '';
    const msg = `Olá! Segue nosso catálogo digital de produtos e brindes personalizados ${companySettings.tradeName || 'MB Personaliza'}: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!canAccessCatalogPdf) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading font-black uppercase text-slate-900">
            Acesso Restrito: Catálogo Digital PDF
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O catálogo digital diagramado para impressão está disponível apenas para perfis autorizados da equipe. Você pode navegar livremente pelo catálogo público de produtos ou solicitar um orçamento.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className="px-5 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Ver Catálogo da Loja
          </button>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="digital-catalog-root">
      <SEOHead
        title="Catálogo Digital Interativo & PDF MB Personaliza"
        description="Acesse e folheie nosso catálogo interativo de brindes promocionais e presentes corporativos. Baixe em PDF ou envie propostas diretamente aos seus clientes."
        canonicalPath="/catalogo-digital"
        breadcrumbs={[
          { name: 'Início', path: '/' },
          { name: 'Catálogo Digital', path: '/catalogo-digital' },
        ]}
        keywords={[
          'catálogo digital brindes',
          'pdf brindes corporativos',
          'revenda brindes personalizados',
          'tabela de preços atacado brindes',
          'MB Personaliza',
        ]}
      />

      {/* Control Bar (hidden in print) */}
      <div className="no-print bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00AEEF] animate-pulse" />
            <h2 className="font-heading text-lg font-bold uppercase tracking-tight text-white">
              Catálogo Digital Interativo & PDF
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Link público para envio direto ao cliente • Pronto para impressão e exportação em PDF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-800 text-white rounded-xl border border-slate-700 focus:outline-none"
          >
            <option value="all">Todos os Departamentos ({activeProducts.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Share WhatsApp */}
          <button
            onClick={handleShareWhatsApp}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Enviar no WhatsApp</span>
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Link className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
          </button>

          {/* Print / Save PDF */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            id="btn-print-catalog"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar PDF</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE CATALOG CONTAINER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm space-y-8">
        {/* Printable Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <Logo size="lg" />
            <p className="text-xs text-slate-500 font-medium mt-1">
              Catálogo Oficial de Produtos Personalizados • Edição {new Date().getFullYear()}
            </p>
          </div>

          <div className="text-right text-xs text-slate-600 space-y-1 sm:border-l sm:border-slate-200 sm:pl-6">
            <p className="font-bold text-slate-900">
              {companySettings.corporateName || companySettings.tradeName || 'MB Personaliza'}
            </p>
            <p>Tel / WhatsApp: {companySettings.whatsapp || companySettings.phone || '(11) 98765-4321'}</p>
            <p>{companySettings.email || 'contato@mbpersonaliza.com.br'}</p>
            <p>
              {companySettings.address?.city || 'São Paulo'} / {companySettings.address?.state || 'SP'} • Atendimento Nacional
            </p>
          </div>
        </div>

        {/* Catalog intro notes */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-900">Personalização Premium:</span> Gravação a Laser, Silk Screen, Sublimação, Impressão UV e DTF.
          </div>
          <div className="flex items-center gap-1 font-semibold text-emerald-700">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Prova virtual sem custo antes da produção</span>
          </div>
        </div>

        {/* Products Grid / Print Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
          {filteredProducts.map((product) => {
            const minTier =
              product.price_tiers && product.price_tiers.length > 0
                ? product.price_tiers[product.price_tiers.length - 1]
                : null;

            return (
              <div
                key={product.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between space-y-3 page-break-inside-avoid shadow-xs hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-100 mb-3 border border-slate-100">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span>{product.code}</span>
                    <span>Mín: {product.min_order_qty} un</span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm font-heading leading-tight">
                    {product.name}
                  </h3>

                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                    {product.description}
                  </p>

                  {/* Details specs */}
                  <div className="mt-2 text-[10px] text-slate-600 space-y-0.5 border-t border-slate-100 pt-1.5">
                    {product.details?.materials && (
                      <p>
                        <strong className="text-slate-700">Material:</strong> {product.details.materials}
                      </p>
                    )}
                    <p>
                      <strong className="text-slate-700">Gravações:</strong>{' '}
                      {(product.details?.customTechniques || ['Gravação a Laser', 'Silk Screen']).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Price and Tiers */}
                <div className="pt-2 border-t border-slate-200">
                  {canViewPrices && product.show_price ? (
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[10px] text-slate-500 font-medium">A partir de:</span>
                        <span className="text-base font-black text-slate-900 font-heading">
                          R$ {minTier ? minTier.unit_price.toFixed(2) : (product.promo_price || product.base_price).toFixed(2)}
                          <span className="text-[10px] font-normal text-slate-500 font-sans"> /un</span>
                        </span>
                      </div>

                      {/* Tier table in catalog */}
                      {product.price_tiers && product.price_tiers.length > 0 && (
                        <div className="grid grid-cols-3 gap-1 text-[9px] text-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          {product.price_tiers.slice(0, 3).map((t) => (
                            <div key={t.id}>
                              <div className="text-slate-400 font-semibold">{t.min_qty}+ un</div>
                              <div className="font-bold text-slate-900">R$ {t.unit_price.toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-1 text-center bg-amber-50 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200">
                      Consulte cotação por volume
                    </div>
                  )}

                  {/* Online link in interactive mode */}
                  <div className="no-print pt-2">
                    <button
                      onClick={() => onNavigate('product-detail', product.id)}
                      className="w-full py-1.5 bg-slate-900 hover:bg-[#E6007E] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Ver Opções & Cores
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Printable Footer with Supply Terms and WhatsApp CTA */}
        <div className="border-t-2 border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-600">
          <div className="space-y-1 max-w-md">
            <p className="font-bold text-slate-900 uppercase">Condições Gerais de Fornecimento:</p>
            <p className="text-[11px] text-slate-500">
              • Preços sujeitos a alteração sem aviso prévio. Faturamento sujeito a análise de crédito.<br />
              • Prazos de produção: 7 a 12 dias úteis após aprovação da arte.<br />
              • Frete: FOB ou CIF conforme volume da cotação.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center sm:text-right flex items-center gap-4">
            <div>
              <p className="text-xs font-bold text-slate-900">Dúvidas ou Pedidos?</p>
              <p className="text-[11px] text-emerald-700 font-semibold">WhatsApp: (11) 98765-4321</p>
              <p className="text-[10px] text-slate-400">mbpersonaliza.com.br</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-mono text-[9px] text-center font-bold">
              QR CODE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
