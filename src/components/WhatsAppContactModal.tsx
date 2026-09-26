import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Phone,
  Clock,
  Check,
  Copy,
  ExternalLink,
  X,
  Sparkles,
  ChevronRight,
  Headphones,
  ShoppingBag,
  Briefcase,
  HelpCircle,
} from 'lucide-react';
import { WhatsAppContact, CompanySettings } from '../types';

interface WhatsAppContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  companySettings: CompanySettings;
  prefilledContext?: string; // Optional context like "Orçamento #123" or "Dúvida sobre Produto X"
}

export const WhatsAppContactModal: React.FC<WhatsAppContactModalProps> = ({
  isOpen,
  onClose,
  companySettings,
  prefilledContext,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close modal when pressing the Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleCopyNumber = (id: string, num: string) => {
    navigator.clipboard.writeText(num.replace(/\D/g, ''));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDepartmentIcon = (dept?: string) => {
    const d = (dept || '').toLowerCase();
    if (d.includes('venda') || d.includes('comercial') || d.includes('cotação')) {
      return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
    }
    if (d.includes('corporativo') || d.includes('pj') || d.includes('grande')) {
      return <Briefcase className="w-4 h-4 text-sky-600" />;
    }
    if (d.includes('suporte') || d.includes('pós') || d.includes('pedido')) {
      return <Headphones className="w-4 h-4 text-amber-600" />;
    }
    return <HelpCircle className="w-4 h-4 text-emerald-600" />;
  };

  const handleStartChat = (contact: WhatsAppContact) => {
    const cleanNumber = contact.number.replace(/\D/g, '');
    let text = contact.customMessage || 'Olá! Gostaria de falar com o time da MB Personaliza.';
    if (prefilledContext) {
      text = `${text} (${prefilledContext})`;
    }
    const url = `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    // Dispatch analytics event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mb_analytics_event', {
          detail: { eventName: 'clique_whatsapp', contact: contact.name, number: contact.number },
        })
      );
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs cursor-pointer animate-in fade-in duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Canais de Atendimento via WhatsApp"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] cursor-default"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
              title="Fechar janela (ESC)"
              aria-label="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs border border-white/20 shadow-inner">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/20 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  Atendimento Online
                </span>
                <h3 className="text-lg font-bold font-heading leading-tight text-white mt-0.5">
                  Canais de WhatsApp da {companySettings.name}
                </h3>
              </div>
            </div>

            <p className="text-xs text-emerald-100/90 leading-relaxed mt-2">
              Selecione o canal ou setor com o qual deseja conversar. Nossos consultores respondem rapidamente em horário comercial.
            </p>

            {prefilledContext && (
              <div className="mt-3 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-emerald-50 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                <span className="truncate">Referência: {prefilledContext}</span>
              </div>
            )}
          </div>

          {/* List of Contacts */}
          <div className="p-5 overflow-y-auto space-y-3.5 divide-y divide-slate-100">
            {contacts.map((contact, idx) => {
              const cleanNumber = contact.number.replace(/\D/g, '');
              const isCopied = copiedId === contact.id;

              return (
                <div
                  key={contact.id || idx}
                  className={`pt-3.5 first:pt-0 group rounded-2xl p-3.5 transition-all border ${
                    contact.isDefault
                      ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/80'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                        {getDepartmentIcon(contact.department)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">
                            {contact.name}
                          </h4>
                          {contact.isDefault && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Principal
                            </span>
                          )}
                        </div>
                        {contact.department && (
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Setor: {contact.department}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200 flex-shrink-0">
                      {contact.number}
                    </span>
                  </div>

                  {contact.hours && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-3 ml-10">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{contact.hours}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 ml-10">
                    <button
                      onClick={() => handleStartChat(contact)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#1EBE5D] shadow-xs hover:shadow-sm transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Iniciar Conversa</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>

                    <button
                      onClick={() => handleCopyNumber(contact.id, contact.number)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Copiar número de telefone"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Info */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>PABX: {companySettings.phone}</span>
                <span className="text-slate-300">•</span>
                <span>{companySettings.email}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Pressione <kbd className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-mono font-bold">ESC</kbd> ou clique fora para fechar
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-center shrink-0 shadow-2xs"
            >
              Fechar Janela
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
