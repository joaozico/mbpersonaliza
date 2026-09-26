import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  ChevronRight,
  Headphones,
  ShoppingBag,
  Briefcase,
  HelpCircle,
  Clock,
  Sparkles,
  Phone,
} from 'lucide-react';
import { WhatsAppContact, CompanySettings } from '../types';

interface WhatsAppFloatingWidgetProps {
  companySettings: CompanySettings;
  onOpenFullModal?: () => void;
}

export const WhatsAppFloatingWidget: React.FC<WhatsAppFloatingWidgetProps> = ({
  companySettings,
  onOpenFullModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  const contacts: WhatsAppContact[] =
    companySettings.whatsappContacts && companySettings.whatsappContacts.length > 0
      ? companySettings.whatsappContacts.filter((c) => c.active !== false)
      : [
          {
            id: 'default',
            name: 'Atendimento & Vendas',
            number: companySettings.whatsapp || '(11) 98765-4321',
            department: 'Comercial',
            hours: 'Seg a Sex: 08:30 às 18:30',
            customMessage: 'Olá! Gostaria de mais informações sobre os produtos da MB Personaliza.',
            isDefault: true,
            active: true,
          },
        ];

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const getDepartmentIcon = (dept?: string) => {
    const d = (dept || '').toLowerCase();
    if (d.includes('venda') || d.includes('comercial') || d.includes('cotação')) {
      return <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />;
    }
    if (d.includes('corporativo') || d.includes('pj') || d.includes('grande')) {
      return <Briefcase className="w-3.5 h-3.5 text-sky-600" />;
    }
    if (d.includes('suporte') || d.includes('pós') || d.includes('pedido')) {
      return <Headphones className="w-3.5 h-3.5 text-amber-600" />;
    }
    return <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />;
  };

  const handleStartChat = (contact: WhatsAppContact) => {
    const cleanNumber = contact.number.replace(/\D/g, '');
    const text = contact.customMessage || 'Olá! Gostaria de falar com o time da MB Personaliza.';
    const url = `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mb_analytics_event', {
          detail: { eventName: 'clique_whatsapp', contact: contact.name, number: contact.number },
        })
      );
    }
  };

  const handleMainButtonClick = () => {
    // If only 1 contact, direct redirect; if multiple, toggle popup card
    if (contacts.length === 1) {
      handleStartChat(contacts[0]);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div
      ref={widgetRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end pointer-events-auto no-print"
      id="whatsapp-floating-widget"
    >
      {/* Expanded Popover Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ duration: 0.2 }}
            className="mb-3 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Popover Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white relative">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-3 right-3 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs border border-white/20">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-heading text-white">Atendimento WhatsApp</h4>
                  <p className="text-[11px] text-emerald-100 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                    {contacts.length} Canais Disponíveis
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-emerald-100/90 mt-2">
                Clique no setor desejado para iniciar conversa imediata:
              </p>
            </div>

            {/* List of WhatsApp contacts */}
            <div className="p-3 max-h-72 overflow-y-auto space-y-2 divide-y divide-slate-100">
              {contacts.map((contact, idx) => (
                <button
                  key={contact.id || idx}
                  onClick={() => {
                    handleStartChat(contact);
                    setIsOpen(false);
                  }}
                  className="w-full text-left pt-2 first:pt-0 p-2.5 rounded-xl hover:bg-emerald-50/60 border border-transparent hover:border-emerald-200 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 group-hover:border-emerald-300 transition-colors">
                      {getDepartmentIcon(contact.department)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 transition-colors truncate">
                          {contact.name}
                        </span>
                        {contact.isDefault && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                            Principal
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        {contact.number} {contact.hours ? `• ${contact.hours}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="w-7 h-7 rounded-lg bg-[#25D366]/10 text-[#25D366] group-hover:bg-[#25D366] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>

            {/* Popover Footer */}
            {onOpenFullModal && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenFullModal();
                  }}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Ver todos os canais e telefones
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button */}
      <button
        onClick={handleMainButtonClick}
        className="group flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-0.5 cursor-pointer relative"
        title={contacts.length > 1 ? 'Ver números de WhatsApp' : 'Falar no WhatsApp'}
      >
        <div className="relative">
          <MessageSquare className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-300 border-2 border-[#25D366] animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-300 border-2 border-[#25D366]" />
        </div>

        <div className="hidden sm:flex flex-col text-left leading-none">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100">
            {contacts.length > 1 ? `${contacts.length} Números Online` : 'Atendimento'}
          </span>
          <span className="text-xs font-bold text-white">WhatsApp MB</span>
        </div>

        {contacts.length > 1 && (
          <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/25 text-[10px] font-extrabold text-white">
            {contacts.length}
          </span>
        )}
      </button>
    </div>
  );
};
