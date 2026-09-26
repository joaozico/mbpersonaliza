import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { StorageService } from '../services/storage';
import { CompanySettings } from '../types';
import { WhatsAppContactModal } from './WhatsAppContactModal';
import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Linkedin,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  QrCode,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string, param?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [settings, setSettings] = useState<CompanySettings>(() => StorageService.getCompanySettings());
  const [layoutSettings, setLayoutSettings] = useState(() => StorageService.getLayoutSettings());
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setSettings(StorageService.getCompanySettings());
      setLayoutSettings(StorageService.getLayoutSettings());
    };
    window.addEventListener('mb_storage_updated', handleUpdate);
    window.addEventListener('mb_company_settings_updated', handleUpdate);
    window.addEventListener('mb_layout_updated', handleUpdate);
    return () => {
      window.removeEventListener('mb_storage_updated', handleUpdate);
      window.removeEventListener('mb_company_settings_updated', handleUpdate);
      window.removeEventListener('mb_layout_updated', handleUpdate);
    };
  }, []);

  const cleanWhatsappNumber = settings.whatsapp.replace(/\D/g, '');

  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-8 border-t border-slate-800 no-print" id="site-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Logo variant="dark" size="lg" />
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed mt-3">
              {layoutSettings.footer.aboutText || settings.tagline || 'Especialistas em brindes corporativos, presentes personalizados e soluções em comunicação visual de alto padrão.'}
            </p>

            {layoutSettings.footer.showSocialLinks && (
              <div className="flex items-center gap-3 pt-2">
                {settings.socialLinks?.instagram && (
                  <a
                    href={`https://instagram.com/${settings.socialLinks.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#E6007E] hover:border-[#E6007E] transition-all"
                    title={`Siga no Instagram ${settings.socialLinks.instagram}`}
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {settings.socialLinks?.facebook && (
                  <a
                    href={`https://facebook.com/${settings.socialLinks.facebook}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#00AEEF] hover:border-[#00AEEF] transition-all"
                    title={`Curta no Facebook ${settings.socialLinks.facebook}`}
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {settings.whatsapp && (
                  <button
                    type="button"
                    onClick={() => {
                      if ((settings.whatsappContacts?.length || 1) > 1) {
                        setIsWhatsAppModalOpen(true);
                      } else {
                        window.open(
                          `https://wa.me/55${cleanWhatsappNumber}?text=${encodeURIComponent(
                            'Olá! Gostaria de falar com o time da MB Personaliza.'
                          )}`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }
                    }}
                    className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#25D366] hover:border-[#25D366] transition-all cursor-pointer relative"
                    title={(settings.whatsappContacts?.length || 1) > 1 ? `Ver ${settings.whatsappContacts?.length} canais de WhatsApp` : "Converse pelo WhatsApp"}
                  >
                    <MessageSquare className="w-4 h-4" />
                    {(settings.whatsappContacts?.length || 1) > 1 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#25D366]" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-heading text-lg font-bold tracking-tight uppercase mb-4 text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E6007E]" />
              Navegação
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors"
                >
                  Início
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog')}
                  className="hover:text-white transition-colors"
                >
                  Catálogo de Produtos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('digital-catalog')}
                  className="hover:text-[#00AEEF] transition-colors flex items-center gap-1"
                >
                  Catálogo Digital PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('quote')}
                  className="hover:text-white transition-colors"
                >
                  Solicitar Cotação
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('customer-portal')}
                  className="hover:text-white transition-colors"
                >
                  Área do Cliente (Minha Conta)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin-login')}
                  className="hover:text-[#FFDD00] text-slate-400 font-semibold transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FFDD00]" />
                  Acesso Administrativo (Login)
                </button>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-white font-heading text-lg font-bold tracking-tight uppercase mb-4 text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00AEEF]" />
              Categorias
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => onNavigate('catalog', 'cat-termicos')}
                  className="hover:text-white transition-colors"
                >
                  Térmicos & Copos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog', 'cat-textil')}
                  className="hover:text-white transition-colors"
                >
                  Têxtil & Uniformes
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog', 'cat-papelaria')}
                  className="hover:text-white transition-colors"
                >
                  Papelaria & Cadernos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog', 'cat-ecologicos')}
                  className="hover:text-white transition-colors"
                >
                  Ecológicos & Sacolas
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog', 'cat-comunicacao')}
                  className="hover:text-white transition-colors"
                >
                  Comunicação Visual
                </button>
              </li>
            </ul>
          </div>

          {/* Contact / Service */}
          <div>
            <h4 className="text-white font-heading text-lg font-bold tracking-tight uppercase mb-4 text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FFDD00]" />
              Atendimento
            </h4>
            <ul className="space-y-3 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span>
                  {settings.address?.street
                    ? `${settings.address.street}, ${settings.address.number}${settings.address.complement ? ` - ${settings.address.complement}` : ''} - ${settings.address.city}/${settings.address.state}`
                    : 'Rua das Indústrias Criativas, 450 - São Paulo/SP'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>Tel: {settings.phone}</span>
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-[#25D366] flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-semibold">WhatsApp:</span>
                    <button
                      type="button"
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      className="text-emerald-400 hover:text-emerald-300 font-mono underline cursor-pointer text-xs"
                      title="Clique para ver todos os canais de WhatsApp"
                    >
                      {settings.whatsapp}
                    </button>
                    {(settings.whatsappContacts?.length || 1) > 1 && (
                      <button
                        type="button"
                        onClick={() => setIsWhatsAppModalOpen(true)}
                        className="text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-400 px-1.5 py-0.2 rounded hover:bg-emerald-900 cursor-pointer font-bold"
                      >
                        +{(settings.whatsappContacts?.length || 1) - 1} canais
                      </button>
                    )}
                  </div>
                  {(settings.whatsappContacts?.length || 1) > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Ver opções de atendimento &raquo;</span>
                    </button>
                  )}
                </div>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>{settings.email}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>Seg a Sex: 08:30 às 18:00</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Badges & Payments */}
        {(layoutSettings.footer.showPaymentBadges || layoutSettings.footer.showSecurityBadge) && (
          <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            {layoutSettings.footer.showPaymentBadges ? (
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400">Formas de Pagamento:</span>
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 text-emerald-400 border border-slate-800 font-bold">
                  <QrCode className="w-3.5 h-3.5" /> PIX
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
                  <CreditCard className="w-3.5 h-3.5 text-sky-400" /> Cartão até 12x
                </span>
              </div>
            ) : <div />}

            <div className="flex items-center gap-4">
              {layoutSettings.footer.showSecurityBadge && (
                <span className="flex items-center gap-1 text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Site Seguro SSL 256-bit
                </span>
              )}
              <span>CNPJ: {settings.cnpj}</span>
            </div>
          </div>
        )}

        {/* Bottom copyright */}
        <div className="mt-8 pt-4 text-center text-[11px] text-slate-600 border-t border-slate-900/50">
          {layoutSettings.footer.copyrightText || `© ${new Date().getFullYear()} ${settings.corporateName || settings.name} — Todos os direitos reservados. ${settings.tagline}`}
        </div>
      </div>

      {/* WhatsApp Multi-Channel Contact Modal */}
      <WhatsAppContactModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        companySettings={settings}
      />
    </footer>
  );
};
